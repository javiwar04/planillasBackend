using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Services;

/// <summary>
/// Error de regla de negocio. El controlador lo traduce a 400 (BadRequest) o,
/// si <see cref="Conflict"/> es true, a 409 (Conflict).
/// </summary>
public class NominaException : Exception
{
    public bool Conflict { get; }
    public NominaException(string message, bool conflict = false) : base(message) => Conflict = conflict;
}

/// <summary>
/// Motor de cálculo de boletas (bloque 3). Reglas confirmadas con el cliente:
///  - QUINCENA: cada empleado de PLANILLA recibe un anticipo fijo (Empleado.MontoQuincena,
///    con override puntual). Es solo el adelanto, sin descuentos. Los EXTRA no llevan quincena.
///  - FIN_MES: ingreso = sueldo base del mes; se descuenta el IGSS laboral (auto, sobre el
///    sueldo base) y el anticipo realmente pagado en la(s) quincena(s) del mismo mes
///    (leído de las boletas de quincena, no asumido). Comisiones, ISR, préstamos y otros
///    descuentos son líneas manuales (se capturan aparte; ver reparto de comisión).
///  - PROVISIONES (pasivo laboral): indemnización/bono14/aguinaldo/vacaciones + IGSS patronal +
///    INTECAP, todo sobre el sueldo base, con las tasas de ParametroNomina.
/// Todas las tasas se leen de ParametroNomina (no quemadas); aquí solo van los defaults
/// de respaldo por si falta la fila.
/// </summary>
public class NominaService
{
    private readonly CorpeturDbContext _db;
    public NominaService(CorpeturDbContext db) => _db = db;

    // Códigos de concepto que genera/gestiona el motor (las líneas "automáticas").
    // Al regenerar se reemplazan estas y se respetan las líneas manuales.
    private const string COD_ANTICIPO_QUINCENA = "ANT_QUINCENA"; // INGRESO (boleta de quincena)
    private const string COD_SUELDO = "SUELDO";                  // INGRESO (fin de mes)
    private const string COD_BONO = "BONO_INC";                  // INGRESO (fin de mes: bonificación fija)
    private const string COD_IGSS = "IGSS";                      // EGRESO  (fin de mes)
    private const string COD_ANTICIPO = "ANTICIPO";              // EGRESO  (fin de mes: anticipo de quincena)
    private const string COD_COMISION = "COMISION";              // INGRESO (reparto de comisión)
    private const string COD_AGUINALDO = "AGUINALDO";            // INGRESO (pago especial)
    private const string COD_BONO14 = "BONO14";                  // INGRESO (pago especial)

    private static readonly string[] ManejadosQuincena = { COD_ANTICIPO_QUINCENA };
    private static readonly string[] ManejadosFinMes = { COD_SUELDO, COD_BONO, COD_IGSS, COD_ANTICIPO };

