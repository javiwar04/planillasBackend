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
                var otrasBon = Sum(c => c == "BONO_OTRO");
                var comisiones = Sum(c => c == "COMISION");
                var propinas = Sum(c => c.Contains("PROPINA"));
                var aguinaldo = Sum(c => c.Contains("AGUINALDO"));
                var bono14 = Sum(c => c.Contains("BONO14") || c.Contains("BONO_14"));
                var igss = Sum(c => c == "IGSS");

                // Lo demás de naturaleza INGRESO que no encajó en una casilla.
                var clasificados = new HashSet<string> { "SUELDO", "HORAS_EXTRA", "BONO_INC", "BONO_OTRO", "COMISION" };
                var otros = g.Where(x =>
                {
                    var c = x.Codigo.ToUpperInvariant();
                    if (x.Naturaleza != "INGRESO") return false;
                    if (clasificados.Contains(c)) return false;
                    if (c.Contains("PROPINA") || c.Contains("AGUINALDO") || c.Contains("BONO14") || c.Contains("BONO_14")) return false;
                    return true;
                }).Sum(x => x.Monto);

                return new DeclaracionAnualDto(
                    g.Key, first.Nombre, first.Nit, first.Establecimiento,
                    sueldos, horas, bonoDecreto, otrasBon, comisiones, propinas,
                    aguinaldo, bono14, otros, igss);
            })
            .OrderBy(f => f.Nombre)
            .ToList();

        return Ok(filas);
    }
}
