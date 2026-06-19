using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PrestamoMovimientosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public PrestamoMovimientosController(CorpeturDbContext db) => _db = db;

    // GET /api/prestamomovimientos?prestamoId=3
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PrestamoMovimientoDto>>> GetAll([FromQuery] int? prestamoId)
    {
        var q = _db.PrestamoMovimientos.AsNoTracking().AsQueryable();
        if (prestamoId is not null) q = q.Where(m => m.PrestamoId == prestamoId);
        var list = await q.OrderBy(m => m.Fecha).ThenBy(m => m.PrestamoMovimientoId)
            .Select(m => new PrestamoMovimientoDto(m.PrestamoMovimientoId, m.PrestamoId, m.PeriodoPagoId,
                m.Fecha, m.Tipo, m.Monto, m.SaldoResultante))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PrestamoMovimientoDto>> Get(int id)
    {
        var m = await _db.PrestamoMovimientos.FindAsync(id);
        if (m is null) return NotFound();
        return new PrestamoMovimientoDto(m.PrestamoMovimientoId, m.PrestamoId, m.PeriodoPagoId,
            m.Fecha, m.Tipo, m.Monto, m.SaldoResultante);
    }

    // Registra un movimiento manual. NOTA: la amortización automática (recalcular
    // Prestamo.Saldo a partir de los movimientos y generar abonos desde la boleta)
    // es parte del bloque 4; aquí solo se persiste lo que envía el cliente.
    [HttpPost]
    public async Task<ActionResult<PrestamoMovimientoDto>> Create(PrestamoMovimientoCreateDto dto)
    {
        if (!await _db.Prestamos.AnyAsync(p => p.PrestamoId == dto.PrestamoId))
            return BadRequest("El préstamo no existe.");
        if (dto.Tipo is not ("DESEMBOLSO" or "ABONO" or "AJUSTE"))
            return BadRequest("Tipo debe ser 'DESEMBOLSO', 'ABONO' o 'AJUSTE'.");
        if (dto.PeriodoPagoId is not null &&
            !await _db.PeriodosPago.AnyAsync(p => p.PeriodoPagoId == dto.PeriodoPagoId))
            return BadRequest("El período de pago no existe.");

        var m = new PrestamoMovimiento
        {
            PrestamoId = dto.PrestamoId, PeriodoPagoId = dto.PeriodoPagoId,
            Fecha = dto.Fecha, Tipo = dto.Tipo, Monto = dto.Monto, SaldoResultante = dto.SaldoResultante
        };
        _db.PrestamoMovimientos.Add(m);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = m.PrestamoMovimientoId },
            new PrestamoMovimientoDto(m.PrestamoMovimientoId, m.PrestamoId, m.PeriodoPagoId,
                m.Fecha, m.Tipo, m.Monto, m.SaldoResultante));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, PrestamoMovimientoCreateDto dto)
    {
        var m = await _db.PrestamoMovimientos.FindAsync(id);
        if (m is null) return NotFound();
        if (dto.Tipo is not ("DESEMBOLSO" or "ABONO" or "AJUSTE"))
            return BadRequest("Tipo debe ser 'DESEMBOLSO', 'ABONO' o 'AJUSTE'.");

        m.PrestamoId = dto.PrestamoId; m.PeriodoPagoId = dto.PeriodoPagoId;
        m.Fecha = dto.Fecha; m.Tipo = dto.Tipo; m.Monto = dto.Monto; m.SaldoResultante = dto.SaldoResultante;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var m = await _db.PrestamoMovimientos.FindAsync(id);
        if (m is null) return NotFound();
        _db.PrestamoMovimientos.Remove(m);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
