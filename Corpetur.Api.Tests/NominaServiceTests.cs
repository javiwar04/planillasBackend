using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Corpetur.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Tests;

public class NominaServiceTests
{
    // Contexto EF en memoria, aislado por test.
    private static CorpeturDbContext NuevoContexto() =>
        new(new DbContextOptionsBuilder<CorpeturDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Concepto Concepto(string codigo, string nat, bool calc = false) =>
        new() { Codigo = codigo, Nombre = codigo, Naturaleza = nat, EsCalculado = calc };

    // Catálogo mínimo de conceptos que usa el motor.
    private static void SembrarConceptos(CorpeturDbContext db)
    {
        db.Conceptos.AddRange(
            Concepto("SUELDO", "INGRESO"),
            Concepto("IGSS", "EGRESO", true),
            Concepto("ANTICIPO", "EGRESO"),
            Concepto("COMISION", "INGRESO"),
            Concepto("AGUINALDO", "INGRESO"),
            Concepto("BONO14", "INGRESO"));
        db.SaveChanges();
    }

    private static Empleado Empleado(int estabId, decimal sueldo = 4000, decimal quincena = 1200) =>
        new()
        {
            Nombres = "Test", Apellidos = "Empleado", Nit = Guid.NewGuid().ToString("N")[..8],
            EstablecimientoId = estabId, Tipo = "PLANILLA", SueldoBase = sueldo,
            MontoQuincena = quincena, Activo = true,
        };

    // ---- RecalcularTotales (lógica pura) ----
    [Fact]
    public void RecalcularTotales_sumaIngresosYEgresos()
    {
        var ingreso = new Concepto { Naturaleza = "INGRESO" };
        var egreso = new Concepto { Naturaleza = "EGRESO" };
        var boleta = new Boleta
        {
            Detalles = new List<BoletaDetalle>
            {
                new() { Monto = 4000, Concepto = ingreso },
                new() { Monto = 250,  Concepto = ingreso },
                new() { Monto = 193.20m, Concepto = egreso },
            }
        };

        NominaService.RecalcularTotales(boleta);

        Assert.Equal(4250m, boleta.TotalIngresos);
        Assert.Equal(193.20m, boleta.TotalEgresos);
    }

    // ---- IGSS laboral 4.83% sobre sueldo base en FIN_MES ----
    [Fact]
    public async Task GenerarFinMes_calculaIgssYSueldo()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        db.SaveChanges();
        SembrarConceptos(db);
        db.ParametrosNomina.Add(new ParametroNomina { Clave = "IGSS_LABORAL", Valor = 4.83m });
        var emp = Empleado(1, sueldo: 4000);
        db.Empleados.Add(emp);
        db.PeriodosPago.Add(new PeriodoPago { Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "ABIERTO" });
        db.SaveChanges();

        var svc = new NominaService(db);
        await svc.GenerarAsync(1, null);

        var boleta = await db.Boletas.Include(b => b.Detalles).ThenInclude(d => d.Concepto)
            .FirstAsync(b => b.EmpleadoId == emp.EmpleadoId);
        var igss = boleta.Detalles.First(d => d.Concepto!.Codigo == "IGSS").Monto;
        var sueldo = boleta.Detalles.First(d => d.Concepto!.Codigo == "SUELDO").Monto;

        Assert.Equal(193.20m, igss);   // 4000 * 4.83%
        Assert.Equal(4000m, sueldo);
    }

    // ---- Quincena = anticipo fijo, con override ----
    [Fact]
    public async Task GenerarQuincena_usaMontoQuincenaYOverride()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        db.SaveChanges();
        SembrarConceptos(db);
        var normal = Empleado(1, quincena: 1200);
        var especial = Empleado(1, quincena: 1200);
        db.Empleados.AddRange(normal, especial);
        db.PeriodosPago.Add(new PeriodoPago { Anio = 2026, Mes = 6, Tipo = "QUINCENA",
            FechaInicio = new(2026, 6, 1), FechaFin = new(2026, 6, 15), Estado = "ABIERTO" });
        db.SaveChanges();

        var svc = new NominaService(db);
        await svc.GenerarAsync(1, new GenerarPeriodoRequest(
            new List<QuincenaOverrideDto> { new(especial.EmpleadoId, 1500) }));

