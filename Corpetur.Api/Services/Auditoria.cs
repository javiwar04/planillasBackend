using System.Security.Claims;
using Corpetur.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Corpetur.Api.Services;

/// <summary>Quién es el usuario de la petición actual (desacopla del HttpContext para poder testear).</summary>
public interface IUsuarioActual
{
    int? Id { get; }
    string? Nombre { get; }
}

public class UsuarioActualHttp : IUsuarioActual
{
    private readonly IHttpContextAccessor _http;
    public UsuarioActualHttp(IHttpContextAccessor http) => _http = http;

    public int? Id =>
        int.TryParse(_http.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var i) ? i : null;
    public string? Nombre => _http.HttpContext?.User?.FindFirstValue(ClaimTypes.Name);
}

/// <summary>
/// Interceptor de EF Core que registra en la tabla Auditoria cada alta/cambio/baja.
/// Es "best-effort": si el registro de auditoría falla, NUNCA rompe la operación
/// principal (que ya se guardó). Captura antes de guardar y persiste después
/// (para conocer las llaves de los registros nuevos), con guarda anti-recursión.
/// </summary>
public class AuditoriaInterceptor : SaveChangesInterceptor
{
    private readonly IUsuarioActual _usuario;
    private bool _interno;
    private readonly List<Pendiente> _pend = new();

    public AuditoriaInterceptor(IUsuarioActual usuario) => _usuario = usuario;

    private sealed class Pendiente
    {
        public EntityEntry Entry = null!;
        public string Accion = null!;
        public string Entidad = null!;
        public string? Clave;
        public string? Detalle;
    }

    public override InterceptionResult<int> SavingChanges(DbContextEventData ed, InterceptionResult<int> result)
    {
        if (!_interno && ed.Context is not null) Capturar(ed.Context);
        return base.SavingChanges(ed, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData ed, InterceptionResult<int> result, CancellationToken ct = default)
    {
        if (!_interno && ed.Context is not null) Capturar(ed.Context);
        return base.SavingChangesAsync(ed, result, ct);
    }

    public override int SavedChanges(SaveChangesCompletedEventData ed, int result)
    {
        Persistir(ed.Context);
        return base.SavedChanges(ed, result);
    }

    public override async ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData ed, int result, CancellationToken ct = default)
    {
        Persistir(ed.Context);
        return await base.SavedChangesAsync(ed, result, ct);
    }

    private void Capturar(DbContext ctx)
    {
        _pend.Clear();
        foreach (var e in ctx.ChangeTracker.Entries())
        {
            if (e.Entity is Auditoria) continue;
            var accion = e.State switch
            {
                EntityState.Added => "CREAR",
                EntityState.Modified => "MODIFICAR",
                EntityState.Deleted => "ELIMINAR",
                _ => null,
            };
            if (accion is null) continue;

            var p = new Pendiente { Entry = e, Accion = accion, Entidad = e.Metadata.ClrType.Name };
            if (accion != "CREAR") p.Clave = Clave(e);     // la llave de altas se conoce después de guardar
            if (accion == "MODIFICAR")
                p.Detalle = string.Join(", ", e.Properties.Where(x => x.IsModified).Select(x => x.Metadata.Name));
            _pend.Add(p);
        }
    }

    private void Persistir(DbContext? ctx)
    {
        if (_interno || ctx is null || _pend.Count == 0) return;
        var pendientes = _pend.ToList();
        _pend.Clear();

        try
        {
            foreach (var p in pendientes.Where(p => p.Accion == "CREAR")) p.Clave = Clave(p.Entry);
            var filas = pendientes.Select(p => new Auditoria
            {
                Fecha = DateTime.UtcNow,
                UsuarioId = _usuario.Id,
                Usuario = _usuario.Nombre,
                Accion = p.Accion,
                Entidad = p.Entidad,
                EntidadId = p.Clave,
                Detalle = p.Detalle is { Length: > 500 } ? p.Detalle[..500] : p.Detalle,
            }).ToList();

            ctx.Set<Auditoria>().AddRange(filas);
            _interno = true;
            ctx.SaveChanges();
        }
        catch
        {
            // Auditoría best-effort: nunca rompe la operación principal.
        }
        finally
        {
            _interno = false;
        }
    }

    private static string? Clave(EntityEntry e)
    {
        var pk = e.Metadata.FindPrimaryKey();
        if (pk is null) return null;
        try
        {
            var vals = pk.Properties.Select(p => e.Property(p.Name).CurrentValue?.ToString());
            return string.Join("-", vals);
        }
        catch { return null; }
    }
}
