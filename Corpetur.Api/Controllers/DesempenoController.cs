using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

// Gestión del desempeño: DATO SENSIBLE. Solo RRHH y ADMIN, tanto leer como escribir
// (la política se declara a nivel de controller, así que la convención de escritura
// no la pisa y el GET también queda restringido).
[Authorize(Policy = "RecursosHumanos")]
[ApiController]
[Route("api/[controller]")]
public class DesempenoController : ControllerBase
{
    private static readonly string[] Tipos = { "EVALUACION", "AMONESTACION", "FELICITACION", "PROMOCION", "CAPACITACION" };

    private readonly CorpeturDbContext _db;
    public DesempenoController(CorpeturDbContext db) => _db = db;

    // GET /api/desempeno?empleadoId=5
    [HttpGet]
    public async Task<ActionResult<IEnumerable<EventoDesempenoDto>>> GetAll([FromQuery] int? empleadoId)
    {
        var q = _db.EventosDesempeno.AsNoTracking().AsQueryable();
        if (empleadoId is not null) q = q.Where(x => x.EmpleadoId == empleadoId);
        var entities = await q.OrderByDescending(x => x.Fecha).ThenByDescending(x => x.EventoDesempenoId).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<EventoDesempenoDto>> Create(EventoDesempenoCreateDto dto)
    {
        if (!await _db.Empleados.AnyAsync(e => e.EmpleadoId == dto.EmpleadoId))
            return BadRequest("El empleado no existe.");
        var tipo = (dto.Tipo ?? "").ToUpperInvariant();
        if (!Tipos.Contains(tipo))
            return BadRequest("Tipo debe ser EVALUACION, AMONESTACION, FELICITACION, PROMOCION o CAPACITACION.");
        if (string.IsNullOrWhiteSpace(dto.Titulo))
            return BadRequest("El título es obligatorio.");

        var ev = new EventoDesempeno
        {
            EmpleadoId = dto.EmpleadoId, Fecha = dto.Fecha, Tipo = tipo,
            Titulo = dto.Titulo.Trim(),
            Detalle = string.IsNullOrWhiteSpace(dto.Detalle) ? null : dto.Detalle.Trim(),
            CreadoEn = DateTime.UtcNow,
        };
        _db.EventosDesempeno.Add(ev);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { empleadoId = ev.EmpleadoId }, ToDto(ev));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ev = await _db.EventosDesempeno.FindAsync(id);
        if (ev is null) return NotFound();
        _db.EventosDesempeno.Remove(ev);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static EventoDesempenoDto ToDto(EventoDesempeno e) =>
        new(e.EventoDesempenoId, e.EmpleadoId, e.Fecha, e.Tipo, e.Titulo, e.Detalle);
}