    // ========================================================================
    //  GENERAR BOLETAS DE UN PERÍODO
    // ========================================================================
    public async Task<GenerarResultadoDto> GenerarAsync(int periodoId, GenerarPeriodoRequest? req)
    {
        var periodo = await _db.PeriodosPago.FindAsync(periodoId)
            ?? throw new KeyNotFoundException("Período no encontrado.");
        if (periodo.Estado == "CERRADO")
            throw new NominaException("El período está CERRADO; no se puede regenerar.", conflict: true);
        if (periodo.Tipo is not ("QUINCENA" or "FIN_MES"))
            throw new NominaException("Un pago especial no se genera automáticamente; usa el reparto de comisión o líneas manuales.", conflict: true);

        var empleados = await _db.Empleados
            .Where(e => e.Activo && e.Tipo == "PLANILLA")
            .ToListAsync();

        int creadas = 0, actualizadas = 0;

        if (periodo.Tipo == "QUINCENA")
        {
            var cAnt = await EnsureConceptoAsync(COD_ANTICIPO_QUINCENA,
                "Anticipo de quincena", "INGRESO", esCalculado: true, orden: 5);
            var overrides = (req?.OverridesQuincena ?? new())
                .ToDictionary(o => o.EmpleadoId, o => o.Monto);

            foreach (var emp in empleados)
            {
                var (boleta, nueva) = await GetOrCreateBoletaAsync(emp.EmpleadoId, periodoId);
                if (nueva) creadas++; else actualizadas++;
                ReemplazarLineasManejadas(boleta, ManejadosQuincena);

                var monto = overrides.TryGetValue(emp.EmpleadoId, out var ov) ? ov : emp.MontoQuincena;
                AgregarLinea(boleta, cAnt, monto, "Anticipo de quincena");

                RecalcularTotales(boleta);
                boleta.Estado = "CALCULADA";
                boleta.ActualizadoEn = DateTime.UtcNow;
            }
        }
        else // FIN_MES
        {
            var cSueldo = await GetConceptoAsync(COD_SUELDO);
            var cBono = await GetConceptoAsync(COD_BONO);
            var cIgss = await GetConceptoAsync(COD_IGSS);
            var cAnt = await GetConceptoAsync(COD_ANTICIPO);
            var tasaIgss = await GetTasaAsync("IGSS_LABORAL", 4.83m) / 100m;

            foreach (var emp in empleados)
            {
                var (boleta, nueva) = await GetOrCreateBoletaAsync(emp.EmpleadoId, periodoId);
                if (nueva) creadas++; else actualizadas++;
                ReemplazarLineasManejadas(boleta, ManejadosFinMes);

                // Ingreso: sueldo base del mes.
                AgregarLinea(boleta, cSueldo, emp.SueldoBase, "Sueldo base");

                // Ingreso: bonificación mensual fija (incentivo Dto. 37-2001 + lo que la empresa decida).
                if (emp.Bonificacion > 0)
                    AgregarLinea(boleta, cBono, emp.Bonificacion, "Bonificación Ley 37-2001");

                // Egreso: IGSS laboral sobre el sueldo base (la bonificación va exenta).
                var igss = Math.Round(emp.SueldoBase * tasaIgss, 2, MidpointRounding.AwayFromZero);
                if (igss > 0) AgregarLinea(boleta, cIgss, igss, "IGSS laboral");

                // Egreso: anticipo realmente pagado en la(s) quincena(s) del mismo mes.
                var anticipo = await AnticipoQuincenaDelMesAsync(emp.EmpleadoId, periodo.Anio, periodo.Mes);
                if (anticipo > 0)
                    AgregarLinea(boleta, cAnt, anticipo, $"Anticipo quincena {periodo.Mes}/{periodo.Anio}");

                RecalcularTotales(boleta);
                boleta.Estado = "CALCULADA";
                boleta.ActualizadoEn = DateTime.UtcNow;
            }
        }

        if (periodo.Estado == "ABIERTO") periodo.Estado = "CALCULADO";
        await _db.SaveChangesAsync();

        return new GenerarResultadoDto(periodo.PeriodoPagoId, periodo.Tipo, periodo.Estado,
            creadas, actualizadas, empleados.Count);
    }

    // Suma el líquido de las boletas de QUINCENA del empleado en ese mes/año.
    private async Task<decimal> AnticipoQuincenaDelMesAsync(int empleadoId, int anio, byte mes)
    {
        var liquidos = await _db.Boletas
            .Where(b => b.EmpleadoId == empleadoId
                     && b.PeriodoPago!.Tipo == "QUINCENA"
                     && b.PeriodoPago.Anio == anio
                     && b.PeriodoPago.Mes == mes)
            .Select(b => b.Liquido)
            .ToListAsync();
        return liquidos.Sum();
    }

