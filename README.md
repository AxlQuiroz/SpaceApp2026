# SpaceApp2026 · Órbita

Entrenador de decisiones y recursos para una base lunar, con referencias científicas de NASA. El frontend se desarrolla por separado con Node.js, React y Next.js.

El **backend v0.2.0** se encuentra en [`API/`](API/README.md). Incluye la API interna de recursos NASA, el motor lunar, partidas persistentes en SQLite, el contrato OpenAPI, un cliente TypeScript y el adaptador para Next.js App Router.

## Empezar

Abre una terminal dentro de `API/` y sigue la [instalación en Windows](API/docs/backend-installation-windows.md). Las dependencias Python y los scripts se ejecutan desde esa carpeta.

- [Conectar el frontend Next.js](API/docs/nextjs-integration.md).
- [Contrato de partidas](API/docs/mission-api-contract.md).
- [Reglas del simulador](API/docs/simulation-rules.md).
- [Pruebas y límites de la validación](API/docs/backend-validation.md).

GitHub Actions verifica Python, TypeScript y el recorrido entre el adaptador Next.js y los dos servicios usando capturas históricas, sin claves NASA ni acceso a sus proveedores.
