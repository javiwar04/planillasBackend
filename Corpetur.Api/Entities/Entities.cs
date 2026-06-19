using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Corpetur.Api.Entities;

// Mapeo database-first contra corpetur_nomina_schema.sql.
// Cada [Table] coincide con la tabla; los nombres de propiedad coinciden con las
// columnas (esquema dbo por defecto). Los decimales llevan TypeName explícito
// para que coincidan EXACTO con SQL y EF no trunque silenciosamente.

[Table("Establecimiento")]
public class Establecimiento
{
    [Key] public int EstablecimientoId { get; set; }
    [MaxLength(20)] public string Codigo { get; set; } = null!;
    [MaxLength(150)] public string Nombre { get; set; } = null!;
    public bool EsEntidadContable { get; set; }
    public bool Activo { get; set; } = true;

    public ICollection<Empleado> Empleados { get; set; } = new List<Empleado>();
}

[Table("Departamento")]
public class Departamento
{
    [Key] public int DepartamentoId { get; set; }
    [MaxLength(100)] public string Nombre { get; set; } = null!;
}

[Table("Puesto")]
public class Puesto
{
    [Key] public int PuestoId { get; set; }
    [MaxLength(100)] public string Nombre { get; set; } = null!;
}

[Table("Empleado")]
public class Empleado
{
    [Key] public int EmpleadoId { get; set; }
    [MaxLength(20)] public string? Codigo { get; set; }
    [MaxLength(120)] public string Nombres { get; set; } = null!;
    [MaxLength(120)] public string Apellidos { get; set; } = null!;
    [MaxLength(20)] public string? Dpi { get; set; }
    [MaxLength(20)] public string? Nit { get; set; }

    public int EstablecimientoId { get; set; }
    public Establecimiento? Establecimiento { get; set; }
    public int? DepartamentoId { get; set; }
    public Departamento? Departamento { get; set; }
    public int? PuestoId { get; set; }
    public Puesto? Puesto { get; set; }

    [MaxLength(10)] public string Tipo { get; set; } = "PLANILLA"; // PLANILLA | EXTRA

    [Column(TypeName = "decimal(14,2)")] public decimal SueldoBase { get; set; }
    // Anticipo estándar de quincena acordado por persona (default Q1,200 en SQL).
    // No aplica a EXTRA (efectivo). Ver regla de quincena en CLAUDE.md.
    [Column(TypeName = "decimal(14,2)")] public decimal MontoQuincena { get; set; } = 1200m;
    [MaxLength(60)] public string? Banco { get; set; }
    [MaxLength(40)] public string? CuentaBanco { get; set; }

    public DateOnly? FechaIngreso { get; set; }
    public DateOnly? FechaBaja { get; set; }
    public bool Activo { get; set; } = true;

    public DateTime CreadoEn { get; set; }
    public DateTime? ActualizadoEn { get; set; }
}

[Table("PeriodoPago")]
public class PeriodoPago
{
    [Key] public int PeriodoPagoId { get; set; }
    public int Anio { get; set; }
    public byte Mes { get; set; }
    [MaxLength(10)] public string Tipo { get; set; } = null!;   // QUINCENA | FIN_MES
    public DateOnly FechaInicio { get; set; }
    public DateOnly FechaFin { get; set; }
    public DateOnly? FechaPago { get; set; }
    [MaxLength(12)] public string Estado { get; set; } = "ABIERTO";

    public ICollection<Boleta> Boletas { get; set; } = new List<Boleta>();
}

[Table("Concepto")]
public class Concepto
{
    [Key] public int ConceptoId { get; set; }
    [MaxLength(30)] public string Codigo { get; set; } = null!;
    [MaxLength(120)] public string Nombre { get; set; } = null!;
    [MaxLength(10)] public string Naturaleza { get; set; } = null!; // INGRESO | EGRESO
    public bool EsCalculado { get; set; }
    public int Orden { get; set; }
    public bool Activo { get; set; } = true;
}

[Table("Boleta")]
public class Boleta
{
    [Key] public int BoletaId { get; set; }
    public int EmpleadoId { get; set; }
    public Empleado? Empleado { get; set; }
    public int PeriodoPagoId { get; set; }
    public PeriodoPago? PeriodoPago { get; set; }

