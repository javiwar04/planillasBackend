using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VacacionesController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public VacacionesController(CorpeturDbContext db) => _db = db;

    // GET /api/vacaciones?empleadoId=5
    [HttpGet]
    public async Task<ActionResult<IEnumerable<VacacionDto>>> GetAll([FromQuery] int? empleadoId)
    {
        var q = _db.Vacaciones.AsNoTracking().Include(v => v.Empleado).AsQueryable();
        if (empleadoId is not null) q = q.Where(v => v.EmpleadoId == empleadoId);
        var entities = await q.OrderByDescending(v => v.FechaInicio).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<VacacionDto>> Get(int id)
    {
        var v = await _db.Vacaciones.AsNoTracking().Include(x => x.Empleado)
            .FirstOrDefaultAsync(x => x.VacacionId == id);
        return v is null ? NotFound() : ToDto(v);
    }

    [HttpPost]
    public async Task<ActionResult<VacacionDto>> Create(VacacionCreateDto dto)
    {
        if (!await _db.Empleados.AnyAsync(e => e.EmpleadoId == dto.EmpleadoId))
            return BadRequest("El empleado no existe.");
        if (dto.Dias <= 0) return BadRequest("Los días deben ser mayores a cero.");
        if (dto.FechaFin < dto.FechaInicio) return BadRequest("La fecha fin no puede ser anterior al inicio.");

        var v = new Vacacion
        {
            EmpleadoId = dto.EmpleadoId, FechaInicio = dto.FechaInicio, FechaFin = dto.FechaFin,
            Dias = dto.Dias, Observacion = dto.Observacion,
        };
        _db.Vacaciones.Add(v);
        await _db.SaveChangesAsync();
        await _db.Entry(v).Reference(x => x.Empleado).LoadAsync();
        return CreatedAtAction(nameof(Get), new { id = v.VacacionId }, ToDto(v));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, VacacionCreateDto dto)
    {
        var v = await _db.Vacaciones.FindAsync(id);
        if (v is null) return NotFound();
        if (dto.Dias <= 0) return BadRequest("Los días deben ser mayores a cero.");
        if (dto.FechaFin < dto.FechaInicio) return BadRequest("La fecha fin no puede ser anterior al inicio.");

        v.EmpleadoId = dto.EmpleadoId; v.FechaInicio = dto.FechaInicio; v.FechaFin = dto.FechaFin;
        v.Dias = dto.Dias; v.Observacion = dto.Observacion;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var v = await _db.Vacaciones.FindAsync(id);
        if (v is null) return NotFound();
        _db.Vacaciones.Remove(v);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static VacacionDto ToDto(Vacacion v) => new(
        v.VacacionId, v.EmpleadoId,
        v.Empleado is null ? null : $"{v.Empleado.Nombres} {v.Empleado.Apellidos}",
        v.FechaInicio, v.FechaFin, v.Dias, v.Observacion);
}
