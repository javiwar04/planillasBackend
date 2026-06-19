using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DepartamentosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public DepartamentosController(CorpeturDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DepartamentoDto>>> GetAll()
    {
        var list = await _db.Departamentos.AsNoTracking().OrderBy(d => d.Nombre)
            .Select(d => new DepartamentoDto(d.DepartamentoId, d.Nombre))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<DepartamentoDto>> Get(int id)
    {
        var d = await _db.Departamentos.FindAsync(id);
        if (d is null) return NotFound();
        return new DepartamentoDto(d.DepartamentoId, d.Nombre);
    }

    [HttpPost]
    public async Task<ActionResult<DepartamentoDto>> Create(DepartamentoCreateDto dto)
    {
        if (await _db.Departamentos.AnyAsync(x => x.Nombre == dto.Nombre))
            return Conflict($"Ya existe un departamento con nombre '{dto.Nombre}'.");

        var d = new Departamento { Nombre = dto.Nombre };
        _db.Departamentos.Add(d);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = d.DepartamentoId },
            new DepartamentoDto(d.DepartamentoId, d.Nombre));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, DepartamentoCreateDto dto)
    {
        var d = await _db.Departamentos.FindAsync(id);
        if (d is null) return NotFound();
        if (await _db.Departamentos.AnyAsync(x => x.Nombre == dto.Nombre && x.DepartamentoId != id))
            return Conflict($"Ya existe otro departamento con nombre '{dto.Nombre}'.");
        d.Nombre = dto.Nombre;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var d = await _db.Departamentos.FindAsync(id);
        if (d is null) return NotFound();
        if (await _db.Empleados.AnyAsync(e => e.DepartamentoId == id))
            return Conflict("No se puede borrar: hay empleados asociados a este departamento.");
        _db.Departamentos.Remove(d);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
