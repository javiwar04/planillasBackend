using System.Text;
using Corpetur.Api.Data;
using Corpetur.Api.Entities;
using Corpetur.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// --- Servicios ---
// Auditoría: usuario actual desde el HttpContext + interceptor que registra cambios.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IUsuarioActual, UsuarioActualHttp>();
builder.Services.AddScoped<AuditoriaInterceptor>();

builder.Services.AddDbContext<CorpeturDbContext>((sp, opt) =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("CorpeturDb"))
       .AddInterceptors(sp.GetRequiredService<AuditoriaInterceptor>()));

// Motor de cálculo de boletas (bloque 3).
builder.Services.AddScoped<NominaService>();

// Autenticación / contraseñas.
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Falta Jwt:Key en la configuración.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "CorpeturApi",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "CorpeturApi",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

// Por defecto TODO requiere usuario autenticado; los endpoints públicos usan [AllowAnonymous].
// Política "Captura": roles que pueden escribir (LECTURA queda solo de consulta).
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    options.AddPolicy("Captura", p => p.RequireRole("ADMIN", "CONTABILIDAD", "CAPTURA", "RRHH"));
    // Recursos Humanos: datos sensibles (desempeño). Solo ADMIN y RRHH.
    options.AddPolicy("RecursosHumanos", p => p.RequireRole("ADMIN", "RRHH"));
});

builder.Services.AddControllers(o => o.Conventions.Add(new PermisosEscrituraConvention()))
    // DateOnly/serialización JSON estándar; los enums-string ya son texto en BD.
    .AddJsonOptions(_ => { });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // Botón "Authorize" en Swagger para mandar el token Bearer.
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Pega aquí el token JWT (sin la palabra 'Bearer')."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// CORS para el frontend Next.js. En producción se usa Cors:FrontendOrigin (subdominio);
// en desarrollo se permite además el Next dev server local (puerto 3000).
const string CorsPolicy = "frontend";
var origenes = new List<string>();
var origenConfig = builder.Configuration["Cors:FrontendOrigin"];
if (!string.IsNullOrWhiteSpace(origenConfig)) origenes.Add(origenConfig);
if (builder.Environment.IsDevelopment())
{
    origenes.Add("http://localhost:3000");
    origenes.Add("https://localhost:3000");
}
builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p =>
    p.WithOrigins(origenes.ToArray()).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// Siembra un usuario ADMIN si no existe ninguno (primer arranque).
await SeedAdminAsync(app);

// --- Pipeline ---
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Traduce los errores de regla de negocio a códigos HTTP claros:
//   NominaException -> 409 (conflicto de estado) o 400 (validación)
//   KeyNotFoundException -> 404
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (NominaException ex)
    {
        ctx.Response.StatusCode = ex.Conflict ? StatusCodes.Status409Conflict : StatusCodes.Status400BadRequest;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
    catch (KeyNotFoundException ex)
    {
        ctx.Response.StatusCode = StatusCodes.Status404NotFound;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

app.UseHttpsRedirection();
app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// ============================================================================
// Seed del usuario administrador inicial.
// ============================================================================
static async Task SeedAdminAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<CorpeturDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
    var cfg = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    var log = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // Solo si NO existe ya un usuario con contraseña (no pisar nada).
    if (await db.Usuarios.AnyAsync(u => u.PasswordHash != null)) return;

    var email = cfg["AdminSeed:Email"] ?? "admin@corpetur.local";
    var nombre = cfg["AdminSeed:Nombre"] ?? "Administrador";
    var pass = cfg["AdminSeed:Password"] ?? "Corpetur2026!";

    var admin = await db.Usuarios.FirstOrDefaultAsync(u => u.Email == email);
    if (admin is null)
    {
        admin = new Usuario { Nombre = nombre, Email = email, Rol = "ADMIN", Activo = true };
        db.Usuarios.Add(admin);
    }
    else
    {
        admin.Rol = "ADMIN";
        admin.Activo = true;
    }
    admin.PasswordHash = hasher.HashPassword(admin, pass);
    await db.SaveChangesAsync();

    log.LogWarning("Usuario ADMIN inicial creado: {Email} (cambia la contraseña tras el primer login).", email);
}
