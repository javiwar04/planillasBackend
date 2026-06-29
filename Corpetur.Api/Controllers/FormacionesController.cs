using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

// Perfil profesional del colaborador: idiomas, títulos, cursos, certificaciones y
// habilidades. Catálogo flexible (una fila por ítem), no columnas fijas.
[ApiController]
[Route("api/[controller]")]
public class FormacionesController : ControllerBase
{
    private static readonly string[] Tipos = { "IDIOMA", "TITULO", "CURSO", "CERTIFICACION", "HABILIDAD" };

    private readonly CorpeturDbContext _db;
    public FormacionesController(CorpeturDbContext db) => _db = db;

    // GET /api/formaciones?empleadoId=5
    [HttpGet]
    public async Task<ActionResult<IEnumerable<FormacionDto>>> GetAll([FromQuery] int? empleadoId)
    {
        var q = _db.Formaciones.AsNoTracking().AsQueryable();
        if (empleadoId is not null) q = q.Where(f => f.EmpleadoId == empleadoId);
        var entities = await q.OrderBy(f => f.Tipo).ThenBy(f => f.Descripcion).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<FormacionDto>> Create(FormacionCreateDto dto)
    {
        if (!await _db.Empleados.AnyAsync(e => e.EmpleadoId == dto.EmpleadoId))
            return BadRequest("El empleado no existe.");
        var tipo = (dto.Tipo ?? "").ToUpperInvariant();
        if (!Tipos.Contains(tipo))
            return BadRequest("Tipo debe ser IDIOMA, TITULO, CURSO, CERTIFICACION o HABILIDAD.");
        if (string.IsNullOrWhiteSpace(dto.Descripcion))
            return BadRequest("La descripción es obligatoria.");

        var f = new EmpleadoFormacion
        {
            EmpleadoId = dto.EmpleadoId, Tipo = tipo, Descripcion = dto.Descripcion.Trim(),
            Detalle = string.IsNullOrWhiteSpace(dto.Detalle) ? null : dto.Detalle.Trim(),
            Anio = dto.Anio, CreadoEn = DateTime.UtcNow,
        };
        _db.Formaciones.Add(f);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { empleadoId = f.EmpleadoId }, ToDto(f));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var f = await _db.Formaciones.FindAsync(id);
        if (f is null) return NotFound();
        _db.Formaciones.Remove(f);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static FormacionDto ToDto(EmpleadoFormacion f) =>
        new(f.EmpleadoFormacionId, f.EmpleadoId, f.Tipo, f.Descripcion, f.Detalle, f.Anio);
}
