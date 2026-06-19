using Corpetur.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// --- Servicios ---
builder.Services.AddDbContext<CorpeturDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("CorpeturDb")));

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

app.UseHttpsRedirection();
app.UseCors(CorsPolicy);
app.MapControllers();

app.Run();
