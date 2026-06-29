using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmpleadosController : ControllerBase
{
    private readonly CorpeturDbContext _db;
    public EmpleadosController(CorpeturDbContext db) => _db = db;

    // GET /api/empleados?establecimientoId=1&tipo=PLANILLA&soloActivos=true&buscar=lopez
    [HttpGet]
    public async Task<ActionResult<IEnumerable<EmpleadoDto>>> GetAll(
        [FromQuery] int? establecimientoId,
        [FromQuery] string? tipo,
        [FromQuery] bool soloActivos = true,
        [FromQuery] string? buscar = null)
    {
        var q = _db.Empleados.AsNoTracking()
            .Include(e => e.Establecimiento)
            .Include(e => e.Departamento)
            .AsQueryable();

        if (establecimientoId is not null) q = q.Where(e => e.EstablecimientoId == establecimientoId);
        if (tipo is "PLANILLA" or "EXTRA") q = q.Where(e => e.Tipo == tipo);
        if (soloActivos) q = q.Where(e => e.Activo);
        if (!string.IsNullOrWhiteSpace(buscar))
        {
            var t = buscar.Trim();
            q = q.Where(e => EF.Functions.Like(e.Nombres + " " + e.Apellidos, $"%{t}%")
                          || (e.Nit != null && EF.Functions.Like(e.Nit, $"%{t}%")));
        }


        var entities = await q.OrderBy(e => e.Apellidos).ThenBy(e => e.Nombres).ToListAsync();
        return Ok(entities.Select(ToDto).ToList());
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EmpleadoDto>> Get(int id)
    {
        var e = await _db.Empleados.AsNoTracking()
            .Include(x => x.Establecimiento).Include(x => x.Departamento)
            .FirstOrDefaultAsync(x => x.EmpleadoId == id);
        return e is null ? NotFound() : ToDto(e);
    }

    // GET /api/empleados/por-nit/12345678  — identificación operativa por NIT.
    [HttpGet("por-nit/{nit}")]
    public async Task<ActionResult<EmpleadoDto>> GetPorNit(string nit)
    {
        var e = await _db.Empleados.AsNoTracking()
            .Include(x => x.Establecimiento).Include(x => x.Departamento)
            .FirstOrDefaultAsync(x => x.Nit == nit);
        return e is null ? NotFound() : ToDto(e);
    }

    [HttpPost]
    public async Task<ActionResult<EmpleadoDto>> Create(EmpleadoCreateDto dto)
    {
        if (dto.Tipo is not ("PLANILLA" or "EXTRA"))
            return BadRequest("Tipo debe ser 'PLANILLA' o 'EXTRA'.");
        if (!await _db.Establecimientos.AnyAsync(x => x.EstablecimientoId == dto.EstablecimientoId))
            return BadRequest("El establecimiento no existe.");

        // NIT obligatorio para planilla; opcional para extras.
        if (dto.Tipo == "PLANILLA" && string.IsNullOrWhiteSpace(dto.Nit))
            return BadRequest("El NIT es obligatorio para empleados de planilla.");
        // Si trae NIT, que no esté repetido.
        if (!string.IsNullOrWhiteSpace(dto.Nit) &&
            await _db.Empleados.AnyAsync(x => x.Nit == dto.Nit))
            return Conflict($"Ya existe un empleado con NIT '{dto.Nit}'.");

        var e = new Empleado
        {
            Codigo = dto.Codigo, Nombres = dto.Nombres, Apellidos = dto.Apellidos,
            Dpi = dto.Dpi, Nit = dto.Nit,
            EstablecimientoId = dto.EstablecimientoId, DepartamentoId = dto.DepartamentoId, PuestoId = dto.PuestoId,
            Tipo = dto.Tipo, SueldoBase = dto.SueldoBase, MontoQuincena = dto.MontoQuincena,
            Banco = dto.Banco, CuentaBanco = dto.CuentaBanco,
            Telefono = dto.Telefono, Email = dto.Email, Direccion = dto.Direccion,
            NoAfiliacionIgss = dto.NoAfiliacionIgss, NoPolizaSeguro = dto.NoPolizaSeguro, TipoSangre = dto.TipoSangre,
            ContactoEmergenciaNombre = dto.ContactoEmergenciaNombre,
            ContactoEmergenciaParentesco = dto.ContactoEmergenciaParentesco,
            ContactoEmergenciaTelefono = dto.ContactoEmergenciaTelefono,
            AptitudMedicaVence = dto.AptitudMedicaVence,
            CarnetManipuladorVence = dto.CarnetManipuladorVence,
            Alergias = dto.Alergias,
            FechaIngreso = dto.FechaIngreso
        };
        _db.Empleados.Add(e);
        await _db.SaveChangesAsync();
        await _db.Entry(e).Reference(x => x.Establecimiento).LoadAsync();
        await _db.Entry(e).Reference(x => x.Departamento).LoadAsync();
        return CreatedAtAction(nameof(Get), new { id = e.EmpleadoId }, ToDto(e));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, EmpleadoCreateDto dto)
    {
        var e = await _db.Empleados.FindAsync(id);
        if (e is null) return NotFound();

        if (dto.Tipo == "PLANILLA" && string.IsNullOrWhiteSpace(dto.Nit))
            return BadRequest("El NIT es obligatorio para empleados de planilla.");
        if (!string.IsNullOrWhiteSpace(dto.Nit) &&
            await _db.Empleados.AnyAsync(x => x.Nit == dto.Nit && x.EmpleadoId != id))
            return Conflict($"Ya existe otro empleado con NIT '{dto.Nit}'.");

        e.Codigo = dto.Codigo; e.Nombres = dto.Nombres; e.Apellidos = dto.Apellidos;
        e.Dpi = dto.Dpi; e.Nit = dto.Nit;
        e.EstablecimientoId = dto.EstablecimientoId; e.DepartamentoId = dto.DepartamentoId; e.PuestoId = dto.PuestoId;
        e.Tipo = dto.Tipo; e.SueldoBase = dto.SueldoBase; e.MontoQuincena = dto.MontoQuincena;
        e.Banco = dto.Banco; e.CuentaBanco = dto.CuentaBanco;
        e.Telefono = dto.Telefono; e.Email = dto.Email; e.Direccion = dto.Direccion;
        e.NoAfiliacionIgss = dto.NoAfiliacionIgss; e.NoPolizaSeguro = dto.NoPolizaSeguro; e.TipoSangre = dto.TipoSangre;
        e.ContactoEmergenciaNombre = dto.ContactoEmergenciaNombre;
        e.ContactoEmergenciaParentesco = dto.ContactoEmergenciaParentesco;
        e.ContactoEmergenciaTelefono = dto.ContactoEmergenciaTelefono;
        e.AptitudMedicaVence = dto.AptitudMedicaVence;
        e.CarnetManipuladorVence = dto.CarnetManipuladorVence;
        e.Alergias = dto.Alergias;
        e.FechaIngreso = dto.FechaIngreso;
        e.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Baja del empleado: marca inactivo + fecha de baja. Nunca se borra (histórico).
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DarDeBaja(int id, [FromQuery] DateOnly? fechaBaja = null)
    {
        var e = await _db.Empleados.FindAsync(id);
        if (e is null) return NotFound();
        e.Activo = false;
        e.FechaBaja = fechaBaja ?? DateOnly.FromDateTime(DateTime.Today);
        e.ActualizadoEn = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Traslado: registra el movimiento (anterior → nuevo) y actualiza el valor vigente
    // del empleado. Solo cambia las dimensiones que se envían.
    [HttpPost("{id:int}/traslado")]
    public async Task<ActionResult<EmpleadoMovimientoDto>> Traslado(int id, TrasladoRequest dto)
    {
        var e = await _db.Empleados.FindAsync(id);
        if (e is null) return NotFound();

        var cambiaEstab = dto.EstablecimientoId is not null && dto.EstablecimientoId != e.EstablecimientoId;
        var cambiaDepto = dto.DepartamentoId is not null && dto.DepartamentoId != e.DepartamentoId;
        var cambiaPuesto = dto.PuestoId is not null && dto.PuestoId != e.PuestoId;
        var cambiaSueldo = dto.SueldoBase is not null && dto.SueldoBase != e.SueldoBase;
        if (cambiaSueldo && dto.SueldoBase < 0)
            return BadRequest("El sueldo no puede ser negativo.");
        if (!cambiaEstab && !cambiaDepto && !cambiaPuesto && !cambiaSueldo)
            return BadRequest("Indica al menos un cambio (establecimiento, departamento, puesto o sueldo).");

        if (cambiaEstab && !await _db.Establecimientos.AnyAsync(x => x.EstablecimientoId == dto.EstablecimientoId))
            return BadRequest("El establecimiento destino no existe.");
        if (cambiaDepto && !await _db.Departamentos.AnyAsync(x => x.DepartamentoId == dto.DepartamentoId))
            return BadRequest("El departamento destino no existe.");
        if (cambiaPuesto && !await _db.Puestos.AnyAsync(x => x.PuestoId == dto.PuestoId))
            return BadRequest("El puesto destino no existe.");

        var mov = new EmpleadoMovimiento
        {
            EmpleadoId = id, Fecha = dto.Fecha, Motivo = dto.Motivo,
            EstablecimientoAnteriorId = cambiaEstab ? e.EstablecimientoId : null,
            EstablecimientoNuevoId = cambiaEstab ? dto.EstablecimientoId : null,
            DepartamentoAnteriorId = cambiaDepto ? e.DepartamentoId : null,
            DepartamentoNuevoId = cambiaDepto ? dto.DepartamentoId : null,
            PuestoAnteriorId = cambiaPuesto ? e.PuestoId : null,
            PuestoNuevoId = cambiaPuesto ? dto.PuestoId : null,
            SueldoAnterior = cambiaSueldo ? e.SueldoBase : null,
            SueldoNuevo = cambiaSueldo ? dto.SueldoBase : null,
        };
        _db.EmpleadoMovimientos.Add(mov);

        if (cambiaEstab) e.EstablecimientoId = dto.EstablecimientoId!.Value;
        if (cambiaDepto) e.DepartamentoId = dto.DepartamentoId;
        if (cambiaPuesto) e.PuestoId = dto.PuestoId;
        if (cambiaSueldo) e.SueldoBase = dto.SueldoBase!.Value;
        e.ActualizadoEn = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return await MovimientoDto(mov.EmpleadoMovimientoId);
    }

    // Historial de traslados del empleado (más reciente primero).
    [HttpGet("{id:int}/movimientos")]
    public async Task<ActionResult<IEnumerable<EmpleadoMovimientoDto>>> Movimientos(int id)
    {
        var movs = await _db.EmpleadoMovimientos.AsNoTracking()
            .Where(m => m.EmpleadoId == id)
            .OrderByDescending(m => m.Fecha).ThenByDescending(m => m.EmpleadoMovimientoId)
            .ToListAsync();
        var estab = await _db.Establecimientos.AsNoTracking().ToDictionaryAsync(x => x.EstablecimientoId, x => x.Nombre);
        var depto = await _db.Departamentos.AsNoTracking().ToDictionaryAsync(x => x.DepartamentoId, x => x.Nombre);
        var pues = await _db.Puestos.AsNoTracking().ToDictionaryAsync(x => x.PuestoId, x => x.Nombre);
        static string? N(Dictionary<int, string> d, int? k) => k is int i && d.TryGetValue(i, out var v) ? v : null;
        return Ok(movs.Select(m => new EmpleadoMovimientoDto(
            m.EmpleadoMovimientoId, m.EmpleadoId, m.Fecha, m.Motivo,
            m.EstablecimientoAnteriorId, N(estab, m.EstablecimientoAnteriorId),
            m.EstablecimientoNuevoId, N(estab, m.EstablecimientoNuevoId),
            m.DepartamentoAnteriorId, N(depto, m.DepartamentoAnteriorId),
            m.DepartamentoNuevoId, N(depto, m.DepartamentoNuevoId),
            m.PuestoAnteriorId, N(pues, m.PuestoAnteriorId),
            m.PuestoNuevoId, N(pues, m.PuestoNuevoId),
            m.SueldoAnterior, m.SueldoNuevo)).ToList());
    }

    private async Task<ActionResult<EmpleadoMovimientoDto>> MovimientoDto(int movId)
    {
        var m = await _db.EmpleadoMovimientos.FindAsync(movId);
        if (m is null) return NotFound();
        var resp = await Movimientos(m.EmpleadoId);
        var dto = (resp.Result as OkObjectResult)?.Value as IEnumerable<EmpleadoMovimientoDto>;
        return Ok(dto?.FirstOrDefault(x => x.EmpleadoMovimientoId == movId));
    }

    private static EmpleadoDto ToDto(Empleado e) => new(
        e.EmpleadoId, e.Codigo, e.Nombres, e.Apellidos, e.Dpi, e.Nit,
        e.EstablecimientoId, e.Establecimiento?.Nombre,
        e.DepartamentoId, e.Departamento?.Nombre,
        e.PuestoId, e.Tipo, e.SueldoBase, e.MontoQuincena, e.Banco, e.CuentaBanco,
        e.Telefono, e.Email, e.Direccion, e.NoAfiliacionIgss, e.NoPolizaSeguro, e.TipoSangre,
        e.ContactoEmergenciaNombre, e.ContactoEmergenciaParentesco, e.ContactoEmergenciaTelefono,
        e.AptitudMedicaVence, e.CarnetManipuladorVence, e.Alergias,
        e.FechaIngreso, e.FechaBaja, e.Activo);
}
