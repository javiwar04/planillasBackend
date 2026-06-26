# AGENTS.md — Sistema de Nómina CORPETUR

Contexto del proyecto para Codex. Léelo antes de trabajar.

## Qué es

Sistema central de **planillas/nómina** para Corporación Petenera de Turismo (CORPETUR).
Reemplaza ~11 archivos Excel sueltos por una sola base con histórico por persona y
por establecimiento. Lo usa **contabilidad central** (pocos usuarios, todos ven todo;
no hay separación de acceso por establecimiento).

## Stack

- **Backend:** ASP.NET Core Web API (.NET 8) + EF Core, mapeo **database-first**.
- **Base de datos:** SQL Server (corre el `corpetur_nomina_schema.sql`; la app NO crea ni migra la base).
- **Frontend (futuro):** Next.js + React, en un subdominio. Consumirá esta API.
- **Despliegue:** VPS propio del cliente, en un subdominio existente.

## Estructura actual

```
/corpetur_nomina_schema.sql   <- esquema completo; correr en SQL Server primero
/Corpetur.Api/                <- proyecto Web API (bloque 2: entidades + DbContext + CRUD base)
```

## Cómo correr

1. Crear base `CorpeturNomina` en SQL Server y ejecutar `corpetur_nomina_schema.sql`.
2. Ajustar `Corpetur.Api/appsettings.json` → `ConnectionStrings:CorpeturDb`.
3. `cd Corpetur.Api && dotnet restore && dotnet run` → Swagger en desarrollo.

## Modelo de datos (resumen)

- **Establecimiento, Departamento, Puesto**: catálogos. Los 11 establecimientos son
  operativos con personal propio (ninguno es de consolidación).
- **Empleado**: planilla o extra. PK interna = `EmpleadoId` (int IDENTITY).
- **PeriodoPago**: cadencia `QUINCENA` o `FIN_MES`; estados ABIERTO → CALCULADO → CERRADO.
- **Concepto** + **BoletaDetalle**: catálogo de ingresos/egresos + líneas. NO usar
  columnas fijas por concepto; agregar concepto = insertar fila.
- **Boleta**: una por empleado por período (`Liquido` es columna calculada en SQL).
- **Prestamo / PrestamoMovimiento**: préstamos con saldo amortizable (Corpetur, Bantrab).
- **MetricaDiaria / ReglaBonificacion**: ventas/ocupación → comisiones automáticas.
- **ParametroNomina**: tasas (IGSS, ISR, provisiones) configurables, NO quemadas en código.
- **ProvisionLaboral**: histórico mensual del pasivo laboral (el "cuadro Kurt").

## Convenciones (respetarlas siempre)

- **Dinero = `decimal`** con la precisión que ya está en las entidades (`decimal(14,2)`).
  NUNCA `float`/`double`.
- **Nada se borra físicamente.** DELETE = baja lógica (`Activo = false`); Empleado
  guarda además `FechaBaja`. El histórico es la razón de ser del sistema.
- **PK surrogada + NIT como identificador de negocio.** El NIT es obligatorio y único
  para PLANILLA, opcional para EXTRA. No usar el NIT como llave primaria.
- **Extras = efectivo bruto.** Su boleta solo lleva líneas de ingreso, sin descuentos
  (sin IGSS/ISR).
- Enums (Tipo, Estado, Naturaleza) se guardan como texto (NVARCHAR), no como int.

## Hoja de ruta

1. ✅ Modelo de datos (esquema SQL).
2. ✅ Entidades + DbContext + CRUD base (Establecimientos, Conceptos, Empleados).
3. ⏳ **Motor de cálculo de boletas** para un período (sueldo proporcional según
   quincena/fin de mes, IGSS/ISR para planilla, comisiones desde MetricaDiaria,
   abonos de préstamos). Aquí viven las reglas de negocio.
4. Préstamos y bonificaciones automáticas.
5. Reportes: histórico por persona/establecimiento, consolidado, pasivo laboral, boletas imprimibles.
6. Frontend Next.js.

### Primeras tareas sugeridas
- Restaurar, compilar y arreglar cualquier error de compilación.
- Correr contra SQL Server y verificar el CRUD vía Swagger.
- Completar los CRUD que faltan (PeriodoPago, Prestamo, MetricaDiaria, etc.) siguiendo
  EXACTAMENTE el patrón de los controllers existentes.
- Inicializar git.

### Regla de quincena (DEFINIDA)
- El anticipo de quincena es un **monto fijo acordado por persona**, guardado en
  `Empleado.MontoQuincena` (default Q1,200; se ajusta por empleado). No es % ni días.
- Al generar el período `QUINCENA`: cada empleado de planilla recibe una boleta cuyo
  líquido = su `MontoQuincena` (es solo el adelanto, sin descuentos). Permitir
  override puntual del monto para esa quincena.
- Al generar el `FIN_MES`: descontar como anticipo el **monto realmente pagado en la(s)
  quincena(s) de ese mes** (leerlo de las boletas de quincena, NO asumir Q1,200), para
  que las excepciones y correcciones reconcilien solas.
- Los EXTRA no llevan quincena (se pagan en efectivo aparte).

## Reglas de negocio PENDIENTES de confirmar con el cliente (NO inventar)

Antes de implementar el bloque 3, confirmar con el cliente:
- **Cálculo de ISR**: método y tramos vigentes.
- **Reglas de comisión/bonificación** por venta y por ocupación (fórmula exacta por establecimiento).
- **Tasas IGSS patronal / INTECAP**: validar valores legales con el contador (están como
  parámetros configurables; no asumir que los sembrados son correctos).
