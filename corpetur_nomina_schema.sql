/* ============================================================================
   SISTEMA DE NÓMINA — CORPORACIÓN PETENERA DE TURISMO, S.A. (CORPETUR)
   Esquema de base de datos — PRIMER BORRADOR (SQL Server / T-SQL)
   ----------------------------------------------------------------------------
   Idea central:
     - Los DATOS viven en tablas limpias y normalizadas.
     - Los REPORTES (boleta, quincena, consolidado, pasivo laboral) se calculan,
       no se almacenan duplicados.
     - Los conceptos de ingreso/egreso NO son columnas fijas: son un catálogo +
       líneas de detalle. Agregar "golosinas", "celular", etc. = insertar fila,
       nunca alterar la estructura.

   Tipos de dato de dinero: decimal(14,2). NUNCA float.
   Porcentajes/tasas: decimal(9,4) expresados en PUNTOS PORCENTUALES (ej. 4.83).

   Nota: las tasas (IGSS, ISR, bono 14, etc.) van en una tabla de parámetros,
   no quemadas en el código. Valídalas con tu contador antes de producción;
   este esquema no asume que sean legalmente correctas, solo configurables.
   ============================================================================ */

-- ============================================================================
-- 1. CATÁLOGOS BASE
-- ============================================================================

CREATE TABLE dbo.Establecimiento (
    EstablecimientoId   INT IDENTITY(1,1) PRIMARY KEY,
    Codigo              NVARCHAR(20)  NOT NULL UNIQUE,   -- ej. ISLA, LAGO, MESON
    Nombre              NVARCHAR(150) NOT NULL,
    -- Algunas "planillas" no son hoteles físicos sino entidades de
    -- consolidación (Total Petén, Corpetur, Corpetur Guatemala). Esta bandera
    -- las distingue para que no contaminen reportes operativos.
    EsEntidadContable   BIT           NOT NULL DEFAULT 0,
    Encargado           NVARCHAR(120) NULL,   -- supervisor por defecto de la unidad
    Activo              BIT           NOT NULL DEFAULT 1
);

CREATE TABLE dbo.Departamento (
    DepartamentoId      INT IDENTITY(1,1) PRIMARY KEY,
    Nombre              NVARCHAR(100) NOT NULL UNIQUE     -- Administración, Recepción, Camareras, Cocina, Restaurante, Mantenimiento
);

CREATE TABLE dbo.Puesto (
    PuestoId            INT IDENTITY(1,1) PRIMARY KEY,
    Nombre              NVARCHAR(100) NOT NULL UNIQUE     -- Recepcionista, Camarera, Cocinero, Mesero, etc.
);

-- ============================================================================
-- 2. EMPLEADOS  (incluye planilla y "extras" de efectivo en la misma tabla)
-- ============================================================================

