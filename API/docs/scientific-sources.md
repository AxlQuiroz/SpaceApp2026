# Fuentes y criterios científicos

Documentación y conectividad revisadas el **14 de noviembre de 2026**. El repositorio conserva las respuestas históricas originales con URL de consulta, momento de descarga y SHA-256 en `src/resource_api/snapshots/manifest.json` dentro del servicio.

| Fuente oficial | Documentación | Consulta implementada |
| --- | --- | --- |
| NASA CCMC / DONKI | [Descripción y avisos](https://ccmc.gsfc.nasa.gov/tools/DONKI/), [API](https://ccmc.gsfc.nasa.gov/DONKI/api/) | `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/{FLR,CME,SEP,GST}` |
| NASA OSDR / RadLab | [Data API](https://visualization.osdr.nasa.gov/radlab/gui/data-api/), [Overview](https://visualization.osdr.nasa.gov/radlab/gui/overview/) | `https://visualization.osdr.nasa.gov/radlab/api/` |
| NASA OSDR | [Catálogo NASA Open APIs](https://api.nasa.gov/#osdr), [Estudio OSD-104](https://osdr.nasa.gov/bio/repo/data/studies/OSD-104) | `https://osdr.nasa.gov/osdr/data/osd/meta/{id}` |

## Decisiones de implementación

1. **DONKI:** se utiliza el dominio vigente `ccmc.gsfc.nasa.gov`, anunciado en septiembre de 2026. La descarga directa funcionó durante la verificación. Los endpoints alternativos del portal NASA permanecen como opción configurable y requieren una clave, pero no se da por garantizada su disponibilidad.
2. **RadLab:** el JSON real utiliza `columns`, `index` y `data`; se reconstruyen las filas por el nombre de columna, sin depender del orden. La consulta usa sintaxis booleana, intervalo acotado e instrumento explícito. Su analizador rechaza el sufijo `Z` en las expresiones: el conector convierte las fechas a UTC y omite ese sufijo sólo al enviarlas a RadLab; nuestro contrato conserva la zona horaria explícita.
3. **OSDR:** se consulta el número de estudio por la API de metadatos. Se valida la coincidencia del identificador y se conservan publicaciones para la atribución a los investigadores.
4. **Capturas:** son descargas reales, no datos de ejemplo inventados. Los tests simulan el transporte de esas respuestas; se etiquetan como capturas sólo al usar el modo `snapshot` en la aplicación.

## Interpretación para el simulador

- Un evento DONKI no equivale a una medición de exposición de la base. Una clase X3.9, una velocidad de CME o un Kp terrestre no deben convertirse directamente en dosis lunar o marciana.
- El ejemplo CRaTER pertenece a **LRO en órbita lunar**, no a un refugio en la superficie. Su medición conserva el entorno de origen.
- La magnitud absorbida (Gy) y la equivalente (Sv) requieren contexto físico y biológico; esta API sólo normaliza la representación de sus unidades.
- OSD-104 contiene datos de un estudio de ratones. La API entrega sus metadatos y publicaciones; no deriva de ellos parámetros de salud humana.
- Un resultado vacío indica ausencia de registros en esa consulta, no ausencia de peligro.
- Los números que introduzca el motor para equilibrar aprendizaje y jugabilidad deben marcarse como reglas del simulador, con versión y supuestos. La atribución NASA corresponde a los datos originales.

CCMC describe DONKI como información de investigación/prototipado y no como un sistema operacional de seguridad. Conservar las atribuciones de cada fuente y sus condiciones de uso. La utilización de datos NASA no implica que NASA avale el simulador.

## Fuentes técnicas

- [FastAPI: aplicaciones con varios archivos](https://fastapi.tiangolo.com/tutorial/bigger-applications/).
- [HTTPX: transportes y simulación de servicios](https://www.python-httpx.org/advanced/transports/).

Los enlaces anteriores son fuentes primarias. La entrega no incorpora las API archivadas de fotos de Mars Rover ni depende de ellas.
