using Corpetur.Api.Entities;
using Microsoft.EntityFrameworkCore;

namespace Corpetur.Api.Data;

public class CorpeturDbContext : DbContext
{
    public CorpeturDbContext(DbContextOptions<CorpeturDbContext> options) : base(options) { }

    public DbSet<Establecimiento> Establecimientos => Set<Establecimiento>();
    public DbSet<Departamento> Departamentos => Set<Departamento>();
    public DbSet<Puesto> Puestos => Set<Puesto>();
    public DbSet<Empleado> Empleados => Set<Empleado>();
    public DbSet<EmpleadoMovimiento> EmpleadoMovimientos => Set<EmpleadoMovimiento>();
    public DbSet<EmpleadoFormacion> Formaciones => Set<EmpleadoFormacion>();
    public DbSet<EventoDesempeno> EventosDesempeno => Set<EventoDesempeno>();
    public DbSet<Vacacion> Vacaciones => Set<Vacacion>();
    public DbSet<Ausencia> Ausencias => Set<Ausencia>();
    public DbSet<PeriodoPago> PeriodosPago => Set<PeriodoPago>();
    public DbSet<Concepto> Conceptos => Set<Concepto>();
    public DbSet<Boleta> Boletas => Set<Boleta>();
    public DbSet<BoletaDetalle> BoletaDetalles => Set<BoletaDetalle>();
    public DbSet<Prestamo> Prestamos => Set<Prestamo>();
    public DbSet<PrestamoMovimiento> PrestamoMovimientos => Set<PrestamoMovimiento>();
    public DbSet<MetricaDiaria> MetricasDiarias => Set<MetricaDiaria>();
    public DbSet<ReglaBonificacion> ReglasBonificacion => Set<ReglaBonificacion>();
    public DbSet<ParametroNomina> ParametrosNomina => Set<ParametroNomina>();
    public DbSet<ProvisionLaboral> ProvisionesLaboral => Set<ProvisionLaboral>();
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Auditoria> Auditorias => Set<Auditoria>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Establecimiento>().HasIndex(e => e.Codigo).IsUnique();
        b.Entity<Concepto>().HasIndex(c => c.Codigo).IsUnique();
        b.Entity<PeriodoPago>().HasIndex(p => new { p.Anio, p.Mes, p.Tipo }).IsUnique();
        b.Entity<Boleta>().HasIndex(x => new { x.EmpleadoId, x.PeriodoPagoId }).IsUnique();
        b.Entity<ProvisionLaboral>().HasIndex(p => new { p.EmpleadoId, p.Anio, p.Mes }).IsUnique();
        b.Entity<Usuario>().HasIndex(u => u.Email).IsUnique();

        // NIT único entre quienes lo tienen (planilla); los extras sin NIT no chocan.
        b.Entity<Empleado>().HasIndex(e => e.Nit).IsUnique().HasFilter("[Nit] IS NOT NULL");

        b.Entity<BoletaDetalle>()
            .HasOne(d => d.Boleta).WithMany(x => x.Detalles)
            .HasForeignKey(d => d.BoletaId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<Empleado>().Property(e => e.CreadoEn).HasDefaultValueSql("SYSUTCDATETIME()");
        b.Entity<Boleta>().Property(e => e.CreadoEn).HasDefaultValueSql("SYSUTCDATETIME()");
        b.Entity<EmpleadoMovimiento>().Property(e => e.CreadoEn).HasDefaultValueSql("SYSUTCDATETIME()");
        b.Entity<EmpleadoMovimiento>().HasIndex(e => e.EmpleadoId);
        b.Entity<Vacacion>().Property(e => e.CreadoEn).HasDefaultValueSql("SYSUTCDATETIME()");
        b.Entity<Vacacion>().HasIndex(e => e.EmpleadoId);
        b.Entity<Ausencia>().Property(e => e.CreadoEn).HasDefaultValueSql("SYSUTCDATETIME()");
        b.Entity<Ausencia>().HasIndex(e => e.EmpleadoId);
    }
}