    // ========================================================================
    //  REPARTO DE COMISIÓN POR ESTABLECIMIENTO
    // ========================================================================
    public async Task<RepartoResultadoDto> RepartirComisionAsync(RepartoComisionRequest req)
    {
        if (req.MontoTotal <= 0)
            throw new NominaException("El monto total a repartir debe ser mayor a cero.");
        var modo = (req.Modo ?? "IGUAL").ToUpperInvariant();
        if (modo is not ("IGUAL" or "PESO"))
            throw new NominaException("Modo debe ser 'IGUAL' o 'PESO'.");

        var periodo = await _db.PeriodosPago.FindAsync(req.PeriodoPagoId)
            ?? throw new KeyNotFoundException("Período no encontrado.");
        if (periodo.Estado == "CERRADO")
            throw new NominaException("El período está CERRADO; no se puede repartir comisión.", conflict: true);

        // El establecimiento es opcional cuando se manda una lista explícita de empleados
        // (puede haber gente de varios establecimientos, p. ej. restaurante + administración).
        Establecimiento? estab = req.EstablecimientoId is not null
            ? await _db.Establecimientos.FindAsync(req.EstablecimientoId.Value)
                ?? throw new KeyNotFoundException("Establecimiento no encontrado.")
            : null;

        var concepto = req.ConceptoId is not null
            ? await _db.Conceptos.FindAsync(req.ConceptoId.Value)
                ?? throw new NominaException("El concepto indicado no existe.")
            : await GetConceptoAsync(COD_COMISION);
        if (concepto.Naturaleza != "INGRESO")
            throw new NominaException("El concepto de comisión debe ser de naturaleza INGRESO.");
        if (!EsConceptoReparto(concepto.Codigo))
            throw new NominaException("El reparto solo acepta conceptos de comisión o propina. Aguinaldo y Bono 14 se emiten desde su módulo.");

        // Determinar empleados destino y su peso.
        List<(Empleado emp, decimal peso)> destino;
        if (req.Empleados is { Count: > 0 })
        {
            destino = new();
            foreach (var item in req.Empleados)
            {
                var emp = await _db.Empleados.FindAsync(item.EmpleadoId)
                    ?? throw new NominaException($"Empleado {item.EmpleadoId} no existe.");
                if (!emp.Activo) throw new NominaException($"Empleado {emp.Nombres} {emp.Apellidos} está inactivo.");
                var peso = modo == "PESO" ? (item.Peso ?? 0m) : 1m;
                if (modo == "PESO" && peso <= 0)
                    throw new NominaException($"En modo PESO cada empleado necesita un peso > 0 (empleado {item.EmpleadoId}).");
                destino.Add((emp, peso));
            }
        }
        else
        {
            if (req.EstablecimientoId is null)
                throw new NominaException("Indica un establecimiento o una lista de empleados.");
            var emps = await _db.Empleados
                .Where(e => e.Activo && e.Tipo == "PLANILLA" && e.EstablecimientoId == req.EstablecimientoId)
                .OrderBy(e => e.Apellidos).ThenBy(e => e.Nombres)
                .ToListAsync();
            if (emps.Count == 0)
                throw new NominaException("El establecimiento no tiene empleados de planilla activos.");
            if (modo == "PESO")
                throw new NominaException("El modo PESO requiere la lista de empleados con su peso.");
            destino = emps.Select(e => (e, 1m)).ToList();
        }

        var sumaPesos = destino.Sum(d => d.peso);
        if (sumaPesos <= 0) throw new NominaException("La suma de pesos debe ser mayor a cero.");

        var desc = string.IsNullOrWhiteSpace(req.Descripcion)
            ? (estab is not null ? $"Comisión {periodo.Mes}/{periodo.Anio} - {estab.Nombre}" : $"Comisión {periodo.Mes}/{periodo.Anio}")
            : req.Descripcion!.Trim();

        // Calcular montos con redondeo a 2 decimales; el último absorbe el residuo
        // para que la suma cuadre EXACTO con el total.
        var resultado = new List<RepartoResultadoItemDto>();
        decimal acumulado = 0m;
        for (int i = 0; i < destino.Count; i++)
        {
            var (emp, peso) = destino[i];
            decimal monto = i < destino.Count - 1
                ? Math.Round(req.MontoTotal * peso / sumaPesos, 2, MidpointRounding.AwayFromZero)
                : req.MontoTotal - acumulado;
            acumulado += monto;

            var (boleta, _) = await GetOrCreateBoletaAsync(emp.EmpleadoId, req.PeriodoPagoId);
            // Reemplaza una línea previa del mismo reparto (mismo concepto + misma descripción).
            QuitarLineas(boleta, d => d.ConceptoId == concepto.ConceptoId && d.Descripcion == desc);
            AgregarLinea(boleta, concepto, monto, desc);
            RecalcularTotales(boleta);
            if (boleta.Estado == "BORRADOR") boleta.Estado = "CALCULADA";
            boleta.ActualizadoEn = DateTime.UtcNow;

            resultado.Add(new RepartoResultadoItemDto(emp.EmpleadoId, $"{emp.Nombres} {emp.Apellidos}", monto));
        }

        await _db.SaveChangesAsync();
        return new RepartoResultadoDto(req.MontoTotal, acumulado, resultado.Count, resultado);
    }

