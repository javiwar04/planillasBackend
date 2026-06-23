using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.AspNetCore.Mvc.Authorization;

namespace Corpetur.Api.Services;

/// <summary>
/// Regla por convención: toda acción de ESCRITURA (POST/PUT/DELETE/PATCH) exige el
/// rol de captura (ADMIN/CONTABILIDAD/CAPTURA), dejando fuera a LECTURA. No se aplica
/// a acciones que ya declaran su propia autorización ([Authorize] con roles) ni a las
/// públicas ([AllowAnonymous]) — así /auth/login y /auth/cambiar-password no se rompen,
/// y las operaciones sensibles conservan su restricción más estricta.
/// </summary>
public class PermisosEscrituraConvention : IActionModelConvention
{
    private static readonly Type[] Escritura =
        { typeof(HttpPostAttribute), typeof(HttpPutAttribute), typeof(HttpDeleteAttribute), typeof(HttpPatchAttribute) };

    public void Apply(ActionModel action)
    {
        var esEscritura = action.Attributes.Any(a => Escritura.Contains(a.GetType()));
        if (!esEscritura) return;

        var yaDeclarada =
            action.Attributes.OfType<IAuthorizeData>().Any() ||
            action.Attributes.OfType<IAllowAnonymous>().Any() ||
            action.Controller.Attributes.OfType<IAuthorizeData>().Any() ||
            action.Controller.Attributes.OfType<IAllowAnonymous>().Any();
        if (yaDeclarada) return;

        action.Filters.Add(new AuthorizeFilter("Captura"));
    }
}
