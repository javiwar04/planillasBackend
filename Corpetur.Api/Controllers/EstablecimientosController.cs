using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EstablecimientosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public EstablecimientosController(CorpeturDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<EstablecimientoDto>>> GetAll([FromQuery] bool soloActivos = true)
    {
        var q = _db.Establecimientos.AsNoTracking().AsQueryable();
        if (soloActivos) q = q.Where(e => e.Activo);
        var list = await q.OrderBy(e => e.Nombre)
            .Select(e => new EstablecimientoDto(e.EstablecimientoId, e.Codigo, e.Nombre, e.EsEntidadContable, e.Encargado, e.Activo))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EstablecimientoDto>> Get(int id)
    {
        var e = await _db.Establecimientos.FindAsync(id);
        if (e is null) return NotFound();
        return new EstablecimientoDto(e.EstablecimientoId, e.Codigo, e.Nombre, e.EsEntidadContable, e.Encargado, e.Activo);
    }

    [HttpPost]
    public async Task<ActionResult<EstablecimientoDto>> Create(EstablecimientoCreateDto dto)
    {
        if (await _db.Establecimientos.AnyAsync(x => x.Codigo == dto.Codigo))
            return Conflict($"Ya existe un establecimiento con código '{dto.Codigo}'.");

        var e = new Establecimiento { Codigo = dto.Codigo, Nombre = dto.Nombre, EsEntidadContable = dto.EsEntidadContable, Encargado = dto.Encargado };
        _db.Establecimientos.Add(e);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = e.EstablecimientoId },
            new EstablecimientoDto(e.EstablecimientoId, e.Codigo, e.Nombre, e.EsEntidadContable, e.Encargado, e.Activo));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, EstablecimientoCreateDto dto)
    {
        var e = await _db.Establecimientos.FindAsync(id);
        if (e is null) return NotFound();
        e.Codigo = dto.Codigo; e.Nombre = dto.Nombre; e.EsEntidadContable = dto.EsEntidadContable; e.Encargado = dto.Encargado;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Desactivar(int id)
    {
        var e = await _db.Establecimientos.FindAsync(id);
        if (e is null) return NotFound();
        e.Activo = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