    // ========================================================================
    //  EMISION DE AGUINALDO / BONO 14 COMO PAGO ESPECIAL
    // ========================================================================
    public async Task<EmitirAguinaldoResultadoDto> EmitirAguinaldoAsync(EmitirAguinaldoRequest req)
    {
        var tipo = (req.Tipo ?? "").ToUpperInvariant();
        if (tipo is not (COD_AGUINALDO or COD_BONO14))
            throw new NominaException("Tipo debe ser 'AGUINALDO' o 'BONO14'.");
        if (req.Anio is < 2000 or > 2100)
            throw new NominaException("Año fuera de rango.");

        var periodo = await _db.PeriodosPago.FindAsync(req.PeriodoPagoId)
            ?? throw new KeyNotFoundException("Período no encontrado.");
        if (periodo.Tipo != "EXTRA")
            throw new NominaException("El Aguinaldo / Bono 14 debe emitirse en un período EXTRA.", conflict: true);
        if (periodo.Estado == "CERRADO")
            throw new NominaException("El período está CERRADO; no se puede emitir el pago.", conflict: true);

        var concepto = await GetConceptoAsync(tipo);
        if (concepto.Naturaleza != "INGRESO")
            throw new NominaException($"El concepto '{tipo}' debe ser de naturaleza INGRESO.");

        var (inicio, fin) = CicloAguinaldo(tipo, req.Anio);
        var empleados = await _db.Empleados
            .Where(e => e.Activo && e.Tipo == "PLANILLA")
            .OrderBy(e => e.Apellidos).ThenBy(e => e.Nombres)
            .ToListAsync();

        int creadas = 0, actualizadas = 0, boletas = 0;
        decimal total = 0m;
        var descripcion = tipo == COD_AGUINALDO ? $"Aguinaldo {req.Anio}" : $"Bono 14 {req.Anio}";

        foreach (var emp in empleados)
        {
            var dias = DiasEnCiclo(emp, inicio, fin);
            var monto = Math.Round(emp.SueldoBase * dias / 365m, 2, MidpointRounding.AwayFromZero);
            if (monto <= 0) continue;

            var (boleta, nueva) = await GetOrCreateBoletaAsync(emp.EmpleadoId, req.PeriodoPagoId);
            if (nueva) creadas++; else actualizadas++;

            QuitarLineas(boleta, d => d.ConceptoId == concepto.ConceptoId);
            AgregarLinea(boleta, concepto, monto, descripcion);
            RecalcularTotales(boleta);
            boleta.Estado = "CALCULADA";
            boleta.ActualizadoEn = DateTime.UtcNow;

            boletas++;
            total += monto;
        }

        await _db.SaveChangesAsync();
        return new EmitirAguinaldoResultadoDto(
            periodo.PeriodoPagoId, tipo, req.Anio, boletas, creadas, actualizadas, total);
    }

