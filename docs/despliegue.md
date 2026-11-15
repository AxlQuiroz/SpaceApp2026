# RockieOS · ejecución y publicación del MVP

La presentación local en Windows usa RockieOS.cmd. Para un servidor con Docker Engine y Compose v2, la raíz incluye los tres servicios, almacenamiento persistente y comprobaciones de disponibilidad.

## Primera instalación en un servidor

```bash
python scripts/setup_production.py --origin https://juego.example.org
docker compose --env-file .env.production up --build -d
docker compose --env-file .env.production ps
curl --fail http://127.0.0.1:3000/api/health
```

Sustituye el dominio por el que realmente se publique, sin barra final. Para comprobarlo sólo en el propio equipo, omite `--origin` y usa `http://localhost:3000`. El script crea secretos independientes y no imprime sus valores ni reemplaza una configuración existente. El archivo .env.production está excluido de Git.

El servicio web se enlaza a `127.0.0.1:3000`. Configura el proxy HTTPS del alojamiento para dirigir el dominio a ese puerto y conservar Host. El navegador sólo necesita llegar a Next.js; las APIs Python no tienen puertos públicos. `APP_ORIGIN` debe coincidir exactamente con el origen que abre el jugador. El endpoint `/api/health` devuelve 200 sólo si la API de misiones responde; el estado completo de los contenedores se consulta con `docker compose ps`.

Las imágenes se construyen descargando dependencias y fuentes; hace falta conexión en la primera compilación. El uso de las misiones históricas posteriores no requiere consultar NASA. Los nombres de los volúmenes son mission-data y resource-data dentro del proyecto Compose; no uses `down -v` si quieres conservar las partidas.

## Actualización

```bash
git pull origin main
docker compose --env-file .env.production up --build -d
```

Conserva .env.production y los volúmenes. Las partidas existentes mantienen sus reglas. Guarda copias de la base SQLite mediante el [script de respaldo](../API/scripts/backup_database.py) o un respaldo consistente del volumen antes de cambiar de servidor.

## Comprobar el enlace que se entrega

1. Abre el dominio en una ventana privada, crea una misión y completa al menos una decisión y un avance.
2. Comprueba Fuentes NASA, recarga y reanudación; verifica ambos destinos.
3. Prueba dos navegadores independientes. Cada uno debe conservar su propia sesión y sus propias misiones.
4. En móvil, comprueba que las acciones y el aviso de radiación siguen accesibles.
5. Adjunta por separado el enlace del proyecto y la demo en el portal oficial. Verifica permisos y guarda la confirmación del envío.

Este repositorio contiene la configuración de publicación; no asigna un dominio ni contrata alojamiento. La validación del flujo de la aplicación en CI no acredita una instalación concreta de Docker o del servidor público.
