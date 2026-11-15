# Reglas actuales 1.2 y compatibilidad

Las partidas nuevas usan `lunar-1.2.0` o `mars-1.2.0`. Conservan los consumos, producción y archivo radiométrico de 1.1. La Luna añade el objetivo `radiation_protection`: terminar con un índice de juego de 20 puntos o menos. La puntuación 1.2 reparte 30 por duración, 20 por salud, 20 por ciencia, 20 por protección y 10 por alimento. Todos los objetivos deben cumplirse para lograr `success`.

En Marte, `planning.shelter_recommended` considera la lectura del bloque siguiente y conserva el aviso durante el pico y su descenso. Los niveles de aviso de 20 y 100 uGy/h son umbrales de presentación elegidos para el ejercicio, no límites de seguridad humana. La radio entrega `state.earth_guidance`: turno recibido, vigencia de dos turnos, lectura siguiente, ventana de menor lectura si existe y turnos del polvo simulado. Consultar cuesta una acción y 1 kWh. Esperar avanza dos horas con producción, consumo y exposición; no detiene el peligro. Un informe vencido conserva su registro, pero la interfaz ya no presenta su consejo como vigente.

Las versiones guardadas 1.0 y 1.1 conservan su balance, objetivos y puntuación. Una partida 1.1 no recibe las nuevas reglas del informe de radio. El reinicio preserva la versión; para probar 1.2 se crea una misión nueva.

## Referencia 1.1 conservada

Las partidas creadas en la versión 0.3 usan lunar-1.1.0 o mars-1.1.0. Los valores de consumo y producción de 1.0 se conservan salvo las diferencias descritas aquí. Los bloques 1.0 posteriores son la referencia histórica de las partidas antiguas.

- Ciencia: explorar produce 12 puntos y datos nuevos. En Marte, enviar un lote nuevo aporta 6 puntos cuando llega la respuesta; enviarlo lo retira de la cola pendiente. Una consulta sin datos devuelve consejo y cero puntos. Los datos nuevos recogidos después del envío permanecen pendientes.
- Objetivos: además de duración, salud y ciencia, conservar 0.8 kg de alimento en cadete o 0.6 kg en comandante. Marte requiere compartir datos de al menos una exploración (12 puntos). Son márgenes didácticos para la jornada siguiente, no una dieta real ni alimento para 24 horas completas.
- Puntuación: 35 por duración, 25 por salud, 20 por ciencia, 10 por protección y 10 por reserva alimentaria conservada. La victoria exige todos los objetivos; completar el tiempo con objetivos pendientes produce partial.
- Radio: valor de práctica de 20 minutos por sentido, dentro del rango NASA/JPL de referencia de 3–22. La respuesta vence a los 40 minutos y se lee al siguiente avance de dos horas; el jugador debe decidir autónomamente ante peligro inmediato. No se presenta ese paso como tiempo físico de propagación ni como una efeméride del día histórico.
- Electricidad lunar: el factor 0.3 del incidente representa un modo de protección simulado del sistema eléctrico; la luz no queda tapada por una tormenta solar.
- Fuente de Marte: la captura realmente obtenida se agrupa en doce intervalos UTC de dos horas, se calcula la media aritmética de absorbed_dose_rate en uGy/h y se redondea a dos decimales. No se interpolan intervalos vacíos. El bundle conserva observaciones, recuentos, algoritmo y hashes; el estado guarda el perfil usado. La transformación a puntos de exposición continúa siendo una regla de juego.
- Preview: se calculan el efecto inmediato y dos avances en copias, con y sin la decisión. No modifica versión persistida, historial, recibos ni reservas.
- Repetición: conserva dificultad, semilla, modo, reglas y perfil. La comparación muestra diferencias de resultados y acciones por turno. Las partidas 1.0 siguen usando el motor congelado de 1.0.
- Entrenamiento: cambia sólo incidentes simulados, de forma reproducible. En Luna, la fuga llega al turno 2 o 3 y el polvo al 7, 8 o 9. En Marte, la tormenta de polvo empieza entre el turno 5 y 7 y dura cuatro turnos. La radiación histórica y su orden no se alteran.

