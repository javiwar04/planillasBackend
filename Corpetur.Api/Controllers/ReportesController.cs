using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportesController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public ReportesController(CorpeturDbContext db) => _db = db;

    // Declaración Jurada Anual (formato SAT): por cada colaborador de PLANILLA,
    // acumula lo pagado en el año (todas las boletas de períodos de ese año) y lo
    // reparte por casilla — sueldos, horas extra, bonificación incentivo, otras
    // bonificaciones, comisiones, propinas, aguinaldo, bono 14, IGSS laboral.
    // El bucket sale del código del concepto; lo no clasificado de tipo INGRESO
    // cae en "Otros ingresos". Los egresos (anticipos, préstamos, etc.) no entran,
    // salvo el IGSS laboral que la declaración sí reporta aparte.
    // GET /api/reportes/declaracion-anual?anio=2025
    [HttpGet("declaracion-anual")]
    public async Task<ActionResult<IEnumerable<DeclaracionAnualDto>>> DeclaracionAnual([FromQuery] int anio)
    {
        if (anio < 2000 || anio > 2100) return BadRequest("Año fuera de rango.");

        // Una fila por (empleado, concepto) con el monto del año. Se agrupa luego
        // en memoria por empleado para armar las casillas.
        var lineas = await _db.BoletaDetalles.AsNoTracking()
            .Where(d => d.Boleta!.PeriodoPago!.Anio == anio && d.Boleta.Empleado!.Tipo == "PLANILLA")
            .Select(d => new
            {
                d.Boleta!.EmpleadoId,
                Nombre = d.Boleta.Empleado!.Nombres + " " + d.Boleta.Empleado.Apellidos,
                d.Boleta.Empleado.Nit,
                Establecimiento = d.Boleta.Empleado.Establecimiento!.Nombre,
                Codigo = d.Concepto!.Codigo,
                Naturaleza = d.Concepto.Naturaleza,
                d.Monto,
            })
            .ToListAsync();

        var filas = lineas
            .GroupBy(l => l.EmpleadoId)
            .Select(g =>
            {
                var first = g.First();
                decimal Sum(Func<string, bool> match) => g.Where(x => match(x.Codigo.ToUpperInvariant())).Sum(x => x.Monto);

                var sueldos = Sum(c => c == "SUELDO");
                var horas = Sum(c => c == "HORAS_EXTRA");
                var bonoDecreto = Sum(c => c == "BONO_INC");
                var otrasBon = Sum(c => c == "BONO_OTRO" || c == "BONO_FIJA");
                var comisiones = Sum(c => c == "COMISION");
                var propinas = Sum(c => c.Contains("PROPINA"));
                var aguinaldo = Sum(c => c.Contains("AGUINALDO"));
                var bono14 = Sum(c => c.Contains("BONO14") || c.Contains("BONO_14"));
                var viaticos = Sum(c => c == "VIATICOS");
                var gastoRep = Sum(c => c == "GASTO_REP");
                var dietas = Sum(c => c == "DIETAS");
                var gratific = Sum(c => c == "GRATIFIC");
                var igss = Sum(c => c == "IGSS");

                // Conceptos que NO son ingreso declarable aunque estén como INGRESO:
                // el anticipo de quincena es solo un adelanto del sueldo (ya contado en
                // SUELDO del fin de mes); contarlo otra vez infla la declaración.
                var noDeclarables = new HashSet<string> { "ANT_QUINCENA" };

                // Lo demás de naturaleza INGRESO que no encajó en una casilla.
                var clasificados = new HashSet<string>
                {
                    "SUELDO", "HORAS_EXTRA", "BONO_INC", "BONO_OTRO", "BONO_FIJA", "COMISION",
                    "VIATICOS", "GASTO_REP", "DIETAS", "GRATIFIC",
                };
                var otros = g.Where(x =>
                {
                    var c = x.Codigo.ToUpperInvariant();
                    if (x.Naturaleza != "INGRESO") return false;
                    if (noDeclarables.Contains(c)) return false;
                    if (clasificados.Contains(c)) return false;
                    if (c.Contains("PROPINA") || c.Contains("AGUINALDO") || c.Contains("BONO14") || c.Contains("BONO_14")) return false;
                    return true;
                }).Sum(x => x.Monto);

                return new DeclaracionAnualDto(
                    g.Key, first.Nombre, first.Nit, first.Establecimiento,
                    sueldos, horas, bonoDecreto, otrasBon, comisiones, propinas,
                    aguinaldo, bono14, viaticos, gastoRep, dietas, gratific, otros, igss);
            })
            .OrderBy(f => f.Nombre)
            .ToList();

        return Ok(filas);
    }

    // Cuadre anual de ISR (Régimen de Asalariados, Dto. 10-2012).
    // GET /api/reportes/isr-anual?anio=2025&deduccion=48000
    // Renta gravada = ingresos del año EXCEPTO exentos (aguinaldo, bono 14, anticipo
    // de quincena). Renta neta = gravada − IGSS − deducción única. ISR del año por
    // tramos (5% hasta el límite; sobre el excedente, base + 7%). Diferencia = ISR del
    // año − ISR retenido: positiva = el colaborador paga; negativa = se le devuelve.
    [HttpGet("isr-anual")]
    public async Task<ActionResult<IEnumerable<IsrAnualDto>>> IsrAnual([FromQuery] int anio, [FromQuery] decimal? deduccion)
    {
        if (anio < 2000 || anio > 2100) return BadRequest("Año fuera de rango.");

        var p = await _db.ParametrosNomina.AsNoTracking().ToDictionaryAsync(x => x.Clave, x => x.Valor);
        decimal Par(string clave, decimal def) => p.TryGetValue(clave, out var v) ? v : def;
        var ded = deduccion ?? Par("ISR_DEDUCCION", 48000m);
        var tasa1 = Par("ISR_TASA1", 5m) / 100m;
        var limite1 = Par("ISR_TRAMO1_LIMITE", 300000m);
        var tasa2 = Par("ISR_TASA2", 7m) / 100m;
        var base2 = Par("ISR_TRAMO2_BASE", 15000m);

        // Conceptos exentos (no entran a la base gravable del ISR) y los descuentos
        // que necesitamos aparte.
        var exentos = new HashSet<string> { "ANT_QUINCENA", "AGUINALDO", "BONO14", "BONO_14" };

        var lineas = await _db.BoletaDetalles.AsNoTracking()
            .Where(d => d.Boleta!.PeriodoPago!.Anio == anio && d.Boleta.Empleado!.Tipo == "PLANILLA")
            .Select(d => new
            {
                d.Boleta!.EmpleadoId,
                Nombre = d.Boleta.Empleado!.Nombres + " " + d.Boleta.Empleado.Apellidos,
                d.Boleta.Empleado.Nit,
                Establecimiento = d.Boleta.Empleado.Establecimiento!.Nombre,
                DeduccionAdicional = d.Boleta.Empleado.IsrDeduccionAdicional,
                Codigo = d.Concepto!.Codigo,
                d.Concepto.Naturaleza,
                d.Monto,
            })
            .ToListAsync();

        decimal R(decimal v) => Math.Round(v, 2, MidpointRounding.AwayFromZero);

        var filas = lineas
            .GroupBy(l => l.EmpleadoId)
            .Select(g =>
            {
                var first = g.First();
                decimal gravada = 0m, igss = 0m, retenido = 0m;
                foreach (var x in g)
                {
                    var c = x.Codigo.ToUpperInvariant();
                    if (c == "IGSS") igss += x.Monto;
                    else if (c == "ISR") retenido += x.Monto;
                    else if (x.Naturaleza == "INGRESO" && !exentos.Contains(c)) gravada += x.Monto;
                }
                var dedAdic = first.DeduccionAdicional;
                var rentaNeta = Math.Max(0m, gravada - igss - ded - dedAdic);
                var isr = rentaNeta <= limite1
                    ? R(rentaNeta * tasa1)
                    : R(base2 + (rentaNeta - limite1) * tasa2);
                return new IsrAnualDto(g.Key, first.Nombre, first.Nit, first.Establecimiento,
                    R(gravada), R(igss), R(ded), R(dedAdic), rentaNeta, isr, R(retenido), R(isr - retenido));
            })
            .OrderBy(f => f.Nombre)
            .ToList();

        return Ok(filas);
    }
}
