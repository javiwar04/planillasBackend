using Corpetur.Api.Data;
using Corpetur.Api.Dtos;
using Corpetur.Api.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Controllers;

// Documentos adjuntos del colaborador. El binario vive en disco (carpeta de
// almacenamiento configurable); la BD guarda solo la metadata. La subida/borrado
// exige rol de captura (vía convención); leer/descargar, usuario autenticado.
[ApiController]
[Route("api/[controller]")]
public class DocumentosController : ControllerBase
{
    private static readonly string[] Tipos = { "FOTO", "DPI", "CONTRATO", "TITULO", "CERTIFICADO", "OTRO" };
    private static readonly Dictionary<string, string> ExtPermitidas = new(StringComparer.OrdinalIgnoreCase)
    {
        [".jpg"] = "image/jpeg", [".jpeg"] = "image/jpeg", [".png"] = "image/png",
        [".webp"] = "image/webp", [".gif"] = "image/gif", [".pdf"] = "application/pdf",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    private const long MaxBytes = 10 * 1024 * 1024; // 10 MB

    private readonly CorpeturDbContext _db;
    private readonly string _rutaBase;

    public DocumentosController(CorpeturDbContext db, IWebHostEnvironment env, IConfiguration cfg)
    {
        _db = db;
        var ruta = cfg["Almacenamiento:RutaDocumentos"];
        _rutaBase = string.IsNullOrWhiteSpace(ruta)
            ? Path.Combine(env.ContentRootPath, "App_Data", "documentos")
            : ruta;
    }

    // GET /api/documentos?empleadoId=5
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DocumentoDto>>> GetAll([FromQuery] int? empleadoId)
    {
        var q = _db.Documentos.AsNoTracking().AsQueryable();
        if (empleadoId is not null) q = q.Where(d => d.EmpleadoId == empleadoId);
        var list = await q.OrderByDescending(d => d.CreadoEn).ToListAsync();
        return Ok(list.Select(ToDto).ToList());
    }

    // POST /api/documentos  (multipart/form-data: empleadoId, tipo, archivo)
    [HttpPost]
    [RequestSizeLimit(MaxBytes + 1024 * 1024)]
    public async Task<ActionResult<DocumentoDto>> Subir(
        [FromForm] int empleadoId, [FromForm] string tipo, IFormFile? archivo)
    {
        if (!await _db.Empleados.AnyAsync(e => e.EmpleadoId == empleadoId))
            return BadRequest("El empleado no existe.");
        var t = (tipo ?? "").ToUpperInvariant();
        if (!Tipos.Contains(t))
            return BadRequest("Tipo debe ser FOTO, DPI, CONTRATO, TITULO, CERTIFICADO u OTRO.");
        if (archivo is null || archivo.Length == 0)
            return BadRequest("No se recibió ningún archivo.");
        if (archivo.Length > MaxBytes)
            return BadRequest("El archivo supera el máximo de 10 MB.");

        var ext = Path.GetExtension(archivo.FileName);
        if (string.IsNullOrEmpty(ext) || !ExtPermitidas.TryGetValue(ext, out var contentType))
            return BadRequest("Formato no permitido (usa imagen, PDF o Word).");

        Directory.CreateDirectory(_rutaBase);
        var nombreEnDisco = $"{Guid.NewGuid():N}{ext.ToLowerInvariant()}";
        var rutaFisica = Path.Combine(_rutaBase, nombreEnDisco);
        await using (var fs = System.IO.File.Create(rutaFisica))
            await archivo.CopyToAsync(fs);

        var doc = new EmpleadoDocumento
        {
            EmpleadoId = empleadoId, Tipo = t,
            NombreOriginal = Path.GetFileName(archivo.FileName),
            NombreArchivo = nombreEnDisco, ContentType = contentType,
            TamanoBytes = archivo.Length, CreadoEn = DateTime.UtcNow,
        };
        _db.Documentos.Add(doc);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAll), new { empleadoId }, ToDto(doc));
    }

    // GET /api/documentos/5/contenido  -> sirve el binario (inline) para ver/descargar.
    [HttpGet("{id:int}/contenido")]
    public async Task<IActionResult> Contenido(int id)
    {
        var doc = await _db.Documentos.AsNoTracking().FirstOrDefaultAsync(d => d.EmpleadoDocumentoId == id);
        if (doc is null) return NotFound();
        var ruta = Path.Combine(_rutaBase, doc.NombreArchivo);
        if (!System.IO.File.Exists(ruta)) return NotFound("El archivo ya no está en el almacenamiento.");
        var stream = System.IO.File.OpenRead(ruta);
        return File(stream, doc.ContentType); // inline; el frontend decide ver o descargar
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var doc = await _db.Documentos.FindAsync(id);
        if (doc is null) return NotFound();
        var ruta = Path.Combine(_rutaBase, doc.NombreArchivo);
        if (System.IO.File.Exists(ruta))
            try { System.IO.File.Delete(ruta); } catch { /* el registro se borra igual */ }
        _db.Documentos.Remove(doc);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static DocumentoDto ToDto(EmpleadoDocumento d) =>
        new(d.EmpleadoDocumentoId, d.EmpleadoId, d.Tipo, d.NombreOriginal, d.ContentType, d.TamanoBytes, d.CreadoEn);
}
