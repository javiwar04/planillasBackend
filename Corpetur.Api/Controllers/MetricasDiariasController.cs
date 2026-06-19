using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MetricasDiariasController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public MetricasDiariasController(CorpeturDbContext db) => _db = db;

    // GET /api/metricasdiarias?establecimientoId=1&desde=2026-06-01&hasta=2026-06-15&tipo=VENTA
    [HttpGet]
    public async Task<ActionResult<IEnumerable<MetricaDiariaDto>>> GetAll(
        [FromQuery] int? establecimientoId,
        [FromQuery] DateOnly? desde,
        [FromQuery] DateOnly? hasta,
        [FromQuery] string? tipo)
    {
        var q = _db.MetricasDiarias.AsNoTracking().Include(m => m.Establecimiento).AsQueryable();
        if (establecimientoId is not null) q = q.Where(m => m.EstablecimientoId == establecimientoId);
        if (desde is not null) q = q.Where(m => m.Fecha >= desde);
        if (hasta is not null) q = q.Where(m => m.Fecha <= hasta);
        if (tipo is "VENTA" or "OCUPACION") q = q.Where(m => m.TipoMetrica == tipo);
        var entities = await q.OrderByDescending(m => m.Fecha).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<MetricaDiariaDto>> Get(int id)
    {
        var m = await _db.MetricasDiarias.AsNoTracking().Include(x => x.Establecimiento)
            .FirstOrDefaultAsync(x => x.MetricaDiariaId == id);
        return m is null ? NotFound() : ToDto(m);
    }

    [HttpPost]
    public async Task<ActionResult<MetricaDiariaDto>> Create(MetricaDiariaCreateDto dto)
    {
        if (!await _db.Establecimientos.AnyAsync(e => e.EstablecimientoId == dto.EstablecimientoId))
            return BadRequest("El establecimiento no existe.");
        if (dto.TipoMetrica is not ("VENTA" or "OCUPACION"))
            return BadRequest("TipoMetrica debe ser 'VENTA' o 'OCUPACION'.");
        // Unicidad por establecimiento + fecha + tipo + categoría (UQ_Metrica).
        if (await _db.MetricasDiarias.AnyAsync(x => x.EstablecimientoId == dto.EstablecimientoId
                && x.Fecha == dto.Fecha && x.TipoMetrica == dto.TipoMetrica && x.Categoria == dto.Categoria))
            return Conflict("Ya existe una métrica para ese establecimiento, fecha, tipo y categoría.");

        var m = new MetricaDiaria
        {
            EstablecimientoId = dto.EstablecimientoId, Fecha = dto.Fecha,
            TipoMetrica = dto.TipoMetrica, Categoria = dto.Categoria, Valor = dto.Valor
        };
        _db.MetricasDiarias.Add(m);
        await _db.SaveChangesAsync();
        await _db.Entry(m).Reference(x => x.Establecimiento).LoadAsync();
        return CreatedAtAction(nameof(Get), new { id = m.MetricaDiariaId }, ToDto(m));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, MetricaDiariaCreateDto dto)
    {
        var m = await _db.MetricasDiarias.FindAsync(id);
        if (m is null) return NotFound();
        if (dto.TipoMetrica is not ("VENTA" or "OCUPACION"))
            return BadRequest("TipoMetrica debe ser 'VENTA' o 'OCUPACION'.");
        if (await _db.MetricasDiarias.AnyAsync(x => x.MetricaDiariaId != id
                && x.EstablecimientoId == dto.EstablecimientoId
                && x.Fecha == dto.Fecha && x.TipoMetrica == dto.TipoMetrica && x.Categoria == dto.Categoria))
            return Conflict("Ya existe otra métrica para ese establecimiento, fecha, tipo y categoría.");

        m.EstablecimientoId = dto.EstablecimientoId; m.Fecha = dto.Fecha;
        m.TipoMetrica = dto.TipoMetrica; m.Categoria = dto.Categoria; m.Valor = dto.Valor;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Dato de captura diaria: se borra físicamente para corregir errores de captura.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var m = await _db.MetricasDiarias.FindAsync(id);
        if (m is null) return NotFound();
        _db.MetricasDiarias.Remove(m);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static MetricaDiariaDto ToDto(MetricaDiaria m) => new(
        m.MetricaDiariaId, m.EstablecimientoId, m.Establecimiento?.Nombre,
        m.Fecha, m.TipoMetrica, m.Categoria, m.Valor);
}
