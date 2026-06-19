using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProvisionesLaboralesController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public ProvisionesLaboralesController(CorpeturDbContext db) => _db = db;

    // GET /api/provisioneslaborales?empleadoId=5&anio=2026&mes=6
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProvisionLaboralDto>>> GetAll(
        [FromQuery] int? empleadoId, [FromQuery] int? anio, [FromQuery] byte? mes)
    {
        var q = _db.ProvisionesLaboral.AsNoTracking().Include(p => p.Empleado).AsQueryable();
        if (empleadoId is not null) q = q.Where(p => p.EmpleadoId == empleadoId);
        if (anio is not null) q = q.Where(p => p.Anio == anio);
        if (mes is not null) q = q.Where(p => p.Mes == mes);
        var entities = await q.OrderByDescending(p => p.Anio).ThenByDescending(p => p.Mes).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProvisionLaboralDto>> Get(int id)
    {
        var p = await _db.ProvisionesLaboral.AsNoTracking().Include(x => x.Empleado)
            .FirstOrDefaultAsync(x => x.ProvisionLaboralId == id);
        return p is null ? NotFound() : ToDto(p);
    }

    [HttpPost]
    public async Task<ActionResult<ProvisionLaboralDto>> Create(ProvisionLaboralCreateDto dto)
    {
        if (!await _db.Empleados.AnyAsync(e => e.EmpleadoId == dto.EmpleadoId))
            return BadRequest("El empleado no existe.");
        if (dto.Mes is < 1 or > 12)
            return BadRequest("Mes debe estar entre 1 y 12.");
        if (await _db.ProvisionesLaboral.AnyAsync(x =>
                x.EmpleadoId == dto.EmpleadoId && x.Anio == dto.Anio && x.Mes == dto.Mes))
            return Conflict($"Ya existe provisión para el empleado {dto.EmpleadoId} en {dto.Mes}/{dto.Anio}.");

        var p = new ProvisionLaboral
        {
            EmpleadoId = dto.EmpleadoId, Anio = dto.Anio, Mes = dto.Mes, BaseCalculo = dto.BaseCalculo,
            Indemnizacion = dto.Indemnizacion, Bono14 = dto.Bono14, Aguinaldo = dto.Aguinaldo,
            Vacaciones = dto.Vacaciones, IgssPatronal = dto.IgssPatronal, Intecap = dto.Intecap
        };
        _db.ProvisionesLaboral.Add(p);
        await _db.SaveChangesAsync();
        await _db.Entry(p).Reference(x => x.Empleado).LoadAsync();
        return CreatedAtAction(nameof(Get), new { id = p.ProvisionLaboralId }, ToDto(p));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ProvisionLaboralCreateDto dto)
    {
        var p = await _db.ProvisionesLaboral.FindAsync(id);
        if (p is null) return NotFound();
        if (dto.Mes is < 1 or > 12)
            return BadRequest("Mes debe estar entre 1 y 12.");
        if (await _db.ProvisionesLaboral.AnyAsync(x => x.ProvisionLaboralId != id
                && x.EmpleadoId == dto.EmpleadoId && x.Anio == dto.Anio && x.Mes == dto.Mes))
            return Conflict($"Ya existe otra provisión para el empleado {dto.EmpleadoId} en {dto.Mes}/{dto.Anio}.");

        p.EmpleadoId = dto.EmpleadoId; p.Anio = dto.Anio; p.Mes = dto.Mes; p.BaseCalculo = dto.BaseCalculo;
        p.Indemnizacion = dto.Indemnizacion; p.Bono14 = dto.Bono14; p.Aguinaldo = dto.Aguinaldo;
        p.Vacaciones = dto.Vacaciones; p.IgssPatronal = dto.IgssPatronal; p.Intecap = dto.Intecap;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await _db.ProvisionesLaboral.FindAsync(id);
        if (p is null) return NotFound();
        _db.ProvisionesLaboral.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static ProvisionLaboralDto ToDto(ProvisionLaboral p) => new(
        p.ProvisionLaboralId, p.EmpleadoId,
        p.Empleado is null ? null : $"{p.Empleado.Nombres} {p.Empleado.Apellidos}",
        p.Anio, p.Mes, p.BaseCalculo, p.Indemnizacion, p.Bono14, p.Aguinaldo,
        p.Vacaciones, p.IgssPatronal, p.Intecap);
}
