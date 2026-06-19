using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Corpetur.Api.Entities;
using Microsoft.IdentityModel.Tokens;

namespace Corpetur.Api.Services;

/// <summary>
/// Emite tokens JWT firmados (HS256) a partir de un usuario. La configuración
/// (clave, emisor, audiencia, expiración) vive en appsettings → sección "Jwt".
/// </summary>
public class TokenService
{
    private readonly IConfiguration _cfg;
    public TokenService(IConfiguration cfg) => _cfg = cfg;

    public (string token, DateTime expiraEn) Crear(Usuario u)
    {
        var key = _cfg["Jwt:Key"] ?? throw new InvalidOperationException("Falta Jwt:Key en la configuración.");
        var issuer = _cfg["Jwt:Issuer"] ?? "CorpeturApi";
        var audience = _cfg["Jwt:Audience"] ?? "CorpeturApi";
        var minutos = int.TryParse(_cfg["Jwt:ExpiraMinutos"], out var m) ? m : 480;

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, u.UsuarioId.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, u.UsuarioId.ToString()),
            new(ClaimTypes.Name, u.Nombre),
            new(ClaimTypes.Email, u.Email),
            new(ClaimTypes.Role, u.Rol),
        };

        var expiraEn = DateTime.UtcNow.AddMinutes(minutos);
        var token = new JwtSecurityToken(issuer, audience, claims,
            expires: expiraEn, signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiraEn);
    }
}