La iluminación permanente durante el segmento es una simplificación declarada. No se representa un ciclo lunar completo ni un sol marciano completo con su noche. El invernadero representa una cosecha ya establecida.

Fuentes: [NASA/JPL sobre retrasos de radio](https://science.nasa.gov/blog/speaking-percys-language-how-to-talk-so-perseverance-will-listen/), [NASA sobre efectos del clima espacial](https://science.nasa.gov/sun/solar-storms-and-flares/), [RadLab](https://visualization.osdr.nasa.gov/radlab/).

---

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

---

# Modelo marciano · mars-1.0.0

Escenario `mars-outpost-v1`: 24 horas, cuatro tripulantes, 12 turnos de dos horas y dos acciones por turno, ambientado el **20 de mayo de 2024**. Los consumos de tripulación, capacidades, salud y puntuación son los del modelo lunar. Los parámetros completos se devuelven en `/api/v1/scenarios/mars-outpost-v1`.

## Datos reales que usa el modelo

| Dato | Fuente | Uso |
| --- | --- | --- |
| Tasa de dosis absorbida en la superficie, 139 lecturas del 20 de mayo de 2024 | MSL-RAD (rover Curiosity) vía RadLab, captura `radlab-msl-rad-2024-05-20` | La media de cada bloque de dos horas UTC da forma al índice de exposición de cada turno |
| Eyección de masa coronal de las 05:36 UTC | DONKI, captura `donki-cme-2024-05-20` | Motivo del aviso solar |

Medias por turno (uGy/h): `3.81, 3.93, 60.05, 246.39, 122.15, 91.23, 72.12, 48.51, 38.63, 31.07, 27.25, 22.93`. `scripts/tests/test_mars_profile.py` recalcula estas medias a partir de la captura y falla si no coinciden con `rules.py`.

Cada turno suma `media × 0.13` puntos didácticos de exposición; el refugio multiplica por 0.1. **El factor 0.13 es una regla del juego**: el índice sigue sin ser Gy, Sv ni un riesgo clínico, y no considera el blindaje real de un hábitat.

## Datos físicos de referencia (constantes, no consultas en vivo)

| Dato | Valor | Uso |
| --- | --- | --- |
| Luz solar respecto a la órbita terrestre | ≈ 43 % | Paneles de 12.8 kW nominales rinden 5.5 kW |
| Atmósfera | ≈ 95 % CO₂ | El generador obtiene oxígeno del aire, como el experimento MOXIE del rover Perseverance |
| Retraso de radio Tierra–Marte | 5 a 20 min por sentido | La respuesta a `contact_earth` llega en el turno siguiente |
| Duración de un sol | 24 h 39 min 35 s | Se simplifica a 24 h con luz disponible |

## Diferencias con la Luna

| Elemento | Marte |
| --- | --- |
| Generador de oxígeno | 2.0 kW y **no consume agua** |
| Fuga de agua | No existe; `repair_water_loop` no se ofrece |
| `repair_solar_panels` | Se llama «Limpiar paneles» y no tiene coste |
| `contact_earth` | −1 kWh; en el siguiente avance llega `earth_reply` con +6 puntos científicos |
| Objetivo científico | 30 puntos |

## Incidentes

| Turno al que se avanza | Suceso |
| --- | --- |
| 2 | `solar_warning`. Simplificación: en la realidad la eyección (05:36 UTC) y la subida de radiación fueron casi simultáneas; el juego avisa un turno antes |
| 3 | `solar_incident`: la exposición sigue el perfil real hasta el final de la misión |
| 5 | `dust_warning` |
| 6 a 9 | `dust_storm`: generación × 0.2 |
| 10 | `dust_cleared`: integridad de paneles −40 hasta limpiarlos |

La tormenta de polvo es un incidente del simulador inspirado en tormentas reales (como la global de 2018); **no ocurrió el 20 de mayo de 2024**. El evento `turn_advanced` añade `dose_rate_ugy_h`, `dose_rate_source` y `sky_factor`.
