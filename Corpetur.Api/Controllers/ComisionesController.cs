using Corpetur.Api.Dtos;
using Corpetur.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ComisionesController : ControllerBase
{
    private readonly NominaService _nomina;
    public ComisionesController(NominaService nomina) => _nomina = nomina;

    // POST /api/comisiones/repartir
    // Reparte la bolsa de comisión de UN establecimiento entre su personal: en partes
    // iguales (modo IGUAL, todos los de planilla activos del establecimiento por defecto)
    // o por peso (modo PESO, requiere la lista de empleados con su peso). Genera/actualiza
    // la línea de comisión en la boleta de cada uno para el período indicado.
    [HttpPost("repartir")]
    public async Task<ActionResult<RepartoResultadoDto>> Repartir(RepartoComisionRequest req)
        => Ok(await _nomina.RepartirComisionAsync(req));
}
