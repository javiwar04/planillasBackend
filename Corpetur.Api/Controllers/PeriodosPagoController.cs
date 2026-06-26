using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Corpetur.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PeriodosPagoController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    private readonly NominaService _nomina;
    public PeriodosPagoController(CorpeturDbContext db, NominaService nomina)
    {
        _db = db;
        _nomina = nomina;
    }

    // GET /api/periodospago?anio=2026&tipo=QUINCENA&estado=ABIERTO
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PeriodoPagoDto>>> GetAll(
        [FromQuery] int? anio, [FromQuery] string? tipo, [FromQuery] string? estado)
    {
        var q = _db.PeriodosPago.AsNoTracking().AsQueryable();
        if (anio is not null) q = q.Where(p => p.Anio == anio);
        if (tipo is "QUINCENA" or "FIN_MES" or "EXTRA") q = q.Where(p => p.Tipo == tipo);
        if (estado is "ABIERTO" or "CALCULADO" or "CERRADO") q = q.Where(p => p.Estado == estado);
        var list = await q.OrderByDescending(p => p.Anio).ThenByDescending(p => p.Mes).ThenBy(p => p.Tipo)
            .Select(p => new PeriodoPagoDto(p.PeriodoPagoId, p.Anio, p.Mes, p.Tipo,
                p.FechaInicio, p.FechaFin, p.FechaPago, p.Estado))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PeriodoPagoDto>> Get(int id)
    {
        var p = await _db.PeriodosPago.FindAsync(id);
        if (p is null) return NotFound();
        return new PeriodoPagoDto(p.PeriodoPagoId, p.Anio, p.Mes, p.Tipo,
            p.FechaInicio, p.FechaFin, p.FechaPago, p.Estado);
    }

    [Authorize(Roles = "ADMIN,CONTABILIDAD")]
    [HttpPost]
    public async Task<ActionResult<PeriodoPagoDto>> Create(PeriodoPagoCreateDto dto)
    {
        if (dto.Tipo is not ("QUINCENA" or "FIN_MES" or "EXTRA"))
            return BadRequest("Tipo debe ser 'QUINCENA', 'FIN_MES' o 'EXTRA'.");
        if (dto.Mes is < 1 or > 12)
            return BadRequest("Mes debe estar entre 1 y 12.");
        if (await _db.PeriodosPago.AnyAsync(x => x.Anio == dto.Anio && x.Mes == dto.Mes && x.Tipo == dto.Tipo))
            return Conflict($"Ya existe el período {dto.Tipo} {dto.Mes}/{dto.Anio}.");

        var p = new PeriodoPago
        {
            Anio = dto.Anio, Mes = dto.Mes, Tipo = dto.Tipo,
            FechaInicio = dto.FechaInicio, FechaFin = dto.FechaFin, FechaPago = dto.FechaPago,
            Estado = "ABIERTO"
        };
        _db.PeriodosPago.Add(p);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = p.PeriodoPagoId },
            new PeriodoPagoDto(p.PeriodoPagoId, p.Anio, p.Mes, p.Tipo,
                p.FechaInicio, p.FechaFin, p.FechaPago, p.Estado));
    }

    // Edita fechas/estado del período. La generación de boletas y el cierre con
    // sus reglas viven en el motor de cálculo (bloque 3), no aquí.
    [Authorize(Roles = "ADMIN,CONTABILIDAD")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, PeriodoPagoCreateDto dto)
    {
        var p = await _db.PeriodosPago.FindAsync(id);
        if (p is null) return NotFound();
        if (p.Estado == "CERRADO")
            return Conflict("El período está CERRADO y no puede modificarse.");
        if (await _db.PeriodosPago.AnyAsync(x =>
                x.Anio == dto.Anio && x.Mes == dto.Mes && x.Tipo == dto.Tipo && x.PeriodoPagoId != id))
            return Conflict($"Ya existe otro período {dto.Tipo} {dto.Mes}/{dto.Anio}.");

        p.Anio = dto.Anio; p.Mes = dto.Mes; p.Tipo = dto.Tipo;
        p.FechaInicio = dto.FechaInicio; p.FechaFin = dto.FechaFin; p.FechaPago = dto.FechaPago;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Solo se puede borrar un período ABIERTO y sin boletas (aún no es histórico).
    // Un período con boletas o ya CERRADO es histórico y no se borra.
    [Authorize(Roles = "ADMIN,CONTABILIDAD")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var p = await _db.PeriodosPago.FindAsync(id);
        if (p is null) return NotFound();
        if (p.Estado != "ABIERTO")
            return Conflict("Solo se puede borrar un período en estado ABIERTO.");
        if (await _db.Boletas.AnyAsync(b => b.PeriodoPagoId == id))
            return Conflict("No se puede borrar: el período ya tiene boletas.");
        _db.PeriodosPago.Remove(p);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ========================================================================
    //  Operaciones de nómina (bloque 3) — delegan en NominaService.
    // ========================================================================

    // POST /api/periodospago/{id}/generar
    // QUINCENA: anticipo fijo por empleado (con overrides). FIN_MES: sueldo + IGSS
    // + descuento del anticipo realmente pagado en las quincenas del mes.
    [Authorize(Roles = "ADMIN,CONTABILIDAD")]
    [HttpPost("{id:int}/generar")]
    public async Task<ActionResult<GenerarResultadoDto>> Generar(int id, [FromBody] GenerarPeriodoRequest? req = null)
        => Ok(await _nomina.GenerarAsync(id, req));

    // POST /api/periodospago/{id}/provisiones — genera el cuadro Kurt del mes del período.
    [Authorize(Roles = "ADMIN,CONTABILIDAD")]
    [HttpPost("{id:int}/provisiones")]
    public async Task<ActionResult<ProvisionesResultadoDto>> Provisiones(int id)
        => Ok(await _nomina.GenerarProvisionesAsync(id));

    // POST /api/periodospago/{id}/cerrar — marca boletas PAGADA y el período CERRADO (inmutable).
    [Authorize(Roles = "ADMIN,CONTABILIDAD")]
    [HttpPost("{id:int}/cerrar")]
    public async Task<IActionResult> Cerrar(int id)
    {
        await _nomina.CerrarAsync(id);
        return NoContent();
    }

    // POST /api/periodospago/{id}/reabrir — revierte un período CERRADO a CALCULADO
    // para corregir antes de pagar (queda en auditoría).
    [Authorize(Roles = "ADMIN,CONTABILIDAD")]
    [HttpPost("{id:int}/reabrir")]
    public async Task<IActionResult> Reabrir(int id)
    {
        await _nomina.ReabrirAsync(id);
        return NoContent();
    }
}
