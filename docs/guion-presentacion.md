# RockieOS · presentación y ensayo de entrega

## La idea que debe quedar clara

**RockieOS convierte los compromisos de una misión espacial en decisiones que una persona puede probar, comprender y mejorar.** No basta con conseguir ciencia: hay que cuidar la tripulación, la energía y las reservas del día siguiente.

La diferencia que conviene mostrar en pantalla es el ciclo **elegir → comparar → confirmar → observar → repetir**. La consola explica cada acción y la previsión permite discutir sus consecuencias antes de ejecutarla.

## Preparar el equipo antes de exponer

Desde la raíz del repositorio en PowerShell:

```powershell
git pull origin main
.\RockieOS.cmd prepare
.\RockieOS.cmd test
.\RockieOS.cmd present
```

Haz la preparación y las pruebas antes del evento: instalar dependencias o compilar por primera vez puede necesitar Internet. El juego presentado con las capturas históricas incluidas no necesita consultar los proveedores NASA por red.

1. Abre `http://localhost:3000`, elige el idioma que usarás y comprueba el tamaño del proyector.
2. Activa **Pantalla completa** en ajustes si el navegador lo permite. La salida con Esc la gestiona el navegador. El sonido es opcional y empieza silenciado.
3. Desde la selección de misión, elige **Cadete** y **Caso histórico**. Los guiones siguientes corresponden a ese modo; el entrenamiento variado mueve algunos incidentes simulados.
4. Ensaya una misión. Conserva una partida terminada para abrir el resultado sin jugar los doce turnos durante la exposición.
5. Para crear otra misión después del ensayo, usa **Menú → Salir al menú**. Volver al inicio no borra el progreso.
6. Usa el juego conectado al backend. La ruta `?demo=1` es una vista aproximada de interfaz y se identifica como tal; para mostrar la simulación científica, utiliza `/mision`.

## Guion de exposición en tres minutos

| Tiempo | Acción en pantalla | Mensaje sugerido |
| --- | --- | --- |
| 0:00–0:20 | Menú y tripulación | «¿Cómo enseñamos a tomar decisiones de una misión espacial sin convertirlo en una hoja de cálculo? RockieOS propone un entrenador para estudiantes de 7 a 12 años». |
| 0:20–0:40 | Selección de Marte y plan de misión | «Cada turno representa dos horas. Tenemos hasta dos decisiones, y sobrevivir no es el único objetivo: también debemos investigar, compartir datos y conservar comida». |
| 0:40–1:15 | Consola → Apagar MOXIE → previsión | «Apagar una máquina ahorra energía, pero deja de producir oxígeno. Aquí podemos comparar el siguiente turno con y sin la decisión». Puedes cancelar; la previsión no cambia la partida. |
| 1:15–1:40 | Acceso directo **Archivo NASA** | «La radiación usa mediciones históricas reales de Curiosity. Podemos ver la fecha, el instrumento, los enlaces y cómo se transformaron los registros. Los puntos de salud y exposición siguen siendo reglas educativas». |
| 1:40–2:05 | Explorar, llamar y avanzar | «Investigar produce datos nuevos. Una llamada los envía, pero la respuesta tarda: el jugador debe decidir por sí mismo ante un peligro. Repetir consultas vacías no regala ciencia». |
| 2:05–2:35 | Resultado de una misión ensayada y comparación | «Al repetir conservamos las condiciones y comparamos acciones y resultados. Queremos que el jugador pueda explicar por qué le fue mejor, no sólo repetir una secuencia». |
| 2:35–3:00 | Fuentes, bitácora, créditos y cierre | «Tenemos dos destinos, dificultades, recuperación de partidas, controles táctiles y de teclado y una batería automática de pruebas. El siguiente paso educativo es medir comprensión con usuarios reales». |

Si sólo hay 30 segundos para el video, usa el guion en inglés de [project-submission.md](project-submission.md). Ajusta la duración a las instrucciones finales de la organización.

## Planes para ensayar una misión completa

**El turno de la tabla es el número que ves antes de pulsar “Avanzar 2 horas”.** Los espacios sin acción significan que puedes avanzar directamente. Puedes cancelar cualquier previsión antes de confirmar.

### Luna · Cadete · Caso histórico

| Turno | Acciones antes de avanzar |
| --- | --- |
| 0 | Explorar, Explorar |
| 1 | Avanzar sin acción |
| 2 | Reparar agua |
| 3–4 | Avanzar sin acción |
| 5 | Ir al refugio |
| 6 | Salir del refugio |
| 7 | Avanzar sin acción |
| 8 | Reparar paneles |
| 9–11 | Avanzar sin acción |

### Marte · Cadete · Caso histórico

| Turno | Acciones antes de avanzar |
| --- | --- |
| 0 | Explorar, Llamar a la Tierra |
| 1 | Avanzar sin acción |
| 2 | Ir al refugio |
| 3–4 | Avanzar sin acción |
| 5 | Apagar invernadero, Apagar MOXIE |
| 6 | Avanzar sin acción |
| 7 | Salir del refugio, Explorar |
| 8–9 | Avanzar sin acción |
| 10 | Limpiar paneles, Encender MOXIE |
| 11 | Encender invernadero |

Estos planes se ejercitan en los recorridos automáticos. Sirven para ensayar la exposición y no sustituyen las explicaciones del jugador. Durante una demostración educativa, pregunta qué cambia si se apaga antes un sistema o se espera para reparar.

## Respuestas concretas para preguntas del jurado

| Pregunta | Respuesta |
| --- | --- |
| ¿Qué datos de NASA cambian realmente el juego? | El perfil marciano agrupa 139 mediciones MSL-RAD del 20 de mayo de 2024 en doce intervalos UTC de dos horas; sus medias cambian la curva de exposición. El perfil y la transformación quedan fijados en la partida. |
| ¿Es telemetría en vivo? | Es un caso histórico reproducible. La interfaz muestra las fechas y las fuentes. No se afirma que sean datos actuales de un hábitat. |
| ¿Qué está simulado? | Consumo y producción de recursos, cultivo establecido, salud, blindaje, puntuación, averías y polvo. El incidente lunar reduce electricidad mediante protección simulada; una tormenta solar no tapa el Sol. |
| ¿Por qué jugar otra vez? | El reinicio conserva las condiciones y compara resultados y decisiones por turno. El modo variado modifica sólo los incidentes simulados. |
| ¿Ya se demostró aprendizaje con niños? | Aún no. Hay preguntas, explicaciones y un protocolo para medirlo, pero las pruebas automáticas no demuestran aprendizaje humano. |
| ¿El pase de familias ya se vende? | Es una propuesta identificada como tal. No hay cobros ni pasarela implementada. El diploma básico y las misiones están disponibles sin compra. |
| ¿Usaron IA? | Sí. Los créditos describen la asistencia de IA en el desarrollo, revisión y documentación. El equipo debe revisar y asumir las decisiones científicas y técnicas. |

## Antes del envío oficial

Verifica los campos y límites vigentes de la página de tu equipo, el enlace que recibirá el jurado y el acceso al repositorio. Acuerda la licencia general con los autores. Si se entrega una URL pública, ensáyala desde otro dispositivo y red después de configurar HTTPS, persistencia y secretos. Una presentación local validada no es evidencia de que ese alojamiento público ya esté funcionando.