    // ========================================================================
    //  PROVISIONES (PASIVO LABORAL) PARA EL MES DEL PERÍODO
    // ========================================================================
    public async Task<ProvisionesResultadoDto> GenerarProvisionesAsync(int periodoId)
    {
        var periodo = await _db.PeriodosPago.FindAsync(periodoId)
            ?? throw new KeyNotFoundException("Período no encontrado.");

        var tIndem = await GetTasaAsync("INDEMNIZACION", 8.33m) / 100m;
        var tBono14 = await GetTasaAsync("BONO14", 8.33m) / 100m;
        var tAgui = await GetTasaAsync("AGUINALDO", 8.33m) / 100m;
        var tVac = await GetTasaAsync("VACACIONES", 4.17m) / 100m;
        var tPatr = await GetTasaAsync("IGSS_PATRONAL", 10.67m) / 100m;
        var tIntecap = await GetTasaAsync("INTECAP", 1.00m) / 100m;

        var empleados = await _db.Empleados
            .Where(e => e.Activo && e.Tipo == "PLANILLA")
            .ToListAsync();

        int generadas = 0, actualizadas = 0;
        decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

        foreach (var emp in empleados)
        {
            var prov = await _db.ProvisionesLaboral
                .FirstOrDefaultAsync(p => p.EmpleadoId == emp.EmpleadoId
                    && p.Anio == periodo.Anio && p.Mes == periodo.Mes);
            var nueva = prov is null;
            if (nueva)
            {
                prov = new ProvisionLaboral { EmpleadoId = emp.EmpleadoId, Anio = periodo.Anio, Mes = periodo.Mes };
                _db.ProvisionesLaboral.Add(prov);
                generadas++;
            }
            else actualizadas++;

            var b = emp.SueldoBase;
            prov!.BaseCalculo = b;
            prov.Indemnizacion = R(b * tIndem);
            prov.Bono14 = R(b * tBono14);
            prov.Aguinaldo = R(b * tAgui);
            prov.Vacaciones = R(b * tVac);
            prov.IgssPatronal = R(b * tPatr);
            prov.Intecap = R(b * tIntecap);
        }

        await _db.SaveChangesAsync();
        return new ProvisionesResultadoDto(periodo.Anio, periodo.Mes, generadas, actualizadas);
    }

    // ========================================================================
    //  CERRAR PERÍODO (inmutable)
    // ========================================================================
    public async Task CerrarAsync(int periodoId)
    {
        var periodo = await _db.PeriodosPago
            .Include(p => p.Boletas)
            .FirstOrDefaultAsync(p => p.PeriodoPagoId == periodoId)
            ?? throw new KeyNotFoundException("Período no encontrado.");
        if (periodo.Estado == "CERRADO")
            throw new NominaException("El período ya está CERRADO.", conflict: true);

        // Validaciones de cierre: no cerrar incompleto.
        if (periodo.Boletas.Count == 0)
            throw new NominaException("El período no tiene boletas que cerrar.", conflict: true);

        var borradores = periodo.Boletas.Count(b => b.Estado == "BORRADOR");
        if (borradores > 0)
            throw new NominaException($"Hay {borradores} boleta(s) en BORRADOR. Genera o calcula antes de cerrar.", conflict: true);

        // En quincena/fin de mes deben estar TODOS los de planilla activos.
        if (periodo.Tipo is "QUINCENA" or "FIN_MES")
        {
            var conBoleta = periodo.Boletas.Select(b => b.EmpleadoId).ToHashSet();
            var faltan = await _db.Empleados
                .CountAsync(e => e.Activo && e.Tipo == "PLANILLA" && !conBoleta.Contains(e.EmpleadoId));
            if (faltan > 0)
                throw new NominaException($"Faltan {faltan} colaborador(es) de planilla sin boleta. Vuelve a generar el período antes de cerrar.", conflict: true);
        }

        foreach (var b in periodo.Boletas) b.Estado = "PAGADA";
        periodo.Estado = "CERRADO";
        periodo.FechaPago ??= DateOnly.FromDateTime(DateTime.Today);
        await _db.SaveChangesAsync();
    }

    // ========================================================================
    //  REABRIR PERÍODO (corrección antes de pagar)
    // ========================================================================
    public async Task ReabrirAsync(int periodoId)
    {
        var periodo = await _db.PeriodosPago
            .Include(p => p.Boletas)
            .FirstOrDefaultAsync(p => p.PeriodoPagoId == periodoId)
            ?? throw new KeyNotFoundException("Período no encontrado.");
        if (periodo.Estado != "CERRADO")
            throw new NominaException("Solo se puede reabrir un período CERRADO.", conflict: true);

        foreach (var b in periodo.Boletas)
            if (b.Estado == "PAGADA") b.Estado = "CALCULADA";
        periodo.Estado = "CALCULADO";
        periodo.FechaPago = null;
        await _db.SaveChangesAsync();
    }

    // ========================================================================
    //  HELPERS COMPARTIDOS
    // ========================================================================

    private static (DateOnly inicio, DateOnly fin) CicloAguinaldo(string tipo, int anio)
        => tipo == COD_AGUINALDO
            ? (new DateOnly(anio - 1, 12, 1), new DateOnly(anio, 11, 30))
            : (new DateOnly(anio - 1, 7, 1), new DateOnly(anio, 6, 30));

