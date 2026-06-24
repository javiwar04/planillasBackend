namespace Corpetur.Api.Dtos;

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

// --- Traslados / movimientos de empleado ---
public record TrasladoRequest(DateOnly Fecha, int? EstablecimientoId, int? DepartamentoId, int? PuestoId,
    decimal? SueldoBase, string? Motivo);
public record EmpleadoMovimientoDto(
    int EmpleadoMovimientoId, int EmpleadoId, DateOnly Fecha, string? Motivo,
    int? EstablecimientoAnteriorId, string? EstablecimientoAnterior,
    int? EstablecimientoNuevoId, string? EstablecimientoNuevo,
    int? DepartamentoAnteriorId, string? DepartamentoAnterior,
    int? DepartamentoNuevoId, string? DepartamentoNuevo,
    int? PuestoAnteriorId, string? PuestoAnterior,
    int? PuestoNuevoId, string? PuestoNuevo,
    decimal? SueldoAnterior, decimal? SueldoNuevo);

// --- Vacaciones ---
public record VacacionDto(int VacacionId, int EmpleadoId, string? EmpleadoNombre,
    DateOnly FechaInicio, DateOnly FechaFin, decimal Dias, string? Observacion);
public record VacacionCreateDto(int EmpleadoId, DateOnly FechaInicio, DateOnly FechaFin,
    decimal Dias, string? Observacion);

// --- Ausencias / incapacidades ---
public record AusenciaDto(int AusenciaId, int EmpleadoId, string? EmpleadoNombre,
    DateOnly FechaInicio, DateOnly FechaFin, decimal Dias, string Tipo, bool Descontable, string? Observacion);
public record AusenciaCreateDto(int EmpleadoId, DateOnly FechaInicio, DateOnly FechaFin,
    decimal Dias, string Tipo, bool Descontable, string? Observacion);

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

// --- Auditoría ---
public record AuditoriaDto(long AuditoriaId, DateTime Fecha, int? UsuarioId, string? Usuario,
    string Accion, string Entidad, string? EntidadId, string? Detalle);

// --- Usuarios ---
public record UsuarioDto(int UsuarioId, string Nombre, string Email, string Rol, bool Activo);
// La contraseña es opcional al crear: si viene, se guarda hasheada; si no, el usuario
// queda sin acceso hasta que un ADMIN le asigne una.
public record UsuarioCreateDto(string Nombre, string Email, string Rol, string? Password);

// --- Autenticación ---
public record LoginRequest(string Email, string Password);
public record LoginResponse(string Token, DateTime ExpiraEn, UsuarioDto Usuario);
public record CambiarPasswordRequest(string PasswordActual, string PasswordNueva);
public record ResetPasswordRequest(string PasswordNueva);

// ============================================================================
// BLOQUE 3 — Boletas, motor de cálculo y reparto de comisión
// ============================================================================

// --- Boletas ---
public record BoletaDetalleDto(int BoletaDetalleId, int ConceptoId, string ConceptoCodigo,
    string ConceptoNombre, string Naturaleza, decimal Monto, string? Descripcion,
    bool EsCalculado, int? PrestamoMovimientoId);

public record BoletaListDto(int BoletaId, int EmpleadoId, string EmpleadoNombre,
    int PeriodoPagoId, string Estado, decimal TotalIngresos, decimal TotalEgresos, decimal Liquido);

public record BoletaDto(int BoletaId, int EmpleadoId, string EmpleadoNombre, int PeriodoPagoId,
    string Estado, decimal TotalIngresos, decimal TotalEgresos, decimal Liquido,
    string? Observaciones, IEnumerable<BoletaDetalleDto> Detalles);

// Alta/edición de una línea manual de la boleta (comisión, ISR, bonificación, descuento...).
public record BoletaLineaCreateDto(int ConceptoId, decimal Monto, string? Descripcion);

// --- Generación de período ---
public record QuincenaOverrideDto(int EmpleadoId, decimal Monto);
public record GenerarPeriodoRequest(List<QuincenaOverrideDto>? OverridesQuincena);
public record GenerarResultadoDto(int PeriodoPagoId, string Tipo, string Estado,
    int BoletasCreadas, int BoletasActualizadas, int EmpleadosPlanilla);

public record ProvisionesResultadoDto(int Anio, int Mes, int Generadas, int Actualizadas);

// --- Reparto de comisión por establecimiento ---
public record RepartoItemDto(int EmpleadoId, decimal? Peso);
public record RepartoComisionRequest(
    int PeriodoPagoId,
    int? EstablecimientoId,      // opcional si se manda lista de empleados (pueden ser de varios)
    decimal MontoTotal,
    string Modo,                 // IGUAL | PESO
    int? ConceptoId,             // default: concepto COMISION
    string? Descripcion,
    List<RepartoItemDto>? Empleados);   // null = todos los de planilla activos del establecimiento
public record RepartoResultadoItemDto(int EmpleadoId, string EmpleadoNombre, decimal Monto);
public record RepartoResultadoDto(decimal MontoTotal, decimal MontoRepartido, int Empleados,
    IEnumerable<RepartoResultadoItemDto> Detalle);
