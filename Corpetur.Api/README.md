# Corpetur.Api — Bloque 2 (Entidades + DbContext + CRUD base)

API REST en ASP.NET Core (.NET 8) sobre tu esquema SQL Server, mapeada
**database-first** (corres el SQL, la app no crea ni migra la base).

## Estructura

```
Corpetur.Api/
├─ Corpetur.Api.csproj
├─ Program.cs                 # arranque: EF Core, CORS, Swagger
├─ appsettings.json           # cadena de conexión + origen del frontend
├─ Data/CorpeturDbContext.cs  # DbSets, índices únicos, defaults
├─ Entities/Entities.cs       # POCOs mapeados a las tablas
├─ Dtos/Dtos.cs               # contratos de entrada/salida
└─ Controllers/
   ├─ EstablecimientosController.cs
   ├─ ConceptosController.cs
   └─ EmpleadosController.cs
```

## Puesta en marcha

1. **Crea la base y corre el esquema** (en tu SQL Server del VPS):
   ```sql
   CREATE DATABASE CorpeturNomina;
   GO
   USE CorpeturNomina;
   GO
   -- pega y ejecuta corpetur_nomina_schema.sql
   ```

2. **Ajusta la conexión** en `appsettings.json` → `ConnectionStrings:CorpeturDb`
   (Server, Database, usuario y contraseña). Pon también el subdominio real del
   frontend en `Cors:FrontendOrigin`.

3. **Corre la API:**
   ```bash
   dotnet restore
   dotnet run
   ```
   Swagger queda en `https://localhost:xxxx/swagger` para probar los endpoints.

## Endpoints incluidos

| Recurso          | Operaciones                                              |
|------------------|----------------------------------------------------------|
| `/api/establecimientos` | GET (lista/uno), POST, PUT, DELETE (baja lógica)  |
| `/api/conceptos`        | GET (filtra por naturaleza), POST, PUT, DELETE    |
| `/api/empleados`        | GET (filtros: establecimiento, tipo, búsqueda), POST, PUT, DELETE (baja) |

Notas de diseño que ya están aplicadas:
- **Nada se borra físicamente.** DELETE = baja lógica (`Activo = false`), para no
  perder el histórico. Empleado además guarda `FechaBaja`.
- **Dinero = `decimal`** con precisión exacta igual al SQL; nunca `float`.
- **Extras**: se crean con `Tipo = "EXTRA"`; la lógica de boleta (bloque 3) les
  arma solo líneas de ingreso, sin descuentos.

## Lo que sigue (bloque 3)

El **motor de cálculo de boletas** para un período: toma los empleados activos de
un `PeriodoPago`, arma sus líneas (sueldo proporcional según quincena/fin de mes,
IGSS/ISR para planilla, comisiones desde `MetricaDiaria`, abonos de préstamos) y
deja la boleta lista para revisar y cerrar. Ese bloque es donde viven las reglas
de negocio, así que ahí confirmamos contigo los cálculos finos.
