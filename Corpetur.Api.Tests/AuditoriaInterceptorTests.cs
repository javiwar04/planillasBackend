using Corpetur.Api.Data;
using Corpetur.Api.Entities;
using Corpetur.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Tests;

public class AuditoriaInterceptorTests
{
    private sealed class UsuarioFake : IUsuarioActual
    {
        public int? Id { get; init; }
        public string? Nombre { get; init; }
    }

    private static CorpeturDbContext NuevoContexto(IUsuarioActual usuario) =>
        new(new DbContextOptionsBuilder<CorpeturDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .AddInterceptors(new AuditoriaInterceptor(usuario))
            .Options);

    [Fact]
    public async Task Alta_registraAuditoriaConUsuario()
    {
        var user = new UsuarioFake { Id = 7, Nombre = "María" };
        using var db = NuevoContexto(user);

        db.Establecimientos.Add(new Establecimiento { Codigo = "ISLA", Nombre = "Isla" });
        await db.SaveChangesAsync();

        var a = await db.Auditorias.SingleAsync(x => x.Entidad == "Establecimiento");
        Assert.Equal("CREAR", a.Accion);
        Assert.Equal(7, a.UsuarioId);
        Assert.Equal("María", a.Usuario);
    }

    [Fact]
    public async Task Modificacion_registraModificar()
    {
        using var db = NuevoContexto(new UsuarioFake { Id = 1, Nombre = "Admin" });
        var est = new Establecimiento { Codigo = "LAGO", Nombre = "Lago" };
        db.Establecimientos.Add(est);
        await db.SaveChangesAsync();

        est.Nombre = "Casona del Lago";
        await db.SaveChangesAsync();

        Assert.True(await db.Auditorias.AnyAsync(x => x.Entidad == "Establecimiento" && x.Accion == "MODIFICAR"));
    }

    [Fact]
    public async Task LaAuditoriaNoSeAuditaASiMisma()
    {
        using var db = NuevoContexto(new UsuarioFake { Id = 1, Nombre = "Admin" });
        db.Empleados.Add(new Empleado { Nombres = "A", Apellidos = "B", Nit = "X1", EstablecimientoId = 1, Tipo = "PLANILLA" });
        await db.SaveChangesAsync();

        // Una sola fila de auditoría (la del empleado), no una cascada infinita.
        Assert.Equal(1, await db.Auditorias.CountAsync());
    }
}
