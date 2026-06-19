using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsuariosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public UsuariosController(CorpeturDbContext db) => _db = db;

    private static readonly string[] Roles = { "ADMIN", "CONTABILIDAD", "CAPTURA", "LECTURA" };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<UsuarioDto>>> GetAll([FromQuery] bool soloActivos = true)
    {
        var q = _db.Usuarios.AsNoTracking().AsQueryable();
        if (soloActivos) q = q.Where(u => u.Activo);
        var list = await q.OrderBy(u => u.Nombre)
            .Select(u => new UsuarioDto(u.UsuarioId, u.Nombre, u.Email, u.Rol, u.Activo))
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<UsuarioDto>> Get(int id)
    {
        var u = await _db.Usuarios.FindAsync(id);
        if (u is null) return NotFound();
        return new UsuarioDto(u.UsuarioId, u.Nombre, u.Email, u.Rol, u.Activo);
    }

    [HttpPost]
    public async Task<ActionResult<UsuarioDto>> Create(UsuarioCreateDto dto)
    {
        if (!Roles.Contains(dto.Rol))
            return BadRequest("Rol debe ser 'ADMIN', 'CONTABILIDAD', 'CAPTURA' o 'LECTURA'.");
        if (await _db.Usuarios.AnyAsync(x => x.Email == dto.Email))
            return Conflict($"Ya existe un usuario con email '{dto.Email}'.");

        var u = new Usuario { Nombre = dto.Nombre, Email = dto.Email, Rol = dto.Rol };
        _db.Usuarios.Add(u);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { id = u.UsuarioId },
            new UsuarioDto(u.UsuarioId, u.Nombre, u.Email, u.Rol, u.Activo));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UsuarioCreateDto dto)
    {
        var u = await _db.Usuarios.FindAsync(id);
        if (u is null) return NotFound();
        if (!Roles.Contains(dto.Rol))
            return BadRequest("Rol debe ser 'ADMIN', 'CONTABILIDAD', 'CAPTURA' o 'LECTURA'.");
        if (await _db.Usuarios.AnyAsync(x => x.Email == dto.Email && x.UsuarioId != id))
            return Conflict($"Ya existe otro usuario con email '{dto.Email}'.");

        u.Nombre = dto.Nombre; u.Email = dto.Email; u.Rol = dto.Rol;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Desactivar(int id)
    {
        var u = await _db.Usuarios.FindAsync(id);
        if (u is null) return NotFound();
        u.Activo = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
