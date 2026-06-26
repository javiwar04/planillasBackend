using Corpetur.Api.Dtos;
using Corpetur.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Corpetur.Api.Controllers;

[Authorize(Policy = "Captura")]
[ApiController]
[Route("api/[controller]")]
public class AguinaldoController : ControllerBase
{
    private readonly NominaService _nomina;
    public AguinaldoController(NominaService nomina) => _nomina = nomina;

    // POST /api/aguinaldo/emitir
    // Emite AGUINALDO o BONO14 en un periodo EXTRA, reemplazando la linea previa
    // del mismo concepto para que repetir la operacion sea idempotente.
    [HttpPost("emitir")]
    public async Task<ActionResult<EmitirAguinaldoResultadoDto>> Emitir(EmitirAguinaldoRequest req)
        => Ok(await _nomina.EmitirAguinaldoAsync(req));
}