    private static int DiasEnCiclo(Empleado emp, DateOnly inicio, DateOnly fin)
    {
        var desde = emp.FechaIngreso is { } ingreso && ingreso > inicio ? ingreso : inicio;
        var hasta = emp.FechaBaja is { } baja && baja < fin ? baja : fin;
        return Math.Max(0, hasta.DayNumber - desde.DayNumber);
    }

    private static bool EsConceptoReparto(string codigo)
    {
        var c = codigo.ToUpperInvariant();
        return c == COD_COMISION || c.Contains("PROPINA");
    }

    /// <summary>Recalcula TotalIngresos/TotalEgresos desde las líneas (Concepto debe estar cargado).</summary>
    public static void RecalcularTotales(Boleta boleta)
    {
        decimal ingresos = 0m, egresos = 0m;
        foreach (var d in boleta.Detalles)
        {
            var nat = d.Concepto?.Naturaleza
                ?? throw new InvalidOperationException("Línea de boleta sin Concepto cargado.");
            if (nat == "INGRESO") ingresos += d.Monto; else egresos += d.Monto;
        }
        boleta.TotalIngresos = ingresos;
        boleta.TotalEgresos = egresos;
    }

    private async Task<(Boleta boleta, bool nueva)> GetOrCreateBoletaAsync(int empleadoId, int periodoId)
    {
        var boleta = await _db.Boletas
            .Include(b => b.Detalles).ThenInclude(d => d.Concepto)
            .FirstOrDefaultAsync(b => b.EmpleadoId == empleadoId && b.PeriodoPagoId == periodoId);
        if (boleta is not null)
        {
            if (boleta.Estado == "PAGADA")
                throw new NominaException("La boleta ya está PAGADA y no puede modificarse.", conflict: true);
            return (boleta, false);
        }
        boleta = new Boleta
        {
            EmpleadoId = empleadoId, PeriodoPagoId = periodoId, Estado = "BORRADOR",
            Detalles = new List<BoletaDetalle>()
        };
        _db.Boletas.Add(boleta);
        return (boleta, true);
    }

    private void AgregarLinea(Boleta boleta, Concepto concepto, decimal monto, string? descripcion)
    {
        var linea = new BoletaDetalle
        {
            ConceptoId = concepto.ConceptoId, Concepto = concepto,
            Monto = monto, Descripcion = descripcion
        };
        boleta.Detalles.Add(linea);
    }

    // Quita las líneas cuyo concepto (por código) está en la lista de manejadas.
    private void ReemplazarLineasManejadas(Boleta boleta, string[] codigos)
        => QuitarLineas(boleta, d => d.Concepto != null && codigos.Contains(d.Concepto.Codigo));

    private void QuitarLineas(Boleta boleta, Func<BoletaDetalle, bool> pred)
    {
        var quitar = boleta.Detalles.Where(pred).ToList();
        foreach (var d in quitar)
        {
            boleta.Detalles.Remove(d);
            if (d.BoletaDetalleId != 0) _db.BoletaDetalles.Remove(d);
        }
    }

    private async Task<Concepto> GetConceptoAsync(string codigo)
        => await _db.Conceptos.FirstOrDefaultAsync(c => c.Codigo == codigo)
           ?? throw new NominaException($"Falta el concepto '{codigo}' en el catálogo.");

    private async Task<Concepto> EnsureConceptoAsync(string codigo, string nombre, string naturaleza,
        bool esCalculado, int orden)
    {
        var c = await _db.Conceptos.FirstOrDefaultAsync(x => x.Codigo == codigo);
        if (c is not null) return c;
        c = new Concepto
        {
            Codigo = codigo, Nombre = nombre, Naturaleza = naturaleza,
            EsCalculado = esCalculado, Orden = orden, Activo = true
        };
        _db.Conceptos.Add(c);
        await _db.SaveChangesAsync();
        return c;
    }

    // Lee una tasa (en PUNTOS PORCENTUALES) de ParametroNomina; usa el default si falta.
    private async Task<decimal> GetTasaAsync(string clave, decimal porDefecto)
    {
        var p = await _db.ParametrosNomina.FindAsync(clave);
        return p?.Valor ?? porDefecto;
    }
}
