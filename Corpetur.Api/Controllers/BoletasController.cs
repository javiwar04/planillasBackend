using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Corpetur.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BoletasController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public BoletasController(CorpeturDbContext db) => _db = db;

    private static readonly HashSet<string> PrestacionesLegales = new(StringComparer.OrdinalIgnoreCase)
    {
        "AGUINALDO", "BONO14", "BONO_14"
    };

    // GET /api/boletas?periodoId=3&empleadoId=5
    [HttpGet]
    public async Task<ActionResult<IEnumerable<BoletaListDto>>> GetAll(
        [FromQuery] int? periodoId, [FromQuery] int? empleadoId)
    {
        var q = _db.Boletas.AsNoTracking().Include(b => b.Empleado).AsQueryable();
        if (periodoId is not null) q = q.Where(b => b.PeriodoPagoId == periodoId);
        if (empleadoId is not null) q = q.Where(b => b.EmpleadoId == empleadoId);
        var entities = await q.OrderBy(b => b.Empleado!.Apellidos).ThenBy(b => b.Empleado!.Nombres).ToListAsync();
        return Ok(entities.Select(b => new BoletaListDto(
            b.BoletaId, b.EmpleadoId,
            b.Empleado is null ? "" : $"{b.Empleado.Nombres} {b.Empleado.Apellidos}",
            b.PeriodoPagoId, b.Estado, b.TotalIngresos, b.TotalEgresos, b.Liquido)).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<BoletaDto>> Get(int id)
    {
        var b = await _db.Boletas.AsNoTracking()
            .Include(x => x.Empleado)
            .Include(x => x.Detalles).ThenInclude(d => d.Concepto)
            .FirstOrDefaultAsync(x => x.BoletaId == id);
        return b is null ? NotFound() : ToDto(b);
    }

    // Agrega una línea manual (comisión, ISR, bonificación, préstamo, descuento...).
    [HttpPost("{id:int}/lineas")]
    public async Task<ActionResult<BoletaDto>> AgregarLinea(int id, BoletaLineaCreateDto dto)
    {
        var b = await CargarEditableAsync(id);
        if (b is null) return NotFound();

        var concepto = await _db.Conceptos.FindAsync(dto.ConceptoId);
        if (concepto is null) return BadRequest("El concepto no existe.");
        if (PrestacionesLegales.Contains(concepto.Codigo))
            return BadRequest("Aguinaldo y Bono 14 se emiten desde su módulo, no como línea manual.");

        var linea = new BoletaDetalle
        {
            BoletaId = b.BoletaId, ConceptoId = concepto.ConceptoId, Concepto = concepto,
            Monto = dto.Monto, Descripcion = dto.Descripcion
        };
        b.Detalles.Add(linea);
        NominaService.RecalcularTotales(b);
        b.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return await Get(b.BoletaId);
    }

    [HttpPut("{id:int}/lineas/{detalleId:int}")]
    public async Task<ActionResult<BoletaDto>> EditarLinea(int id, int detalleId, BoletaLineaCreateDto dto)
    {
        var b = await CargarEditableAsync(id);
        if (b is null) return NotFound();

        var linea = b.Detalles.FirstOrDefault(d => d.BoletaDetalleId == detalleId);
        if (linea is null) return NotFound("La línea no existe en esta boleta.");
        if (linea.Concepto is not null && PrestacionesLegales.Contains(linea.Concepto.Codigo))
            return BadRequest("Aguinaldo y Bono 14 se emiten desde su módulo, no como línea manual.");

        var concepto = await _db.Conceptos.FindAsync(dto.ConceptoId);
        if (concepto is null) return BadRequest("El concepto no existe.");
        if (PrestacionesLegales.Contains(concepto.Codigo))
            return BadRequest("Aguinaldo y Bono 14 se emiten desde su módulo, no como línea manual.");

        linea.ConceptoId = concepto.ConceptoId; linea.Concepto = concepto;
        linea.Monto = dto.Monto; linea.Descripcion = dto.Descripcion;
        NominaService.RecalcularTotales(b);
        b.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return await Get(b.BoletaId);
    }

    [HttpDelete("{id:int}/lineas/{detalleId:int}")]
    public async Task<IActionResult> BorrarLinea(int id, int detalleId)
    {
        var b = await CargarEditableAsync(id);
        if (b is null) return NotFound();

        var linea = b.Detalles.FirstOrDefault(d => d.BoletaDetalleId == detalleId);
        if (linea is null) return NotFound("La línea no existe en esta boleta.");
        if (linea.Concepto is not null && PrestacionesLegales.Contains(linea.Concepto.Codigo))
            return BadRequest("Aguinaldo y Bono 14 se emiten desde su módulo, no como línea manual.");

        b.Detalles.Remove(linea);
        _db.BoletaDetalles.Remove(linea);
        NominaService.RecalcularTotales(b);
        b.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id:int}/observaciones")]
    public async Task<IActionResult> Observaciones(int id, [FromBody] string? texto)
    {
        var b = await CargarEditableAsync(id);
        if (b is null) return NotFound();
        b.Observaciones = texto;
        b.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Carga la boleta con sus líneas; null si no existe. 409 si ya está PAGADA.
    private async Task<Boleta?> CargarEditableAsync(int id)
    {
        var b = await _db.Boletas
            .Include(x => x.Detalles).ThenInclude(d => d.Concepto)
            .FirstOrDefaultAsync(x => x.BoletaId == id);
        if (b is null) return null;
        if (b.Estado == "PAGADA")
            throw new NominaException("La boleta ya está PAGADA y no puede modificarse.", conflict: true);
        return b;
    }

    private static BoletaDto ToDto(Boleta b) => new(
        b.BoletaId, b.EmpleadoId,
        b.Empleado is null ? "" : $"{b.Empleado.Nombres} {b.Empleado.Apellidos}",
        b.PeriodoPagoId, b.Estado, b.TotalIngresos, b.TotalEgresos, b.Liquido, b.Observaciones,
        b.Detalles.OrderBy(d => d.Concepto!.Orden).Select(d => new BoletaDetalleDto(
            d.BoletaDetalleId, d.ConceptoId, d.Concepto!.Codigo, d.Concepto.Nombre,
            d.Concepto.Naturaleza, d.Monto, d.Descripcion, d.Concepto.EsCalculado, d.PrestamoMovimientoId)));
}
