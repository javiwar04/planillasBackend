using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AusenciasController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public AusenciasController(CorpeturDbContext db) => _db = db;

    private static readonly string[] Tipos =
        { "INCAPACIDAD", "PERMISO_CON_GOCE", "PERMISO_SIN_GOCE", "FALTA", "SUSPENSION" };

    // GET /api/ausencias?empleadoId=5
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AusenciaDto>>> GetAll([FromQuery] int? empleadoId)
    {
        var q = _db.Ausencias.AsNoTracking().Include(a => a.Empleado).AsQueryable();
        if (empleadoId is not null) q = q.Where(a => a.EmpleadoId == empleadoId);
        var entities = await q.OrderByDescending(a => a.FechaInicio).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AusenciaDto>> Get(int id)
    {
        var a = await _db.Ausencias.AsNoTracking().Include(x => x.Empleado)
            .FirstOrDefaultAsync(x => x.AusenciaId == id);
        return a is null ? NotFound() : ToDto(a);
    }

    [HttpPost]
    public async Task<ActionResult<AusenciaDto>> Create(AusenciaCreateDto dto)
    {
        if (!await _db.Empleados.AnyAsync(e => e.EmpleadoId == dto.EmpleadoId))
            return BadRequest("El empleado no existe.");
        if (!Tipos.Contains(dto.Tipo))
            return BadRequest("Tipo inválido.");
        if (dto.FechaFin < dto.FechaInicio) return BadRequest("La fecha fin no puede ser anterior al inicio.");

        var a = new Ausencia
        {
            EmpleadoId = dto.EmpleadoId, FechaInicio = dto.FechaInicio, FechaFin = dto.FechaFin,
            Dias = dto.Dias, Tipo = dto.Tipo, Descontable = dto.Descontable, Observacion = dto.Observacion,
        };
        _db.Ausencias.Add(a);
        await _db.SaveChangesAsync();
        await _db.Entry(a).Reference(x => x.Empleado).LoadAsync();
        return CreatedAtAction(nameof(Get), new { id = a.AusenciaId }, ToDto(a));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, AusenciaCreateDto dto)
    {
        var a = await _db.Ausencias.FindAsync(id);
        if (a is null) return NotFound();
        if (!Tipos.Contains(dto.Tipo)) return BadRequest("Tipo inválido.");
        if (dto.FechaFin < dto.FechaInicio) return BadRequest("La fecha fin no puede ser anterior al inicio.");

        a.EmpleadoId = dto.EmpleadoId; a.FechaInicio = dto.FechaInicio; a.FechaFin = dto.FechaFin;
        a.Dias = dto.Dias; a.Tipo = dto.Tipo; a.Descontable = dto.Descontable; a.Observacion = dto.Observacion;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var a = await _db.Ausencias.FindAsync(id);
        if (a is null) return NotFound();
        _db.Ausencias.Remove(a);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static AusenciaDto ToDto(Ausencia a) => new(
        a.AusenciaId, a.EmpleadoId,
        a.Empleado is null ? null : $"{a.Empleado.Nombres} {a.Empleado.Apellidos}",
        a.FechaInicio, a.FechaFin, a.Dias, a.Tipo, a.Descontable, a.Observacion);
}
