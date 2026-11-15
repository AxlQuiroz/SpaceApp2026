# Integración con Node.js, React y Next.js

El backend conserva motor y conexiones NASA en Python. Next.js consume JSON y controla la presentación. No hace falta trasladar las reglas a JavaScript.

## Archivos para el frontend

| Archivo del paquete | Destino en Next.js |
| --- | --- |
| `sdk/typescript/client.ts` | `src/lib/orbita/client.ts`, o sin `src` |
| `sdk/typescript/schema.ts` | Junto a `client.ts` |
| `integrations/nextjs/app/api/mission/[...path]/route.ts` | `src/app/api/mission/[...path]/route.ts`, o sin `src` |
| `integrations/nextjs/.env.local.example` | Añadir las variables a `.env.local` |

El adaptador usa **App Router** y Node.js en el servidor. No incluye pantallas ni cambia las que ya existen. Los parámetros de ruta se esperan como promesa, conforme al contrato actual de Next.js usado para verificarlo.

```dotenv
ORBITA_API_URL=http://127.0.0.1:8000
APP_ORIGIN=http://localhost:3000
```

Configura el origen de Python sin `/api/v1`. Son variables del servidor Next.js: no copies `RESOURCE_API_TOKEN` al frontend ni a `NEXT_PUBLIC_*`.

## Sesión mediante el adaptador

React llama a `/api/mission` en su mismo origen. El Route Handler reenvía a `/api/v1` de Python. Guarda el token del jugador en una cookie **HttpOnly**, **SameSite=Strict** y **Secure** en producción; retira ese token del JSON enviado al navegador.

En una recarga, crear sesión mediante el adaptador reutiliza la vigente. Cerrar sesión revoca el token y elimina la cookie. Las mutaciones exigen `Origin` igual a `APP_ORIGIN`; inclúyelo si pruebas con una herramienta de consola.

## Ejemplo desde React

```tsx
"use client";
import { MissionApiClient, MissionApiError } from "@/lib/orbita/client";
import type { MissionView } from "@/lib/orbita/schema";

const api = new MissionApiClient();

export async function iniciar(): Promise<MissionView> {
  await api.createSession();
  const key = crypto.randomUUID();
  return (await api.createMission({ data_mode: "snapshot", difficulty: "cadet", seed: 42 }, key)).mission;
}

export async function avanzar(mission: MissionView): Promise<MissionView> {
  const key = crypto.randomUUID();
  const command = { type: "advance" as const, expected_version: mission.state.version };
  try {
    return (await api.command(mission.state.id, command, key)).mission;
  } catch (error) {
    if (error instanceof MissionApiError && error.code === "VERSION_CONFLICT") {
      return api.mission(mission.state.id);
    }
    // Conserva key y command en tu estado para reintentar la misma intención si falla la red.
    throw error;
  }
}
```

Adapta las funciones a tu gestión de estado. Guarda el `MissionView` confirmado. Usa `available_actions`, `enabled`, `disabled_reason` y costes para los controles; el backend los vuelve a validar. Deshabilita el botón mientras se confirma una decisión.

Acción: `api.command(id, {type:"action",action_id:"explore",expected_version:version}, key)`. Vista previa: `api.preview(id,"explore",version)`, que no está guardada. Fuentes: `api.science(id)`. Evaluación: `api.evaluation(id)`.

## Node.js y Server Components

El mismo cliente puede usar directamente un token de jugador:

```ts
const api = new MissionApiClient({ baseUrl: `${process.env.ORBITA_API_URL}/api/v1`, token: playerToken });
const current = await api.mission(missionId);
```

Crea una instancia por jugador o solicitud, sin compartir un cliente con token global. Un Server Component puede obtener la cookie con `await cookies()`; la creación o eliminación de cookies corresponde al Route Handler. El SDK no depende de React o Next.js.

El acceso directo desde el navegador es posible con un token individual y CORS configurado. El adaptador incluido conserva ese token fuera de JavaScript. No se usa un origen CORS comodín.

## Configurar y actualizar

`ORBITA_API_URL` debe ser alcanzable desde el servidor Next.js; si está en otro contenedor o equipo, `127.0.0.1` apunta a ese entorno. En remoto usa HTTPS y añade el dominio del backend a `MISSION_ALLOWED_HOSTS`. Para acceso directo del navegador añade el origen exacto a `MISSION_CORS_ORIGINS`.

La captura live puede tardar; el adaptador declara hasta 90 segundos y el alojamiento puede imponer un límite menor. Snapshot permite demostraciones estables y conserva las fechas históricas y avisos.

El SDK expone códigos, `requestId`, clave de idempotencia y `Retry-After`. No reintenta automáticamente mutaciones: una repetición tras desconexión conserva el mismo cuerpo y UUID. Una intención nueva usa otro UUID.

Después de cambiar el contrato Python ejecuta `python scripts/export_contracts.py` y actualiza los dos archivos del SDK. `schema.ts` se genera desde el mismo OpenAPI de Swagger.

## Fuentes técnicas

- [Next.js: Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).
- [Next.js: cookies](https://nextjs.org/docs/app/api-reference/functions/cookies).
- [FastAPI: CORS](https://fastapi.tiangolo.com/tutorial/cors/).
- [FastAPI: ciclo de vida](https://fastapi.tiangolo.com/advanced/events/).

El frontend completo está en la raíz del repositorio. El paquete integrations/nextjs conserva las pruebas aisladas de compatibilidad del adaptador; la aplicación usa los mismos archivos verificados por check:contracts.

## Comprobar los archivos de integración

El pequeño paquete en `integrations/nextjs` sirve exclusivamente para verificar el adaptador; no es la aplicación de interfaz. Con Node.js 24, ejecuta allí:

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
```

Desde la raíz del backend puedes verificar después el Route Handler real contra los dos procesos Python:

```bash
python scripts/verify_backend.py --nextjs
```

También se puede añadir `--live` para comprobar las descargas a NASA. El cliente TypeScript tiene sus pruebas independientes en `sdk/typescript/tests/client.test.ts`, ejecutables con `node --experimental-strip-types --test sdk/typescript/tests/client.test.ts`.


## Cuotas de visitantes detrás de Next.js

El backend admite un secreto independiente MISSION_PROXY_TOKEN. Configura el mismo valor como ORBITA_PROXY_TOKEN en el servidor Next.js. setup_backend.py prepara ambos valores para la instalación local, preservando las otras variables. RockieOS.cmd prepare y el arranque habitual ejecutan esa preparación.

Next.js firma una cookie HttpOnly orbita_visitor y reenvía una identidad de visitante autenticada al backend. No reenvía cabeceras de identidad enviadas por el navegador. Python conserva las cuotas por visitante y un techo global del proxy: MISSION_PROXY_REQUESTS_PER_MINUTE y MISSION_PROXY_SESSIONS_PER_HOUR. La cookie del visitante identifica una cuota anónima; no da acceso a partidas, que siguen requiriendo la sesión del jugador.

En alojamiento remoto, define los dos secretos de proxy mediante la configuración privada de cada servicio y utiliza HTTPS o una red privada controlada. Sin secreto válido, se mantienen los límites conservadores por IP. Nunca configures el secreto como NEXT_PUBLIC_ ni lo incluyas en el repositorio.
