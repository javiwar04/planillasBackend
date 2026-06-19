using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConceptosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public ConceptosController(CorpeturDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ConceptoDto>>> GetAll([FromQuery] string? naturaleza = null)
    {
        var q = _db.Conceptos.AsNoTracking().Where(c => c.Activo);
        if (naturaleza is "INGRESO" or "EGRESO") q = q.Where(c => c.Naturaleza == naturaleza);
        var list = await q.OrderBy(c => c.Orden)
            .Select(c => new ConceptoDto(c.ConceptoId, c.Codigo, c.Nombre, c.Naturaleza, c.EsCalculado, c.Orden, c.Activo))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ConceptoDto>> Get(int id)
    {
        var c = await _db.Conceptos.FindAsync(id);
        if (c is null) return NotFound();
        return new ConceptoDto(c.ConceptoId, c.Codigo, c.Nombre, c.Naturaleza, c.EsCalculado, c.Orden, c.Activo);
    }

    [HttpPost]
    public async Task<ActionResult<ConceptoDto>> Create(ConceptoCreateDto dto)
    {
        if (dto.Naturaleza is not ("INGRESO" or "EGRESO"))
            return BadRequest("Naturaleza debe ser 'INGRESO' o 'EGRESO'.");
        if (await _db.Conceptos.AnyAsync(x => x.Codigo == dto.Codigo))
            return Conflict($"Ya existe un concepto con código '{dto.Codigo}'.");

        var c = new Concepto
        {
            Codigo = dto.Codigo, Nombre = dto.Nombre, Naturaleza = dto.Naturaleza,
            EsCalculado = dto.EsCalculado, Orden = dto.Orden
        };
        _db.Conceptos.Add(c);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = c.ConceptoId },
            new ConceptoDto(c.ConceptoId, c.Codigo, c.Nombre, c.Naturaleza, c.EsCalculado, c.Orden, c.Activo));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ConceptoCreateDto dto)
    {
        var c = await _db.Conceptos.FindAsync(id);
        if (c is null) return NotFound();
        c.Nombre = dto.Nombre; c.Naturaleza = dto.Naturaleza;
        c.EsCalculado = dto.EsCalculado; c.Orden = dto.Orden;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Desactivar(int id)
    {
        var c = await _db.Conceptos.FindAsync(id);
        if (c is null) return NotFound();
        c.Activo = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