CREATE TABLE dbo.Empleado (
    EmpleadoId          INT IDENTITY(1,1) PRIMARY KEY,
    Codigo              NVARCHAR(20)  NULL,               -- código interno opcional
    Nombres             NVARCHAR(120) NOT NULL,
    Apellidos           NVARCHAR(120) NOT NULL,
    Dpi                 NVARCHAR(20)  NULL,
    Nit                 NVARCHAR(20)  NULL,

    EstablecimientoId   INT NOT NULL REFERENCES dbo.Establecimiento(EstablecimientoId),
    DepartamentoId      INT NULL     REFERENCES dbo.Departamento(DepartamentoId),
    PuestoId            INT NULL     REFERENCES dbo.Puesto(PuestoId),

    -- PLANILLA  = formal, con desglose completo (IGSS, ISR, boleta).
    -- EXTRA      = pago en efectivo, desglose simplificado, sin IGSS/ISR.
    Tipo                NVARCHAR(10)  NOT NULL
                        CONSTRAINT CK_Empleado_Tipo CHECK (Tipo IN ('PLANILLA','EXTRA')),

    -- Datos contractuales. Supervisor = override; si va NULL, manda el Encargado del establecimiento.
    Supervisor          NVARCHAR(120) NULL,
    TipoContrato        NVARCHAR(20)  NULL,   -- INDEFINIDO | TEMPORAL | POR_TEMPORADA | POR_OBRA
    Jornada             NVARCHAR(20)  NULL,   -- COMPLETA | PARCIAL
    ConvenioColectivo   NVARCHAR(120) NULL,
    IsrDeduccionAdicional DECIMAL(14,2) NOT NULL DEFAULT 0,  -- deducción ISR extra anual (seguros, colegios, donaciones)

    SueldoBase          DECIMAL(14,2) NOT NULL DEFAULT 0, -- mensual; para EXTRA puede ser pago/día o referencia
    -- Anticipo estándar de quincena, acordado por persona. La mayoría = Q1,200;
    -- se ajusta para las excepciones. No aplica a EXTRA (efectivo).
    MontoQuincena       DECIMAL(14,2) NOT NULL DEFAULT 1200,
    Banco               NVARCHAR(60)  NULL,               -- ej. Bantrab
    CuentaBanco         NVARCHAR(40)  NULL,

    -- Recursos Humanos (datos del colaborador). Todos opcionales.
    Telefono                     NVARCHAR(30)  NULL,
    Email                        NVARCHAR(120) NULL,
    Direccion                    NVARCHAR(250) NULL,
    NoAfiliacionIgss             NVARCHAR(30)  NULL,       -- No. de afiliación al IGSS
    NoPolizaSeguro               NVARCHAR(40)  NULL,       -- No. de póliza de seguro
    TipoSangre                   NVARCHAR(5)   NULL,       -- ej. O+, AB-
    ContactoEmergenciaNombre     NVARCHAR(120) NULL,
    ContactoEmergenciaParentesco NVARCHAR(50)  NULL,
    ContactoEmergenciaTelefono   NVARCHAR(30)  NULL,

    -- Datos médicos / prevención de riesgos.
    AptitudMedicaVence           DATE          NULL,       -- vence certificado de aptitud
    CarnetManipuladorVence       DATE          NULL,       -- vence carnet de manipulador de alimentos
    Alergias                     NVARCHAR(250) NULL,

    FechaNacimiento     DATE          NULL,
    FechaIngreso        DATE          NULL,
    FechaFinContrato    DATE          NULL,   -- vencimiento de contrato temporal
    FechaBaja           DATE          NULL,
    Activo              BIT           NOT NULL DEFAULT 1,

    CreadoEn            DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    ActualizadoEn       DATETIME2     NULL,

    -- El NIT es obligatorio para PLANILLA; los EXTRA (efectivo) pueden no tenerlo.
    CONSTRAINT CK_Empleado_NitPlanilla CHECK (Tipo = 'EXTRA' OR Nit IS NOT NULL)
);
CREATE INDEX IX_Empleado_Establecimiento ON dbo.Empleado(EstablecimientoId);
CREATE INDEX IX_Empleado_Activo          ON dbo.Empleado(Activo);
-- NIT único entre quienes lo tienen (índice filtrado: los EXTRA sin NIT no chocan).
CREATE UNIQUE INDEX UX_Empleado_Nit ON dbo.Empleado(Nit) WHERE Nit IS NOT NULL;

