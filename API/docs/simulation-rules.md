# Modelo lunar · lunar-1.0.0

Práctica de 24 horas, cuatro tripulantes, 12 turnos de dos horas y dos acciones por turno. Escenario: `lunar-outpost-v1`. La versión de reglas queda guardada en cada partida.

**Consumos, producción, daños, salud y puntuación son parámetros didácticos del simulador**, no mediciones NASA ni coeficientes certificados. Su definición completa se devuelve en `/api/v1/scenarios/lunar-outpost-v1` y está en `mission_api/rules.py`.

## Fuentes separadas del modelo

| Fuente | Papel | Contexto conservado |
| --- | --- | --- |
| DONKI, 10 de mayo de 2024 | Ejercicio solar histórico | No convierte clase de llamarada en dosis ni predice riesgo actual |
| CRaTER/LRO, 1 de enero de 2014 | Lectura dosimétrica de referencia | Órbita lunar; no superficie o interior del refugio |
| OSD-104 | Investigación biológica | Estudio en ratones; no deriva coeficientes de salud humana |

Las fechas y entornos son diferentes. `/science` entrega registros, atribuciones, consultas y metadatos de cada página. Los incidentes son programados en el reloj del ejercicio y llevan `rule_origin: simulation`.

## Recursos iniciales

| Recurso | Cadete | Comandante | Capacidad principal |
| --- | --- | --- | --- |
| Energía | 32 kWh | 24 kWh | 50 kWh |
| Oxígeno | 2.8 kg | 2.1 kg | 6 kg |
| Agua | 18 L | 13.5 L | 30 L |
| Alimentos | 3.2 kg | 2.4 kg | 6 kg |
| Repuestos | 6 | 6 | Sin producción |
| Reserva de oxígeno | 1.2 kg | 1.2 kg | Independiente y finita |
| Reserva de agua | 6 L | 6 L | Independiente y finita |

Comandante reduce al 75% los cuatro recursos principales iniciales. Salud inicial: 100; exposición inicial: cero.

## Cálculos por turno

Paneles íntegros generan `5.5 kW × 2 h = 11 kWh`. La demanda normal es `2 + 1.2 + 0.4 + 1 = 4.6 kW`, o 9.2 kWh por turno. La batería gana 1.8 kWh hasta su capacidad si no hay otros costes.

Prioridad eléctrica: hábitat, generador de oxígeno, recuperación de agua, invernadero. La fracción atendida regula la producción; no se produce oxígeno sin energía o sin el agua necesaria.

| Parámetro | Valor didáctico |
| --- | --- |
| Oxígeno de tripulación | 0.035 kg/persona/h |
| Agua de tripulación | 0.15 L/persona/h |
| Alimento de tripulación | 0.025 kg/persona/h |
| Generador de oxígeno | 0.20 kg/h; consume 0.225 L/h y 1.2 kW |
| Recuperación de agua | 0.30 L/h; consume 0.4 kW |
| Invernadero | 0.035 kg/h; consume 1 kW |
| Fuga activa | −0.8 L/h |

Se recupera agua antes de alimentar el generador; después se aplican consumos de tripulación y fuga. El invernadero representa una cosecha establecida; no modela crecimiento instantáneo, nutrientes o balances de CO₂. Se supone iluminación disponible durante el segmento; no se inventa un día lunar de 24 horas.

## Incidentes y acciones

| Turno al que se avanza | Suceso |
| --- | --- |
| 2 | Fuga de agua, con pérdidas desde ese turno |
| 5 | Aviso solar para preparar el siguiente avance |
| 6 | Incidente solar: generación × 0.3 y aumento didáctico de exposición |
| 8 | Polvo: integridad de paneles −50 hasta reparar |

El incidente solar añade entre 24 y 32 puntos, determinados por la semilla, además de 0.2 puntos de fondo por turno. El refugio multiplica el incremento por 0.1. Explorar añade un punto. El índice **no usa Gy o Sv ni representa probabilidades clínicas**.

| Acción | Resultado y coste |
| --- | --- |
| `explore` | +12 puntos científicos; −2 kWh, −0.12 kg O₂, −0.5 L, −0.1 kg de alimento |
| `repair_water_loop` | Detiene fuga; −2 repuestos y −2 kWh |
| `repair_solar_panels` | +50 de integridad hasta 100; −2 repuestos y −3 kWh |
| `enter_shelter` / `leave_shelter` | Reduce exposición; mientras esté dentro no permite explorar ni reparar paneles |
| `activate_oxygen_reserve` | Transfiere hasta 0.6 kg según reserva y espacio |
| `activate_water_reserve` | Transfiere hasta 3 L según reserva y espacio |
| `toggle_greenhouse` | Cambia producción y consumo eléctrico |
| `toggle_oxygen_generator` | Cambia producción y consumos de agua y energía |

Cada acción usa un espacio del turno. Cambiar dos veces un interruptor consume dos acciones. Las reservas transfieren masa existente. Las reparaciones exigen un daño o fuga y recursos suficientes.

## Salud y evaluación

Cada avance descuenta hasta 35 puntos por fracción no atendida del hábitat, 40 si el oxígeno termina en cero, 25 si el agua termina en cero y 10 si los alimentos terminan en cero. Un índice superior a 60 añade `(índice − 60) / 10` de pérdida por turno. Son reglas educativas, no una respuesta fisiológica.

Salud cero produce `failed`. Doce turnos producen `completed`. La evaluación es `success` cuando además hay salud ≥60 y ciencia ≥24; de otro modo, `partial`. El abandono produce `aborted`.

Puntuación: 40 puntos por duración completada, 30 por salud conservada, 20 por ciencia y 10 por menor exposición, limitada a 0–100. Se añaden comentarios educativos según el estado final.

Mismas condiciones, versión, semilla y decisiones producen los mismos resultados del modelo. Identificadores y fechas de auditoría pueden cambiar. Una modificación de coeficientes requiere otra versión de reglas para no reinterpretar partidas anteriores.
