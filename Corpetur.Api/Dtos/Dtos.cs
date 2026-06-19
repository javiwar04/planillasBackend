namespace Corpetur.Api.Dtos;

// DTOs simples para no exponer las entidades directamente (evita over-posting
// y referencias circulares al serializar).

public record EstablecimientoDto(int EstablecimientoId, string Codigo, string Nombre, bool EsEntidadContable, bool Activo);
public record EstablecimientoCreateDto(string Codigo, string Nombre, bool EsEntidadContable);

public record ConceptoDto(int ConceptoId, string Codigo, string Nombre, string Naturaleza, bool EsCalculado, int Orden, bool Activo);
public record ConceptoCreateDto(string Codigo, string Nombre, string Naturaleza, bool EsCalculado, int Orden);

public record EmpleadoDto(
    int EmpleadoId,
    string? Codigo,
    string Nombres,
    string Apellidos,
    string? Dpi,
    string? Nit,
    int EstablecimientoId,
    string? EstablecimientoNombre,
    int? DepartamentoId,
    string? DepartamentoNombre,
    int? PuestoId,
    string Tipo,
    decimal SueldoBase,
    decimal MontoQuincena,
    string? Banco,
    string? CuentaBanco,
    DateOnly? FechaIngreso,
    DateOnly? FechaBaja,
    bool Activo);

public record EmpleadoCreateDto(
    string? Codigo,
    string Nombres,
    string Apellidos,
    string? Dpi,
    string? Nit,
    int EstablecimientoId,
    int? DepartamentoId,
    int? PuestoId,
    string Tipo,
    decimal SueldoBase,
    decimal MontoQuincena,
    string? Banco,
    string? CuentaBanco,
    DateOnly? FechaIngreso);

// --- Catálogos simples ---
public record DepartamentoDto(int DepartamentoId, string Nombre);
public record DepartamentoCreateDto(string Nombre);

public record PuestoDto(int PuestoId, string Nombre);
public record PuestoCreateDto(string Nombre);

// --- Períodos de pago ---
public record PeriodoPagoDto(int PeriodoPagoId, int Anio, byte Mes, string Tipo,
    DateOnly FechaInicio, DateOnly FechaFin, DateOnly? FechaPago, string Estado);
public record PeriodoPagoCreateDto(int Anio, byte Mes, string Tipo,
    DateOnly FechaInicio, DateOnly FechaFin, DateOnly? FechaPago);

// --- Préstamos ---
public record PrestamoDto(int PrestamoId, int EmpleadoId, string? EmpleadoNombre, string Tipo,
    decimal MontoOriginal, decimal? CuotaSugerida, decimal Saldo, DateOnly FechaInicio, string Estado);
public record PrestamoCreateDto(int EmpleadoId, string Tipo, decimal MontoOriginal,
    decimal? CuotaSugerida, decimal? Saldo, DateOnly FechaInicio);

public record PrestamoMovimientoDto(int PrestamoMovimientoId, int PrestamoId, int? PeriodoPagoId,
    DateOnly Fecha, string Tipo, decimal Monto, decimal SaldoResultante);
public record PrestamoMovimientoCreateDto(int PrestamoId, int? PeriodoPagoId,
    DateOnly Fecha, string Tipo, decimal Monto, decimal SaldoResultante);

// --- Métricas diarias ---
public record MetricaDiariaDto(int MetricaDiariaId, int EstablecimientoId, string? EstablecimientoNombre,
    DateOnly Fecha, string TipoMetrica, string? Categoria, decimal Valor);
public record MetricaDiariaCreateDto(int EstablecimientoId, DateOnly Fecha,
    string TipoMetrica, string? Categoria, decimal Valor);

// --- Reglas de bonificación ---
public record ReglaBonificacionDto(int ReglaBonificacionId, string Nombre, int? EstablecimientoId,
    int? DepartamentoId, int? EmpleadoId, string BaseMetrica, string TipoCalculo, decimal Parametro,
    int ConceptoId, bool Activo);
public record ReglaBonificacionCreateDto(string Nombre, int? EstablecimientoId, int? DepartamentoId,
    int? EmpleadoId, string BaseMetrica, string TipoCalculo, decimal Parametro, int ConceptoId);

// --- Parámetros de nómina (tasas configurables) ---
public record ParametroNominaDto(string Clave, decimal Valor, string? Descripcion, DateOnly? VigenteDesde);
public record ParametroNominaCreateDto(string Clave, decimal Valor, string? Descripcion, DateOnly? VigenteDesde);

// --- Provisión / pasivo laboral ---
public record ProvisionLaboralDto(int ProvisionLaboralId, int EmpleadoId, string? EmpleadoNombre,
    int Anio, byte Mes, decimal BaseCalculo, decimal Indemnizacion, decimal Bono14, decimal Aguinaldo,
    decimal Vacaciones, decimal IgssPatronal, decimal Intecap);
public record ProvisionLaboralCreateDto(int EmpleadoId, int Anio, byte Mes, decimal BaseCalculo,
    decimal Indemnizacion, decimal Bono14, decimal Aguinaldo, decimal Vacaciones,
    decimal IgssPatronal, decimal Intecap);

// --- Usuarios ---
public record UsuarioDto(int UsuarioId, string Nombre, string Email, string Rol, bool Activo);
public record UsuarioCreateDto(string Nombre, string Email, string Rol);
