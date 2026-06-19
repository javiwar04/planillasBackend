using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ParametrosNominaController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public ParametrosNominaController(CorpeturDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ParametroNominaDto>>> GetAll()
    {
        var list = await _db.ParametrosNomina.AsNoTracking().OrderBy(p => p.Clave)
            .Select(p => new ParametroNominaDto(p.Clave, p.Valor, p.Descripcion, p.VigenteDesde))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{clave}")]
    public async Task<ActionResult<ParametroNominaDto>> Get(string clave)
    {
        var p = await _db.ParametrosNomina.FindAsync(clave);
        if (p is null) return NotFound();
        return new ParametroNominaDto(p.Clave, p.Valor, p.Descripcion, p.VigenteDesde);
    }

    [HttpPost]
    public async Task<ActionResult<ParametroNominaDto>> Create(ParametroNominaCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Clave))
            return BadRequest("La clave es obligatoria.");
        if (await _db.ParametrosNomina.AnyAsync(p => p.Clave == dto.Clave))
            return Conflict($"Ya existe un parámetro con clave '{dto.Clave}'.");

        var p = new ParametroNomina
        {
            Clave = dto.Clave, Valor = dto.Valor,
            Descripcion = dto.Descripcion, VigenteDesde = dto.VigenteDesde
        };
        _db.ParametrosNomina.Add(p);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { clave = p.Clave },
            new ParametroNominaDto(p.Clave, p.Valor, p.Descripcion, p.VigenteDesde));
    }

    [HttpPut("{clave}")]
    public async Task<IActionResult> Update(string clave, ParametroNominaCreateDto dto)
    {
        var p = await _db.ParametrosNomina.FindAsync(clave);
        if (p is null) return NotFound();
        // La clave es la PK: se edita valor/descripcion/vigencia, no la clave.
        p.Valor = dto.Valor; p.Descripcion = dto.Descripcion; p.VigenteDesde = dto.VigenteDesde;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{clave}")]
    public async Task<IActionResult> Delete(string clave)
    {
        var p = await _db.ParametrosNomina.FindAsync(clave);
        if (p is null) return NotFound();
        _db.ParametrosNomina.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