        var bNormal = await db.Boletas.FirstAsync(b => b.EmpleadoId == normal.EmpleadoId);
        var bEspecial = await db.Boletas.FirstAsync(b => b.EmpleadoId == especial.EmpleadoId);
        Assert.Equal(1200m, bNormal.TotalIngresos);
        Assert.Equal(1500m, bEspecial.TotalIngresos);
    }

    // ---- Provisiones (cuadro Kurt) ----
    [Fact]
    public async Task GenerarProvisiones_aplicaTasasSobreSueldoBase()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        db.SaveChanges();
        db.ParametrosNomina.AddRange(
            new ParametroNomina { Clave = "INDEMNIZACION", Valor = 8.33m },
            new ParametroNomina { Clave = "IGSS_PATRONAL", Valor = 10.67m },
            new ParametroNomina { Clave = "INTECAP", Valor = 1.00m });
        var emp = Empleado(1, sueldo: 4000);
        db.Empleados.Add(emp);
        db.PeriodosPago.Add(new PeriodoPago { Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "ABIERTO" });
        db.SaveChanges();

        var svc = new NominaService(db);
        await svc.GenerarProvisionesAsync(1);

        var p = await db.ProvisionesLaboral.FirstAsync(x => x.EmpleadoId == emp.EmpleadoId);
        Assert.Equal(333.20m, p.Indemnizacion);   // 4000 * 8.33%
        Assert.Equal(426.80m, p.IgssPatronal);    // 4000 * 10.67%
        Assert.Equal(40.00m, p.Intecap);          // 4000 * 1%
    }

    // ---- Reparto de comisión en partes iguales (cuadra exacto) ----
    [Fact]
    public async Task RepartoIgual_cuadraExactoConResiduoEnElUltimo()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "MESON", Nombre = "Mesón" });
        db.SaveChanges();
        SembrarConceptos(db);
        db.Empleados.AddRange(Empleado(1), Empleado(1), Empleado(1));
        db.PeriodosPago.Add(new PeriodoPago { Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "ABIERTO" });
        db.SaveChanges();

        var svc = new NominaService(db);
        var r = await svc.RepartirComisionAsync(new RepartoComisionRequest(
            PeriodoPagoId: 1, EstablecimientoId: 1, MontoTotal: 25000, Modo: "IGUAL",
            ConceptoId: null, Descripcion: null, Empleados: null));

        Assert.Equal(3, r.Empleados);
        Assert.Equal(25000m, r.MontoRepartido);
        Assert.Equal(25000m, r.Detalle.Sum(d => d.Monto));
        Assert.Contains(r.Detalle, d => d.Monto == 8333.34m); // el último absorbe el residuo
    }

    // ---- Reparto por peso (1/1/2 de 10000 -> 2500/2500/5000) ----
    [Fact]
    public async Task RepartoPorPeso_distribuyeSegunPeso()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "MESON", Nombre = "Mesón" });
        db.SaveChanges();
        SembrarConceptos(db);
        var e1 = Empleado(1); var e2 = Empleado(1); var e3 = Empleado(1);
        db.Empleados.AddRange(e1, e2, e3);
        db.PeriodosPago.Add(new PeriodoPago { Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "ABIERTO" });
        db.SaveChanges();

        var svc = new NominaService(db);
        var r = await svc.RepartirComisionAsync(new RepartoComisionRequest(
            PeriodoPagoId: 1, EstablecimientoId: 1, MontoTotal: 10000, Modo: "PESO",
            ConceptoId: null, Descripcion: null,
            Empleados: new List<RepartoItemDto> { new(e1.EmpleadoId, 1), new(e2.EmpleadoId, 1), new(e3.EmpleadoId, 2) }));

        Assert.Equal(5000m, r.Detalle.First(d => d.EmpleadoId == e3.EmpleadoId).Monto);
        Assert.Equal(10000m, r.Detalle.Sum(d => d.Monto));
    }

    // ---- Reabrir período: CERRADO -> CALCULADO y boletas PAGADA -> CALCULADA ----
    [Fact]
    public async Task Reabrir_revierteCierre()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        var emp = Empleado(1);
        db.Empleados.Add(emp);
        db.PeriodosPago.Add(new PeriodoPago { PeriodoPagoId = 1, Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "CERRADO",
            FechaPago = new(2026, 6, 30) });
        db.SaveChanges();
        db.Boletas.Add(new Boleta { EmpleadoId = emp.EmpleadoId, PeriodoPagoId = 1, Estado = "PAGADA" });
        db.SaveChanges();

        var svc = new NominaService(db);
        await svc.ReabrirAsync(1);

        var per = await db.PeriodosPago.FindAsync(1);
        Assert.Equal("CALCULADO", per!.Estado);
        Assert.Null(per.FechaPago);
        Assert.All(await db.Boletas.Where(b => b.PeriodoPagoId == 1).ToListAsync(),
            b => Assert.Equal("CALCULADA", b.Estado));
    }

    [Fact]
    public async Task Reabrir_periodoNoCerrado_lanzaConflicto()
    {
        using var db = NuevoContexto();
        db.PeriodosPago.Add(new PeriodoPago { PeriodoPagoId = 1, Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "CALCULADO" });
        db.SaveChanges();
        var svc = new NominaService(db);
        var ex = await Assert.ThrowsAsync<NominaException>(() => svc.ReabrirAsync(1));
        Assert.True(ex.Conflict);
    }

    // ---- No se puede repartir en un período cerrado ----
    [Fact]
    public async Task Reparto_enPeriodoCerrado_lanzaConflicto()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "MESON", Nombre = "Mesón" });
        db.SaveChanges();
        SembrarConceptos(db);
        db.Empleados.Add(Empleado(1));
        db.PeriodosPago.Add(new PeriodoPago { Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "CERRADO" });
        db.SaveChanges();

        var svc = new NominaService(db);
        var ex = await Assert.ThrowsAsync<NominaException>(() => svc.RepartirComisionAsync(
            new RepartoComisionRequest(1, 1, 5000, "IGUAL", null, null, null)));
        Assert.True(ex.Conflict);
    }

    [Fact]
    public async Task Reparto_conAguinaldo_lanzaValidacion()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "MESON", Nombre = "Mesón" });
        db.SaveChanges();
        SembrarConceptos(db);
        db.Empleados.Add(Empleado(1));
        db.PeriodosPago.Add(new PeriodoPago { Anio = 2026, Mes = 12, Tipo = "EXTRA",
            FechaInicio = new(2026, 12, 1), FechaFin = new(2026, 12, 31), Estado = "ABIERTO" });
        db.SaveChanges();
        var aguinaldo = await db.Conceptos.SingleAsync(c => c.Codigo == "AGUINALDO");

        var svc = new NominaService(db);
        var ex = await Assert.ThrowsAsync<NominaException>(() => svc.RepartirComisionAsync(
            new RepartoComisionRequest(1, 1, 5000, "IGUAL", aguinaldo.ConceptoId, null, null)));

        Assert.False(ex.Conflict);
        Assert.Contains("Aguinaldo", ex.Message);
    }

    // ---- El reparto deja la boleta en CALCULADA (no BORRADOR) ----
    [Fact]
    public async Task Reparto_dejaBoletaCalculada()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "MESON", Nombre = "Mesón" });
        db.SaveChanges();
        SembrarConceptos(db);
        var e1 = Empleado(1);
        db.Empleados.Add(e1);
        db.PeriodosPago.Add(new PeriodoPago { PeriodoPagoId = 1, Anio = 2026, Mes = 6, Tipo = "EXTRA",
            FechaInicio = new(2026, 7, 1), FechaFin = new(2026, 7, 7), Estado = "ABIERTO" });
        db.SaveChanges();

        var svc = new NominaService(db);
        await svc.RepartirComisionAsync(new RepartoComisionRequest(
            1, null, 1000, "IGUAL", null, null,
            new List<RepartoItemDto> { new(e1.EmpleadoId, null) }));

        var b = await db.Boletas.FirstAsync(x => x.EmpleadoId == e1.EmpleadoId);
        Assert.Equal("CALCULADA", b.Estado);
    }

    // ---- Aguinaldo / Bono 14 como pago especial ----
    [Fact]
    public async Task EmitirAguinaldo_calculaProporcionalYGeneraBoleta()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        db.SaveChanges();
        SembrarConceptos(db);
        var emp = Empleado(1, sueldo: 3650);
        emp.FechaIngreso = new DateOnly(2026, 11, 1);
        db.Empleados.Add(emp);
        var periodo = new PeriodoPago { Anio = 2026, Mes = 12, Tipo = "EXTRA",
            FechaInicio = new(2026, 12, 1), FechaFin = new(2026, 12, 31), Estado = "ABIERTO" };
        db.PeriodosPago.Add(periodo);
        db.SaveChanges();

        var svc = new NominaService(db);
        var r = await svc.EmitirAguinaldoAsync(new EmitirAguinaldoRequest("AGUINALDO", 2026, periodo.PeriodoPagoId));

        var boleta = await db.Boletas.Include(b => b.Detalles).ThenInclude(d => d.Concepto)
            .FirstAsync(b => b.EmpleadoId == emp.EmpleadoId);
        var detalle = boleta.Detalles.Single(d => d.Concepto!.Codigo == "AGUINALDO");

        Assert.Equal(1, r.Boletas);
        Assert.Equal(290m, r.TotalEmitido); // 3650 * 29 dias / 365
        Assert.Equal(290m, detalle.Monto);
        Assert.Equal(290m, boleta.TotalIngresos);
        Assert.Equal("CALCULADA", boleta.Estado);
    }

    [Fact]
    public async Task EmitirAguinaldo_esIdempotente()
    {
        using var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        db.SaveChanges();
        SembrarConceptos(db);
        var emp = Empleado(1, sueldo: 3650);
        emp.FechaIngreso = new DateOnly(2026, 11, 1);
        db.Empleados.Add(emp);
        var periodo = new PeriodoPago { Anio = 2026, Mes = 12, Tipo = "EXTRA",
            FechaInicio = new(2026, 12, 1), FechaFin = new(2026, 12, 31), Estado = "ABIERTO" };
        db.PeriodosPago.Add(periodo);
        db.SaveChanges();

        var svc = new NominaService(db);
        await svc.EmitirAguinaldoAsync(new EmitirAguinaldoRequest("AGUINALDO", 2026, periodo.PeriodoPagoId));
        var r = await svc.EmitirAguinaldoAsync(new EmitirAguinaldoRequest("AGUINALDO", 2026, periodo.PeriodoPagoId));

        var boleta = await db.Boletas.Include(b => b.Detalles).ThenInclude(d => d.Concepto)
            .SingleAsync(b => b.EmpleadoId == emp.EmpleadoId);
        var detalles = boleta.Detalles.Where(d => d.Concepto!.Codigo == "AGUINALDO").ToList();

        Assert.Equal(0, r.BoletasCreadas);
        Assert.Equal(1, r.BoletasActualizadas);
        Assert.Single(detalles);
        Assert.Equal(290m, detalles[0].Monto);
        Assert.Equal(290m, boleta.TotalIngresos);
    }

    [Theory]
    [InlineData("FIN_MES", "ABIERTO")]
    [InlineData("EXTRA", "CERRADO")]
    public async Task EmitirAguinaldo_rechazaPeriodoNoExtraOCerrado(string tipoPeriodo, string estado)
    {
        using var db = NuevoContexto();
        SembrarConceptos(db);
        var periodo = new PeriodoPago { Anio = 2026, Mes = 12, Tipo = tipoPeriodo,
            FechaInicio = new(2026, 12, 1), FechaFin = new(2026, 12, 31), Estado = estado };
        db.PeriodosPago.Add(periodo);
        db.SaveChanges();

        var svc = new NominaService(db);
        var ex = await Assert.ThrowsAsync<NominaException>(() =>
            svc.EmitirAguinaldoAsync(new EmitirAguinaldoRequest("AGUINALDO", 2026, periodo.PeriodoPagoId)));

        Assert.True(ex.Conflict);
    }

    // ---- Cerrar período: validaciones ----
    private static (CorpeturDbContext db, NominaService svc) ContextoFinMes(out Empleado emp, string estadoBoleta = "CALCULADA")
    {
        var db = NuevoContexto();
        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        emp = Empleado(1);
        db.Empleados.Add(emp);
        db.PeriodosPago.Add(new PeriodoPago { PeriodoPagoId = 1, Anio = 2026, Mes = 6, Tipo = "FIN_MES",
            FechaInicio = new(2026, 6, 16), FechaFin = new(2026, 6, 30), Estado = "CALCULADO" });
        db.SaveChanges();
        db.Boletas.Add(new Boleta { EmpleadoId = emp.EmpleadoId, PeriodoPagoId = 1, Estado = estadoBoleta });
        db.SaveChanges();
        return (db, new NominaService(db));
    }

    [Fact]
    public async Task Cerrar_correcto_marcaPagadaYCerrado()
    {
        var (db, svc) = ContextoFinMes(out _);
        using (db)
        {
            await svc.CerrarAsync(1);
            var per = await db.PeriodosPago.FindAsync(1);
            Assert.Equal("CERRADO", per!.Estado);
            Assert.NotNull(per.FechaPago);
            Assert.All(await db.Boletas.ToListAsync(), b => Assert.Equal("PAGADA", b.Estado));
        }
    }

    [Fact]
    public async Task Cerrar_conBorrador_lanzaConflicto()
    {
        var (db, svc) = ContextoFinMes(out _, estadoBoleta: "BORRADOR");
        using (db)
        {
            var ex = await Assert.ThrowsAsync<NominaException>(() => svc.CerrarAsync(1));
            Assert.True(ex.Conflict);
        }
    }

    [Fact]
    public async Task Cerrar_conColaboradorSinBoleta_lanzaConflicto()
    {
        var (db, svc) = ContextoFinMes(out _);
        using (db)
        {
            // Un segundo colaborador de planilla SIN boleta en el período.
            db.Empleados.Add(Empleado(1));
            db.SaveChanges();
            var ex = await Assert.ThrowsAsync<NominaException>(() => svc.CerrarAsync(1));
            Assert.True(ex.Conflict);
        }
    }
}
