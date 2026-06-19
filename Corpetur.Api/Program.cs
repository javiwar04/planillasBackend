using Corpetur.Api.Data;
using Corpetur.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// --- Servicios ---
builder.Services.AddDbContext<CorpeturDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("CorpeturDb")));

// Motor de cálculo de boletas (bloque 3).
builder.Services.AddScoped<NominaService>();

builder.Services.AddControllers()
    // DateOnly/serialización JSON estándar; los enums-string ya son texto en BD.
    .AddJsonOptions(_ => { });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS para el frontend Next.js (subdominio configurable en appsettings).
const string CorsPolicy = "frontend";
var frontendOrigin = builder.Configuration["Cors:FrontendOrigin"] ?? "http://localhost:3000";
builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p =>
    p.WithOrigins(frontendOrigin).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

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
app.MapControllers();

app.Run();