    [Column(TypeName = "decimal(14,2)")] public decimal TotalIngresos { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal TotalEgresos { get; set; }

    // Columna calculada PERSISTED en SQL; EF solo la lee.
    [Column(TypeName = "decimal(15,2)")]
    [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
    public decimal Liquido { get; private set; }

    [MaxLength(12)] public string Estado { get; set; } = "BORRADOR";
    [MaxLength(400)] public string? Observaciones { get; set; }
    public DateTime CreadoEn { get; set; }
    public DateTime? ActualizadoEn { get; set; }

    public ICollection<BoletaDetalle> Detalles { get; set; } = new List<BoletaDetalle>();
}

[Table("BoletaDetalle")]
public class BoletaDetalle
{
    [Key] public int BoletaDetalleId { get; set; }
    public int BoletaId { get; set; }
    public Boleta? Boleta { get; set; }
    public int ConceptoId { get; set; }
    public Concepto? Concepto { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Monto { get; set; }
    [MaxLength(200)] public string? Descripcion { get; set; }
    public int? PrestamoMovimientoId { get; set; }
}

[Table("Prestamo")]
public class Prestamo
{
    [Key] public int PrestamoId { get; set; }
    public int EmpleadoId { get; set; }
    public Empleado? Empleado { get; set; }
    [MaxLength(20)] public string Tipo { get; set; } = null!; // CORPETUR | BANTRAB | OTRO
    [Column(TypeName = "decimal(14,2)")] public decimal MontoOriginal { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal? CuotaSugerida { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Saldo { get; set; }
    public DateOnly FechaInicio { get; set; }
    [MaxLength(12)] public string Estado { get; set; } = "ACTIVO";

    public ICollection<PrestamoMovimiento> Movimientos { get; set; } = new List<PrestamoMovimiento>();
}

[Table("PrestamoMovimiento")]
public class PrestamoMovimiento
{
    [Key] public int PrestamoMovimientoId { get; set; }
    public int PrestamoId { get; set; }
    public Prestamo? Prestamo { get; set; }
    public int? PeriodoPagoId { get; set; }
    public DateOnly Fecha { get; set; }
    [MaxLength(12)] public string Tipo { get; set; } = null!; // DESEMBOLSO | ABONO | AJUSTE
    [Column(TypeName = "decimal(14,2)")] public decimal Monto { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal SaldoResultante { get; set; }
}

[Table("MetricaDiaria")]
public class MetricaDiaria
{
    [Key] public int MetricaDiariaId { get; set; }
    public int EstablecimientoId { get; set; }
    public Establecimiento? Establecimiento { get; set; }
    public DateOnly Fecha { get; set; }
    [MaxLength(15)] public string TipoMetrica { get; set; } = null!; // VENTA | OCUPACION
    [MaxLength(60)] public string? Categoria { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Valor { get; set; }
}

[Table("ReglaBonificacion")]
public class ReglaBonificacion
{
    [Key] public int ReglaBonificacionId { get; set; }
    [MaxLength(120)] public string Nombre { get; set; } = null!;
    public int? EstablecimientoId { get; set; }
    public int? DepartamentoId { get; set; }
    public int? EmpleadoId { get; set; }
    [MaxLength(15)] public string BaseMetrica { get; set; } = null!;
    [MaxLength(20)] public string TipoCalculo { get; set; } = null!;
    [Column(TypeName = "decimal(14,4)")] public decimal Parametro { get; set; }
    public int ConceptoId { get; set; }
    public bool Activo { get; set; } = true;
}

[Table("ParametroNomina")]
public class ParametroNomina
{
    [Key, MaxLength(40)] public string Clave { get; set; } = null!;
    [Column(TypeName = "decimal(14,4)")] public decimal Valor { get; set; }
    [MaxLength(200)] public string? Descripcion { get; set; }
    public DateOnly? VigenteDesde { get; set; }
}

[Table("ProvisionLaboral")]
public class ProvisionLaboral
{
    [Key] public int ProvisionLaboralId { get; set; }
    public int EmpleadoId { get; set; }
    public Empleado? Empleado { get; set; }
    public int Anio { get; set; }
    public byte Mes { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal BaseCalculo { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Indemnizacion { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Bono14 { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Aguinaldo { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Vacaciones { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal IgssPatronal { get; set; }
    [Column(TypeName = "decimal(14,2)")] public decimal Intecap { get; set; }
}

[Table("Usuario")]
public class Usuario
{
    [Key] public int UsuarioId { get; set; }
    [MaxLength(120)] public string Nombre { get; set; } = null!;
    [MaxLength(150)] public string Email { get; set; } = null!;
    [MaxLength(20)] public string Rol { get; set; } = "CAPTURA";
    public bool Activo { get; set; } = true;
    // Hash PBKDF2 de la contraseña (nunca texto plano). NULL = usuario sin acceso aún.
    [MaxLength(255)] public string? PasswordHash { get; set; }
}
