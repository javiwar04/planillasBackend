using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

// Bitácora de auditoría: solo ADMIN.
[Authorize(Roles = "ADMIN")]
[ApiController]
[Route("api/[controller]")]
public class AuditoriaController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public AuditoriaController(CorpeturDbContext db) => _db = db;

    // GET /api/auditoria?entidad=Empleado&accion=CREAR&take=200
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuditoriaDto>>> GetAll(
        [FromQuery] string? entidad, [FromQuery] string? accion, [FromQuery] int take = 200)
    {
        var q = _db.Auditorias.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(entidad)) q = q.Where(a => a.Entidad == entidad);
        if (!string.IsNullOrWhiteSpace(accion)) q = q.Where(a => a.Accion == accion);
        var list = await q.OrderByDescending(a => a.AuditoriaId)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(a => new AuditoriaDto(a.AuditoriaId, a.Fecha, a.UsuarioId, a.Usuario,
                a.Accion, a.Entidad, a.EntidadId, a.Detalle))
            .ToListAsync();
        return Ok(list);
    }
}
