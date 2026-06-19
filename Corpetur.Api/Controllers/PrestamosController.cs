using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PrestamosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public PrestamosController(CorpeturDbContext db) => _db = db;

    // GET /api/prestamos?empleadoId=5&estado=ACTIVO
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PrestamoDto>>> GetAll(
        [FromQuery] int? empleadoId, [FromQuery] string? estado)
    {
        var q = _db.Prestamos.AsNoTracking().Include(p => p.Empleado).AsQueryable();
        if (empleadoId is not null) q = q.Where(p => p.EmpleadoId == empleadoId);
        if (estado is "ACTIVO" or "PAGADO" or "CANCELADO") q = q.Where(p => p.Estado == estado);
        var entities = await q.OrderByDescending(p => p.FechaInicio).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PrestamoDto>> Get(int id)
    {
        var p = await _db.Prestamos.AsNoTracking().Include(x => x.Empleado)
            .FirstOrDefaultAsync(x => x.PrestamoId == id);
        return p is null ? NotFound() : ToDto(p);
    }

    [HttpPost]
    public async Task<ActionResult<PrestamoDto>> Create(PrestamoCreateDto dto)
    {
        if (!await _db.Empleados.AnyAsync(e => e.EmpleadoId == dto.EmpleadoId))
            return BadRequest("El empleado no existe.");
        if (dto.MontoOriginal <= 0)
            return BadRequest("MontoOriginal debe ser mayor a cero.");

        var p = new Prestamo
        {
            EmpleadoId = dto.EmpleadoId,
            Tipo = dto.Tipo,
            MontoOriginal = dto.MontoOriginal,
            CuotaSugerida = dto.CuotaSugerida,
            // Si no se especifica saldo inicial, arranca igual al monto original.
            Saldo = dto.Saldo ?? dto.MontoOriginal,
            FechaInicio = dto.FechaInicio,
            Estado = "ACTIVO"
        };
        _db.Prestamos.Add(p);
        await _db.SaveChangesAsync();
        await _db.Entry(p).Reference(x => x.Empleado).LoadAsync();
        return CreatedAtAction(nameof(Get), new { id = p.PrestamoId }, ToDto(p));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, PrestamoCreateDto dto)
    {
        var p = await _db.Prestamos.FindAsync(id);
        if (p is null) return NotFound();
        if (dto.MontoOriginal <= 0)
            return BadRequest("MontoOriginal debe ser mayor a cero.");

        p.EmpleadoId = dto.EmpleadoId;
        p.Tipo = dto.Tipo;
        p.MontoOriginal = dto.MontoOriginal;
        p.CuotaSugerida = dto.CuotaSugerida;
        if (dto.Saldo is not null) p.Saldo = dto.Saldo.Value;
        p.FechaInicio = dto.FechaInicio;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Baja lógica: el préstamo no se borra (histórico de movimientos), se cancela.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Cancelar(int id)
    {
        var p = await _db.Prestamos.FindAsync(id);
        if (p is null) return NotFound();
        p.Estado = "CANCELADO";
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static PrestamoDto ToDto(Prestamo p) => new(
        p.PrestamoId, p.EmpleadoId,
        p.Empleado is null ? null : $"{p.Empleado.Nombres} {p.Empleado.Apellidos}",
        p.Tipo, p.MontoOriginal, p.CuotaSugerida, p.Saldo, p.FechaInicio, p.Estado);
}
