# AstraNova: ejecución, pruebas y presentación

## Primera vez

1. Instala **Python 3.12** y **Node.js 24**. Si acabas de instalarlos, cierra las terminales y vuelve a abrirlas.
2. Actualiza o descarga el repositorio completo. No muevas `RockieOS.cmd` fuera de su carpeta.
3. Abre **RockieOS.cmd** con doble clic. También funciona desde PowerShell con ` .\RockieOS.cmd`.
4. Elige **1. Preparar / actualizar dependencias**. Necesita internet e instala lo indicado en los archivos de dependencias del repositorio.
5. Elige **5. Pruebas completas** antes de entregar. La primera ejecución descarga Chromium y compila las fuentes del juego; necesita internet.
6. Elige **2. Iniciar presentación**. Se abre <http://localhost:3000/mision> al terminar el arranque.

El menú funciona con Python, sin activar entornos virtuales ni modificar la política de ejecución de PowerShell. Soporta rutas con espacios, como tu carpeta de OneDrive. El sistema operativo, Python y Node deben estar instalados previamente; el lanzador no los instala ni cambia la configuración de Windows.

## Menú

| Opción | Qué hace |
| --- | --- |
| **1. Preparar dependencias** | Crea `API/.venv` si hace falta, instala backend, frontend y adaptador Next.js; crea sólo los `.env` que falten y verifica las ocho capturas NASA |
| **2. Presentación** | Compila si falta una compilación actual; inicia Next.js en producción y ambas APIs; espera a que respondan y comprueba Luna/Marte a través del proxy |
| **3. Desarrollo** | Inicia las APIs y Next.js con actualización de código; invalida la compilación de presentación porque ambos modos escriben en `.next` |
| **4. Pruebas rápidas** | Contratos OpenAPI/TypeScript, integridad de capturas, lanzador, frontend, backend, SDK, adaptador y misiones de 12 turnos en Luna/Marte. Omite compilación y navegador |
| **5. Pruebas completas** | Todo lo anterior, compilación y partidas desde Chromium en escritorio y móvil emulado |
| **6. Diagnóstico** | Comprueba intérpretes, dependencias, configuración presente, capturas, puertos y estado de compilación |
| **7. Último informe** | Abre el informe HTML de la operación más reciente |
| **0. Salir** | Cierra el menú |

La presentación usa el **backend real** y las capturas históricas NASA atribuidas. El jugador puede elegir Luna o Marte. No activa `?demo=1`. Con las dependencias y la compilación preparadas puede iniciarse sin internet; después de cambiar código, recursos o configuración puede requerir una nueva compilación. Haz la preparación antes de salir a presentar.

El modo local fija temporalmente `APP_ORIGIN=http://localhost:3000`, `ORBITA_API_URL=http://127.0.0.1:8000` y la conexión interna al puerto 8001. Presentación también fija `RESOURCE_DATA_MODE=snapshot`. Estos ajustes viven sólo en los procesos que se lanzan. La configuración escrita y las partidas SQLite se conservan. Abre la dirección **localhost** indicada para que el origen y la cookie coincidan.

## Durante la presentación

Deja la ventana del lanzador abierta mientras juegas. Pulsa **Ctrl+C** en esa ventana para cerrar frontend y APIs y regresar al menú. En la línea de comandos, `Ctrl+C` termina la ejecución y devuelve el control a PowerShell.

Los puertos son **3000** (juego), **8000** (API de partidas) y **8001** (recursos internos). Si ya están ocupados, el lanzador se detiene antes de arrancar. Cierra las terminales anteriores y vuelve a intentarlo. Sólo detiene los procesos que él inició; no busca ni termina programas ajenos por su nombre. Un bloqueo evita dos operaciones simultáneas del lanzador en la misma carpeta.

## Comandos directos desde PowerShell

Desde la raíz del proyecto:

```powershell
.\RockieOS.cmd prepare
.\RockieOS.cmd present
.\RockieOS.cmd dev
.\RockieOS.cmd test --quick
.\RockieOS.cmd test
.\RockieOS.cmd check
.\RockieOS.cmd report
```

Para comprobar sólo el arranque y cierre, sin abrir navegador ni crear sesiones o partidas:

```powershell
.\RockieOS.cmd present --smoke --no-browser
```

### Sólo el backend (para programar con `npm run dev`)

Abre **Backend.cmd** con doble clic (o `.\Backend.cmd` en PowerShell) y deja la ventana abierta; en otra terminal ejecuta `npm run dev`. `.env.local` ya apunta a `http://127.0.0.1:8000`. No lo combines con `RockieOS.cmd present` o `dev`, que arrancan su propio backend y juego en los mismos puertos. Requiere haber ejecutado antes la opción 1 del lanzador.

En Linux/macOS el mismo controlador se ejecuta con `python3.12 scripts/rockieos.py present` y los demás nombres de acción. El acceso por doble clic es específico de Windows.

## Evidencia para la entrega

Cada operación genera `reports/rockieos/FECHA-HORA-acción/` con:

- `index.html`: resultado general y tabla de pasos, duración, códigos de salida y enlaces a registros.
- `summary.json`: los mismos resultados en formato de datos.
- `01.log`, `02.log`, etc.: salida de cada comprobación.
- `smoke-snapshot.json`, `smoke-snapshot-mars.json` y `smoke-nextjs.json`: resultados de las misiones e integración, cuando se ejecutan pruebas.
- `backend.log` y `frontend.log`: diagnóstico de los servicios, cuando se arranca el juego.

El informe de navegador queda además en `playwright-report/index.html`; las capturas y trazas están en `test-results/`. El lanzador se detiene en la primera comprobación fallida y devuelve un código distinto de cero. Una ejecución cancelada no se presenta como pruebas aprobadas.

Las pruebas de integración usan bases temporales y no escriben en tus partidas habituales. Los informes no incluyen `.env`, tokens ni bases de datos. Los informes y el estado local del lanzador están excluidos de Git. Para entregar el proyecto comparte el repositorio y el informe de pruebas; conserva tu configuración y tus partidas en tu equipo.

## Si aparece un error

| Mensaje o síntoma | Acción |
| --- | --- |
| Falta Python 3.12 o Node | Instala las versiones indicadas y abre una terminal nueva |
| `API/.venv` fue creado con otro Python | Renombra ese entorno y vuelve a ejecutar la opción 1 con Python 3.12 |
| Faltan dependencias | Ejecuta la opción 1 |
| Puertos ocupados | Cierra los servidores que ya tenías abiertos; revisa la opción 6 |
| La compilación o descarga falla sin conexión | Conéctate, prepara y ejecuta las pruebas completas antes de presentar |
| Un servicio terminó o no responde | Abre la opción 7 y consulta `backend.log` / `frontend.log` |
| Captura NASA inválida | El lanzador sólo repara saltos CRLF si recupera el SHA-256 exacto; si persiste, restaura el archivo desde Git |
| OpenAPI desactualizado | Revisa cambios de modelos y regenera con Python 3.12 usando `API/scripts/export_contracts.py`; sincroniza también los tipos del frontend |

La primera instalación y los tests no requieren una cuenta NASA. Las sesiones anónimas mantienen la duración configurada por el backend. La emulación móvil automatizada no sustituye una prueba en un teléfono físico.
