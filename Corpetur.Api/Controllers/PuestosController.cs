using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PuestosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public PuestosController(CorpeturDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PuestoDto>>> GetAll()
    {
        var list = await _db.Puestos.AsNoTracking().OrderBy(p => p.Nombre)
            .Select(p => new PuestoDto(p.PuestoId, p.Nombre))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PuestoDto>> Get(int id)
    {
        var p = await _db.Puestos.FindAsync(id);
        if (p is null) return NotFound();
        return new PuestoDto(p.PuestoId, p.Nombre);
    }

    [HttpPost]
    public async Task<ActionResult<PuestoDto>> Create(PuestoCreateDto dto)
    {
        if (await _db.Puestos.AnyAsync(x => x.Nombre == dto.Nombre))
            return Conflict($"Ya existe un puesto con nombre '{dto.Nombre}'.");

        var p = new Puesto { Nombre = dto.Nombre };
        _db.Puestos.Add(p);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = p.PuestoId },
            new PuestoDto(p.PuestoId, p.Nombre));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, PuestoCreateDto dto)
    {
        var p = await _db.Puestos.FindAsync(id);
        if (p is null) return NotFound();
        if (await _db.Puestos.AnyAsync(x => x.Nombre == dto.Nombre && x.PuestoId != id))
            return Conflict($"Ya existe otro puesto con nombre '{dto.Nombre}'.");
        p.Nombre = dto.Nombre;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Catálogo sin baja lógica en el esquema: borrado físico solo si ningún
    // empleado lo referencia.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await _db.Puestos.FindAsync(id);
        if (p is null) return NotFound();
        if (await _db.Empleados.AnyAsync(e => e.PuestoId == id))
            return Conflict("No se puede borrar: hay empleados asociados a este puesto.");
        _db.Puestos.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
