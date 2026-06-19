using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReglasBonificacionController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public ReglasBonificacionController(CorpeturDbContext db) => _db = db;

    private static readonly string[] BasesMetrica = { "VENTA", "OCUPACION" };
    private static readonly string[] TiposCalculo = { "PORCENTAJE", "MONTO_POR_UNIDAD", "ESCALA" };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ReglaBonificacionDto>>> GetAll(
        [FromQuery] bool soloActivas = true, [FromQuery] int? establecimientoId = null)
    {
        var q = _db.ReglasBonificacion.AsNoTracking().AsQueryable();
        if (soloActivas) q = q.Where(r => r.Activo);
        if (establecimientoId is not null) q = q.Where(r => r.EstablecimientoId == establecimientoId);
        var list = await q.OrderBy(r => r.Nombre)
            .Select(r => new ReglaBonificacionDto(r.ReglaBonificacionId, r.Nombre, r.EstablecimientoId,
                r.DepartamentoId, r.EmpleadoId, r.BaseMetrica, r.TipoCalculo, r.Parametro, r.ConceptoId, r.Activo))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ReglaBonificacionDto>> Get(int id)
    {
        var r = await _db.ReglasBonificacion.FindAsync(id);
        if (r is null) return NotFound();
        return new ReglaBonificacionDto(r.ReglaBonificacionId, r.Nombre, r.EstablecimientoId,
            r.DepartamentoId, r.EmpleadoId, r.BaseMetrica, r.TipoCalculo, r.Parametro, r.ConceptoId, r.Activo);
    }

    [HttpPost]
    public async Task<ActionResult<ReglaBonificacionDto>> Create(ReglaBonificacionCreateDto dto)
    {
        var error = await ValidarAsync(dto);
        if (error is not null) return BadRequest(error);

        var r = new ReglaBonificacion
        {
            Nombre = dto.Nombre, EstablecimientoId = dto.EstablecimientoId,
            DepartamentoId = dto.DepartamentoId, EmpleadoId = dto.EmpleadoId,
            BaseMetrica = dto.BaseMetrica, TipoCalculo = dto.TipoCalculo,
            Parametro = dto.Parametro, ConceptoId = dto.ConceptoId
        };
        _db.ReglasBonificacion.Add(r);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = r.ReglaBonificacionId },
            new ReglaBonificacionDto(r.ReglaBonificacionId, r.Nombre, r.EstablecimientoId,
                r.DepartamentoId, r.EmpleadoId, r.BaseMetrica, r.TipoCalculo, r.Parametro, r.ConceptoId, r.Activo));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ReglaBonificacionCreateDto dto)
    {
        var r = await _db.ReglasBonificacion.FindAsync(id);
        if (r is null) return NotFound();
        var error = await ValidarAsync(dto);
        if (error is not null) return BadRequest(error);

        r.Nombre = dto.Nombre; r.EstablecimientoId = dto.EstablecimientoId;
        r.DepartamentoId = dto.DepartamentoId; r.EmpleadoId = dto.EmpleadoId;
        r.BaseMetrica = dto.BaseMetrica; r.TipoCalculo = dto.TipoCalculo;
        r.Parametro = dto.Parametro; r.ConceptoId = dto.ConceptoId;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Desactivar(int id)
    {
        var r = await _db.ReglasBonificacion.FindAsync(id);
        if (r is null) return NotFound();
        r.Activo = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<string?> ValidarAsync(ReglaBonificacionCreateDto dto)
    {
        if (!BasesMetrica.Contains(dto.BaseMetrica))
            return "BaseMetrica debe ser 'VENTA' o 'OCUPACION'.";
        if (!TiposCalculo.Contains(dto.TipoCalculo))
            return "TipoCalculo debe ser 'PORCENTAJE', 'MONTO_POR_UNIDAD' o 'ESCALA'.";
        if (!await _db.Conceptos.AnyAsync(c => c.ConceptoId == dto.ConceptoId))
            return "El concepto destino no existe.";
        if (dto.EstablecimientoId is not null &&
            !await _db.Establecimientos.AnyAsync(e => e.EstablecimientoId == dto.EstablecimientoId))
            return "El establecimiento no existe.";
        if (dto.DepartamentoId is not null &&
            !await _db.Departamentos.AnyAsync(e => e.DepartamentoId == dto.DepartamentoId))
            return "El departamento no existe.";
        if (dto.EmpleadoId is not null &&
            !await _db.Empleados.AnyAsync(e => e.EmpleadoId == dto.EmpleadoId))
            return "El empleado no existe.";
        return null;
    }
}
