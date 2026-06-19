using System.Security.Claims;
using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Corpetur.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    private readonly TokenService _tokens;
    private readonly IPasswordHasher<Usuario> _hasher;
    public AuthController(CorpeturDbContext db, TokenService tokens, IPasswordHasher<Usuario> hasher)
    {
        _db = db; _tokens = tokens; _hasher = hasher;
    }

    // POST /api/auth/login  — público.
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest dto)
    {
        var u = await _db.Usuarios.FirstOrDefaultAsync(x => x.Email == dto.Email && x.Activo);
        // Mensaje genérico a propósito (no revelar si el email existe).
        if (u is null || string.IsNullOrEmpty(u.PasswordHash))
            return Unauthorized(new { error = "Credenciales inválidas." });

        var result = _hasher.VerifyHashedPassword(u, u.PasswordHash, dto.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { error = "Credenciales inválidas." });

        // Si el algoritmo de hash quedó obsoleto, lo re-hasheamos al vuelo.
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            u.PasswordHash = _hasher.HashPassword(u, dto.Password);
            await _db.SaveChangesAsync();
        }

        var (token, expira) = _tokens.Crear(u);
        return new LoginResponse(token, expira,
            new UsuarioDto(u.UsuarioId, u.Nombre, u.Email, u.Rol, u.Activo));
    }

    // GET /api/auth/me  — datos del usuario autenticado.
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UsuarioDto>> Me()
    {
        var id = ActualId();
        if (id is null) return Unauthorized();
        var u = await _db.Usuarios.FindAsync(id.Value);
        if (u is null) return Unauthorized();
        return new UsuarioDto(u.UsuarioId, u.Nombre, u.Email, u.Rol, u.Activo);
    }

    // POST /api/auth/cambiar-password  — el propio usuario cambia su contraseña.
    [Authorize]
    [HttpPost("cambiar-password")]
    public async Task<IActionResult> CambiarPassword(CambiarPasswordRequest dto)
    {
        if (string.IsNullOrWhiteSpace(dto.PasswordNueva) || dto.PasswordNueva.Length < 8)
            return BadRequest("La nueva contraseña debe tener al menos 8 caracteres.");

        var id = ActualId();
        if (id is null) return Unauthorized();
        var u = await _db.Usuarios.FindAsync(id.Value);
        if (u is null) return Unauthorized();

        if (string.IsNullOrEmpty(u.PasswordHash) ||
            _hasher.VerifyHashedPassword(u, u.PasswordHash, dto.PasswordActual) == PasswordVerificationResult.Failed)
            return BadRequest("La contraseña actual no es correcta.");

        u.PasswordHash = _hasher.HashPassword(u, dto.PasswordNueva);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private int? ActualId()
        => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
}