-- Histórico de traslados (establecimiento / departamento / puesto). Guarda el
-- valor anterior y el nuevo con fecha efectiva; el Empleado apunta al vigente.
CREATE TABLE dbo.EmpleadoMovimiento (
    EmpleadoMovimientoId      INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId                INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    Fecha                     DATE NOT NULL,
    Motivo                    NVARCHAR(200) NULL,
    EstablecimientoAnteriorId INT NULL,
    EstablecimientoNuevoId    INT NULL,
    DepartamentoAnteriorId    INT NULL,
    DepartamentoNuevoId       INT NULL,
    PuestoAnteriorId          INT NULL,
    PuestoNuevoId             INT NULL,
    SueldoAnterior            DECIMAL(14,2) NULL,   -- el traslado puede ser ascenso
    SueldoNuevo               DECIMAL(14,2) NULL,
    CreadoEn                  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_EmpleadoMovimiento_Empleado ON dbo.EmpleadoMovimiento(EmpleadoId);

-- Perfil profesional (idiomas, títulos, cursos, certificaciones, habilidades).
-- Catálogo flexible: una fila por ítem (no columnas fijas).
CREATE TABLE dbo.EmpleadoFormacion (
    EmpleadoFormacionId INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId          INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    Tipo                NVARCHAR(20) NOT NULL
                        CONSTRAINT CK_Formacion_Tipo CHECK (Tipo IN ('IDIOMA','TITULO','CURSO','CERTIFICACION','HABILIDAD')),
    Descripcion         NVARCHAR(150) NOT NULL,   -- ej. "Inglés", "Lic. Administración"
    Detalle             NVARCHAR(150) NULL,       -- ej. "Avanzado", institución
    Anio                INT NULL,
    CreadoEn            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_EmpleadoFormacion_Empleado ON dbo.EmpleadoFormacion(EmpleadoId);

-- Gestión del desempeño (DATO SENSIBLE: la API solo lo expone a RRHH/ADMIN).
-- Una fila por evento: evaluación, amonestación, felicitación, promoción o capacitación.
CREATE TABLE dbo.EventoDesempeno (
    EventoDesempenoId INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId        INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    Fecha             DATE NOT NULL,
    Tipo              NVARCHAR(20) NOT NULL
                      CONSTRAINT CK_Desempeno_Tipo CHECK (Tipo IN ('EVALUACION','AMONESTACION','FELICITACION','PROMOCION','CAPACITACION')),
    Titulo            NVARCHAR(150) NOT NULL,
    Detalle           NVARCHAR(500) NULL,
    CreadoEn          DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_EventoDesempeno_Empleado ON dbo.EventoDesempeno(EmpleadoId);

-- Documentos adjuntos (foto, DPI, contrato, títulos...). El binario vive en disco;
-- aquí va solo la metadata + el nombre del archivo en la carpeta de almacenamiento.
CREATE TABLE dbo.EmpleadoDocumento (
    EmpleadoDocumentoId INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId          INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    Tipo                NVARCHAR(20) NOT NULL
                        CONSTRAINT CK_Documento_Tipo CHECK (Tipo IN ('FOTO','DPI','CONTRATO','TITULO','CERTIFICADO','OTRO')),
    NombreOriginal      NVARCHAR(255) NOT NULL,
    NombreArchivo       NVARCHAR(255) NOT NULL,   -- nombre en disco (guid + ext)
    ContentType         NVARCHAR(120) NOT NULL,
    TamanoBytes         BIGINT NOT NULL,
    CreadoEn            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_EmpleadoDocumento_Empleado ON dbo.EmpleadoDocumento(EmpleadoId);

-- Vacaciones gozadas (períodos tomados por el empleado).
CREATE TABLE dbo.Vacacion (
    VacacionId   INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId   INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    FechaInicio  DATE NOT NULL,
    FechaFin     DATE NOT NULL,
    Dias         DECIMAL(5,2) NOT NULL,
    Observacion  NVARCHAR(200) NULL,
    CreadoEn     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Vacacion_Empleado ON dbo.Vacacion(EmpleadoId);

-- Ausencias / incapacidades (control; el descuento al pago se captura como línea
-- manual en la boleta si aplica).
CREATE TABLE dbo.Ausencia (
    AusenciaId   INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId   INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    FechaInicio  DATE NOT NULL,
    FechaFin     DATE NOT NULL,
    Dias         DECIMAL(5,2) NOT NULL,
    Tipo         NVARCHAR(20) NOT NULL,   -- INCAPACIDAD | PERMISO_CON_GOCE | PERMISO_SIN_GOCE | FALTA | SUSPENSION
    Descontable  BIT NOT NULL DEFAULT 0,
    Observacion  NVARCHAR(200) NULL,
    CreadoEn     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Ausencia_Empleado ON dbo.Ausencia(EmpleadoId);

-- Bitácora de auditoría: quién creó/modificó/eliminó qué y cuándo (la llena un
-- interceptor de EF; ver Services/Auditoria.cs).
CREATE TABLE dbo.Auditoria (
    AuditoriaId  BIGINT IDENTITY(1,1) PRIMARY KEY,
    Fecha        DATETIME2 NOT NULL,
    UsuarioId    INT NULL,
    Usuario      NVARCHAR(120) NULL,
    Accion       NVARCHAR(12) NOT NULL,   -- CREAR | MODIFICAR | ELIMINAR
    Entidad      NVARCHAR(60) NOT NULL,
    EntidadId    NVARCHAR(40) NULL,
    Detalle      NVARCHAR(500) NULL
);
CREATE INDEX IX_Auditoria_Fecha ON dbo.Auditoria(Fecha DESC);

-- ============================================================================
-- 3. PERÍODOS DE PAGO  (quincena y fin de mes)
-- ============================================================================

CREATE TABLE dbo.PeriodoPago (
    PeriodoPagoId       INT IDENTITY(1,1) PRIMARY KEY,
    Anio                INT NOT NULL,
    Mes                 TINYINT NOT NULL CHECK (Mes BETWEEN 1 AND 12),
    -- QUINCENA = pago de mitad de mes (~día 15/16).
    -- FIN_MES  = liquidación de fin de mes.
    -- EXTRA = pago especial (propina/comisión/bono) que se paga aparte del sueldo.
    Tipo                NVARCHAR(10) NOT NULL
                        CONSTRAINT CK_Periodo_Tipo CHECK (Tipo IN ('QUINCENA','FIN_MES','EXTRA')),
    FechaInicio         DATE NOT NULL,
    FechaFin            DATE NOT NULL,
    FechaPago           DATE NULL,
    -- ABIERTO   = se está capturando.
    -- CALCULADO = boletas generadas, revisable.
    -- CERRADO   = pagado e inmutable (histórico).
    Estado              NVARCHAR(12) NOT NULL DEFAULT 'ABIERTO'
                        CONSTRAINT CK_Periodo_Estado CHECK (Estado IN ('ABIERTO','CALCULADO','CERRADO')),
    CONSTRAINT UQ_Periodo UNIQUE (Anio, Mes, Tipo)
);

-- ============================================================================
-- 4. CATÁLOGO DE CONCEPTOS  (la clave de la flexibilidad)
-- ============================================================================

CREATE TABLE dbo.Concepto (
    ConceptoId          INT IDENTITY(1,1) PRIMARY KEY,
    Codigo              NVARCHAR(30)  NOT NULL UNIQUE,
    Nombre              NVARCHAR(120) NOT NULL,
    -- INGRESO suma al bruto; EGRESO se descuenta.
    Naturaleza          NVARCHAR(10)  NOT NULL
                        CONSTRAINT CK_Concepto_Nat CHECK (Naturaleza IN ('INGRESO','EGRESO')),
    -- Si es un concepto que se calcula automáticamente (IGSS, comisión) vs.
    -- uno que se captura a mano (anticipo, golosinas).
    EsCalculado         BIT           NOT NULL DEFAULT 0,
    Orden               INT           NOT NULL DEFAULT 0,  -- orden de despliegue en la boleta
    Activo              BIT           NOT NULL DEFAULT 1
);

-- ============================================================================
-- 5. BOLETA (recibo de pago) + DETALLE
--    Una boleta por empleado por período. El detalle son las líneas.
-- ============================================================================

CREATE TABLE dbo.Boleta (
    BoletaId            INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId          INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    PeriodoPagoId       INT NOT NULL REFERENCES dbo.PeriodoPago(PeriodoPagoId),

    -- Totales calculados al cerrar (se guardan para fijar el histórico y no
    -- recalcular contra parámetros que pudieron cambiar después).
    TotalIngresos       DECIMAL(14,2) NOT NULL DEFAULT 0,
    TotalEgresos        DECIMAL(14,2) NOT NULL DEFAULT 0,
    Liquido             AS (TotalIngresos - TotalEgresos) PERSISTED,

    Estado              NVARCHAR(12) NOT NULL DEFAULT 'BORRADOR'
                        CONSTRAINT CK_Boleta_Estado CHECK (Estado IN ('BORRADOR','CALCULADA','PAGADA')),
    Observaciones       NVARCHAR(400) NULL,

    CreadoEn            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ActualizadoEn       DATETIME2 NULL,

    CONSTRAINT UQ_Boleta UNIQUE (EmpleadoId, PeriodoPagoId)   -- 1 boleta por empleado/período
);
CREATE INDEX IX_Boleta_Periodo ON dbo.Boleta(PeriodoPagoId);

CREATE TABLE dbo.BoletaDetalle (
    BoletaDetalleId     INT IDENTITY(1,1) PRIMARY KEY,
    BoletaId            INT NOT NULL REFERENCES dbo.Boleta(BoletaId) ON DELETE CASCADE,
    ConceptoId          INT NOT NULL REFERENCES dbo.Concepto(ConceptoId),
    Monto               DECIMAL(14,2) NOT NULL,
    Descripcion         NVARCHAR(200) NULL,        -- nota libre, ej. "comisión jun 1-15"
    -- Origen opcional: de dónde salió la línea (cálculo de comisión, préstamo).
    PrestamoMovimientoId INT NULL
);
CREATE INDEX IX_BoletaDetalle_Boleta   ON dbo.BoletaDetalle(BoletaId);
CREATE INDEX IX_BoletaDetalle_Concepto ON dbo.BoletaDetalle(ConceptoId);

-- ============================================================================
-- 6. PRÉSTAMOS / ANTICIPOS  (saldo amortizable: "Préstamo Corpetur", "Bantrab")
--    Resuelve el "Saldo Actual / Saldo Anterior" que llevaban a mano.
-- ============================================================================

CREATE TABLE dbo.Prestamo (
    PrestamoId          INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId          INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    Tipo                NVARCHAR(20) NOT NULL,          -- CORPETUR, BANTRAB, OTRO
    MontoOriginal       DECIMAL(14,2) NOT NULL,
    CuotaSugerida       DECIMAL(14,2) NULL,             -- cuota por período
    Saldo               DECIMAL(14,2) NOT NULL,         -- saldo vigente
    FechaInicio         DATE NOT NULL,
    Estado              NVARCHAR(12) NOT NULL DEFAULT 'ACTIVO'
                        CONSTRAINT CK_Prestamo_Estado CHECK (Estado IN ('ACTIVO','PAGADO','CANCELADO'))
);
CREATE INDEX IX_Prestamo_Empleado ON dbo.Prestamo(EmpleadoId);

CREATE TABLE dbo.PrestamoMovimiento (
    PrestamoMovimientoId INT IDENTITY(1,1) PRIMARY KEY,
    PrestamoId          INT NOT NULL REFERENCES dbo.Prestamo(PrestamoId),
    PeriodoPagoId       INT NULL REFERENCES dbo.PeriodoPago(PeriodoPagoId),
    Fecha               DATE NOT NULL,
    -- DESEMBOLSO suma al saldo; ABONO (descuento en boleta) lo baja.
    Tipo                NVARCHAR(12) NOT NULL CHECK (Tipo IN ('DESEMBOLSO','ABONO','AJUSTE')),
    Monto               DECIMAL(14,2) NOT NULL,
    SaldoResultante     DECIMAL(14,2) NOT NULL
);

-- ============================================================================
-- 7. MÉTRICAS DIARIAS  (ventas / ocupación que alimentan bonificaciones)
-- ============================================================================

CREATE TABLE dbo.MetricaDiaria (
    MetricaDiariaId     INT IDENTITY(1,1) PRIMARY KEY,
    EstablecimientoId   INT NOT NULL REFERENCES dbo.Establecimiento(EstablecimientoId),
    Fecha               DATE NOT NULL,
    -- VENTA (en quetzales o unidades), OCUPACION (% o cuartos-noche).
    TipoMetrica         NVARCHAR(15) NOT NULL CHECK (TipoMetrica IN ('VENTA','OCUPACION')),
    Categoria           NVARCHAR(60) NULL,     -- ej. "cervezas", "alimentos", "general"
    Valor               DECIMAL(14,2) NOT NULL,
    CONSTRAINT UQ_Metrica UNIQUE (EstablecimientoId, Fecha, TipoMetrica, Categoria)
);
CREATE INDEX IX_Metrica_Estab_Fecha ON dbo.MetricaDiaria(EstablecimientoId, Fecha);

-- Regla que convierte métricas en una bonificación/comisión para la boleta.
-- Diseño simple a propósito: puede crecer a un motor de reglas más adelante.
CREATE TABLE dbo.ReglaBonificacion (
    ReglaBonificacionId INT IDENTITY(1,1) PRIMARY KEY,
    Nombre              NVARCHAR(120) NOT NULL,
    -- Alcance: a quién aplica (cualquiera puede ser NULL = "todos").
    EstablecimientoId   INT NULL REFERENCES dbo.Establecimiento(EstablecimientoId),
    DepartamentoId      INT NULL REFERENCES dbo.Departamento(DepartamentoId),
    EmpleadoId          INT NULL REFERENCES dbo.Empleado(EmpleadoId),
    -- Base de cálculo y forma.
    BaseMetrica         NVARCHAR(15) NOT NULL CHECK (BaseMetrica IN ('VENTA','OCUPACION')),
    TipoCalculo         NVARCHAR(20) NOT NULL CHECK (TipoCalculo IN ('PORCENTAJE','MONTO_POR_UNIDAD','ESCALA')),
    Parametro           DECIMAL(14,4) NOT NULL,   -- % o monto por unidad; ESCALA usa tabla aparte (futuro)
    ConceptoId          INT NOT NULL REFERENCES dbo.Concepto(ConceptoId),  -- dónde cae el resultado en la boleta
    Activo              BIT NOT NULL DEFAULT 1
);

-- ============================================================================
-- 8. PARÁMETROS DE NÓMINA  (tasas configurables — NO quemadas en código)
-- ============================================================================

CREATE TABLE dbo.ParametroNomina (
    Clave               NVARCHAR(40) PRIMARY KEY,
    Valor               DECIMAL(14,4) NOT NULL,
    Descripcion         NVARCHAR(200) NULL,
    VigenteDesde        DATE NULL
);

-- ============================================================================
-- 9. PROVISIÓN / PASIVO LABORAL  (histórico mensual)
--    Una fila por empleado por mes con las provisiones acumuladas.
-- ============================================================================

CREATE TABLE dbo.ProvisionLaboral (
    ProvisionLaboralId  INT IDENTITY(1,1) PRIMARY KEY,
    EmpleadoId          INT NOT NULL REFERENCES dbo.Empleado(EmpleadoId),
    Anio                INT NOT NULL,
    Mes                 TINYINT NOT NULL CHECK (Mes BETWEEN 1 AND 12),
    BaseCalculo         DECIMAL(14,2) NOT NULL,   -- normalmente sueldo + bonificaciones
    Indemnizacion       DECIMAL(14,2) NOT NULL DEFAULT 0,  -- 8.33%
    Bono14              DECIMAL(14,2) NOT NULL DEFAULT 0,  -- 8.33%
    Aguinaldo           DECIMAL(14,2) NOT NULL DEFAULT 0,  -- 8.33%
    Vacaciones          DECIMAL(14,2) NOT NULL DEFAULT 0,  -- 4.17%
    IgssPatronal        DECIMAL(14,2) NOT NULL DEFAULT 0,  -- cuota patronal
    Intecap             DECIMAL(14,2) NOT NULL DEFAULT 0,  -- 1%
    CONSTRAINT UQ_Provision UNIQUE (EmpleadoId, Anio, Mes)
);

-- ============================================================================
-- 10. USUARIOS  (mínimo — la autenticación real va con ASP.NET Identity)
-- ============================================================================

CREATE TABLE dbo.Usuario (
    UsuarioId           INT IDENTITY(1,1) PRIMARY KEY,
    Nombre              NVARCHAR(120) NOT NULL,
    Email               NVARCHAR(150) NOT NULL UNIQUE,
    Rol                 NVARCHAR(20)  NOT NULL DEFAULT 'CAPTURA',  -- ADMIN, CONTABILIDAD, CAPTURA, LECTURA
    Activo              BIT NOT NULL DEFAULT 1,
    -- Hash PBKDF2 de la contraseña (PasswordHasher de ASP.NET). NUNCA texto plano.
    PasswordHash        NVARCHAR(255) NULL
);


/* ============================================================================
   DATOS SEMILLA  (catálogos, aterrizados en lo que aparece en tus archivos)
   ============================================================================ */

INSERT INTO dbo.Departamento (Nombre) VALUES
 (N'Administración'), (N'Recepción'), (N'Camareras'),
 (N'Cocina'), (N'Restaurante'), (N'Mantenimiento');

INSERT INTO dbo.Establecimiento (Codigo, Nombre, EsEntidadContable) VALUES
 (N'ISLA',     N'Casona de la Isla',          0),
 (N'LAGO',     N'Casona del Lago',            0),
 (N'TURQUESA', N'Hotel Casa Turquesa',        0),
 (N'CASAZUL',  N'Hotel Casa Zul',             0),
 (N'PETEN',    N'Hotel Petén',                0),
 (N'VILLA',    N'Villa del Lago',             0),
 (N'MESON',    N'Restaurante El Mesón Tikal', 0),
 (N'MANTTO',    N'Mantenimiento',              0),
 (N'CONTA',     N'Contabilidad (Corpetur)',    0),   -- "Planilla Corpetur" = oficina administrativa, personal real
 (N'GUATEVIVA', N'Guateviva',                  0),   -- "Corpetur Guatemala" = Guateviva, establecimiento real
 (N'TOTAL_PT',  N'Total Petén (Agencia)',      0);   -- agencia de viajes, personal propio

-- Conceptos: INGRESOS
-- Los códigos alimentan las casillas de la Declaración Jurada Anual (SAT). Los de
-- uso excepcional (viáticos, dietas, gratificaciones, gasto de representación) se
-- siembran para que existan si alguna vez se capturan, aunque normalmente vayan en 0.
INSERT INTO dbo.Concepto (Codigo, Nombre, Naturaleza, EsCalculado, Orden) VALUES
 (N'SUELDO',        N'Sueldo base',                        N'INGRESO', 0, 10),
 (N'BONO_INC',      N'Bonificación incentivo Dto. 37-2001',N'INGRESO', 0, 20),
 (N'BONO_OTRO',     N'Otras bonificaciones',               N'INGRESO', 0, 30),
 (N'COMISION',      N'Comisión sobre venta',               N'INGRESO', 1, 40),
 (N'HORAS_EXTRA',   N'Horas extras',                       N'INGRESO', 0, 50),
 (N'PROPINA',       N'Propinas',                           N'INGRESO', 0, 55),
 (N'AGUINALDO',     N'Aguinaldo',                          N'INGRESO', 0, 70),
 (N'BONO14',        N'Bono 14 (bono anual)',               N'INGRESO', 0, 75),
 (N'VIATICOS',      N'Viáticos',                           N'INGRESO', 0, 80),
 (N'GASTO_REP',     N'Gasto de representación',            N'INGRESO', 0, 82),
 (N'DIETAS',        N'Dietas',                             N'INGRESO', 0, 84),
 (N'GRATIFIC',      N'Gratificaciones',                    N'INGRESO', 0, 86),
 (N'OTRO_INGRESO',  N'Otros ingresos',                     N'INGRESO', 0, 60);

-- Conceptos: EGRESOS / DESCUENTOS
INSERT INTO dbo.Concepto (Codigo, Nombre, Naturaleza, EsCalculado, Orden) VALUES
 (N'ANTICIPO',      N'Anticipo de sueldo',                 N'EGRESO', 0, 110),
 (N'PREST_CORP',    N'Préstamo Corpetur',                  N'EGRESO', 0, 120),
 (N'PREST_BANTRAB', N'Préstamo Bantrab',                   N'EGRESO', 0, 130),
 (N'ARTICULOS',     N'Descuento de artículos',             N'EGRESO', 0, 140),
 (N'IGSS',          N'IGSS laboral',                       N'EGRESO', 1, 150),
 (N'ISR',           N'ISR',                                N'EGRESO', 0, 160),
 (N'GOLOSINAS',     N'Golosinas',                          N'EGRESO', 0, 170),
 (N'UNIFORMES',     N'Uniformes',                          N'EGRESO', 0, 180),
 (N'CELULAR',       N'Celular',                            N'EGRESO', 0, 190);

-- Parámetros (PUNTOS PORCENTUALES). VALIDAR CON CONTADOR antes de usar.
INSERT INTO dbo.ParametroNomina (Clave, Valor, Descripcion) VALUES
 (N'IGSS_LABORAL',   4.8300, N'Cuota laboral IGSS (% sobre sueldo)'),
 (N'IGSS_PATRONAL', 10.6700, N'Cuota patronal IGSS (% sobre sueldo)'),
 (N'INTECAP',        1.0000, N'INTECAP (% sobre sueldo)'),
 (N'INDEMNIZACION',  8.3300, N'Provisión indemnización (%)'),
 (N'BONO14',         8.3300, N'Provisión bono 14 (%)'),
 (N'AGUINALDO',      8.3300, N'Provisión aguinaldo (%)'),
 (N'VACACIONES',     4.1700, N'Provisión vacaciones (%)'),
 (N'BONO_INCENTIVO', 250.00, N'Bonificación incentivo Dto. 37-2001 (monto fijo Q)'),
 -- ISR Régimen de Asalariados (Dto. 10-2012). La deducción única cambia por año:
 -- el contador la ajusta. Tramo 1: 5% hasta el límite; sobre el excedente, base + 7%.
 (N'ISR_DEDUCCION',      48000.0000, N'ISR: deducción única anual (Q). Ajustable por año.'),
 (N'ISR_TASA1',              5.0000, N'ISR: tasa tramo 1 (%)'),
 (N'ISR_TRAMO1_LIMITE',  300000.0000, N'ISR: límite de renta imponible del tramo 1 (Q)'),
 (N'ISR_TASA2',              7.0000, N'ISR: tasa tramo 2 (% sobre el excedente)'),
 (N'ISR_TRAMO2_BASE',     15000.0000, N'ISR: impuesto base del tramo 2 (Q = 5% de 300,000)');
