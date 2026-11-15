# Modelo de negocio · Base Selene / Órbita

Público: niñas y niños de 7 a 12 años. Quien paga: **sus familias**. Condiciones que pidió el equipo: nada de pagar para avanzar, ninguna ventaja para quien paga, poco invasivo y atractivo.

## Recomendación en una frase

**Juego completo gratis + un único pago opcional de los padres ("Pase de Familia") que desbloquea solo cosas para verse y para compartir en casa: nunca reglas, recursos, misiones ni ayudas.**

## Por qué este modelo y no otros

| Modelo | ¿Cumple "sin ventaja"? | ¿Poco invasivo? | Veredicto |
| --- | --- | --- | --- |
| Anuncios | Sí | **No**: interrumpen, y la publicidad dirigida a menores está muy restringida | Descartado |
| Monedas, cofres o energía que se recarga pagando | **No** | **No**: empuja a comprar por impulso | Descartado |
| Suscripción mensual | Sí, si es cosmética | Regular: cobro recurrente que los padres olvidan y luego resienten | No recomendado para empezar |
| Vender misiones extra | Dudoso: quien paga aprende más contenido | Sí | Evitar; las misiones deben ser para todos |
| **Pago único cosmético de los padres** | **Sí** | **Sí** | **Recomendado** |
| Donación ("invita un café al equipo") | Sí | Sí | Complemento |

## Qué es gratis (siempre)

Todo lo que enseña o afecta la partida: las dos misiones (Luna y Marte), las dos dificultades, el tutorial, las palabras de la bitácora, las preguntas de R0-B1, las medallas, las fuentes NASA y cualquier misión futura.

## Qué incluye el Pase de Familia (pago único)

Solo apariencia y recuerdos. Ninguna de estas cosas cambia un número de la simulación:

1. **Vestidor**: colores y diseños de traje para los cuatro astronautas, y aspectos para R0-B1 (por ejemplo, R0-B1 con bufanda).
2. **Decoración de la base**: banderas, pósteres y mascota robot en el hábitat; temas de color del HUD.
3. **Diploma imprimible** con el nombre que escriban los padres y las medallas ganadas (se genera en el navegador; no se guarda ningún nombre en servidores).
4. **Álbum de misión**: tarjetas coleccionables con los datos reales de cada partida (la tormenta del 20 de mayo de 2024, etc.) para imprimir o compartir.
5. **Modo familia**: guía para jugar juntos con preguntas para conversar ("¿qué habrías apagado tú?").

Precio sugerido: un solo pago en el rango de **3 a 6 USD** (o su equivalente local), con una versión "apoya el proyecto" de precio libre por encima del mínimo. Es una hipótesis para validar, no un dato de mercado.

## Reglas que hacen que no sea invasivo

1. **El niño nunca ve un precio ni un botón de compra dentro de la partida.** La tienda vive en una sección "Para familias" del menú principal.
2. **Puerta parental** antes de cualquier enlace de pago (por ejemplo, una multiplicación de dos cifras o escribir el año de nacimiento de un adulto).
3. **Sin temporizadores, sin ofertas "solo hoy", sin contadores, sin ventanas emergentes** y sin notificaciones de venta.
4. **Los cosméticos también se pueden ganar jugando**: cada medalla desbloquea un color o adorno gratis. El pase solo añade más variedad. Así nadie se queda sin personalizar su base.
5. **El pago lo procesa un tercero** (tienda de aplicaciones o pasarela). El juego no guarda tarjetas.

## Privacidad y normas (resumen, no asesoría legal)

El juego ya funciona con **sesiones anónimas**: sin nombre, correo ni contraseña, y el progreso educativo se guarda solo en el navegador. Conviene mantenerlo así porque los servicios dirigidos a menores están regulados (COPPA en Estados Unidos, RGPD en Europa, y en México la Ley Federal de Protección de Datos Personales en Posesión de los Particulares). Antes de cobrar, un abogado debe revisar el aviso de privacidad, el consentimiento de los padres y las reglas de la tienda donde se publique.

## Ingresos secundarios compatibles

- **Licencia para escuelas, museos y planetarios**: panel del docente, guías de clase alineadas al plan de estudios y modo quiosco. Paga la institución; los alumnos no ven compras.
- **Becas y convocatorias** de divulgación científica y de educación STEM.
- **Patrocinio discreto** de instituciones afines ("Misión apoyada por…") solo en la pantalla de créditos, sin marcas dentro de la partida.

## Costos y punto de equilibrio (ejemplo con supuestos)

Los costos fijos son bajos: el frontend es estático y el backend usa SQLite con capturas NASA sin costo por consulta. Con los supuestos de la tabla, bastan pocos cientos de familias para cubrir la operación. **Los porcentajes son supuestos para ilustrar el cálculo; hay que medirlos.**

| Supuesto | Valor de ejemplo |
| --- | --- |
| Hosting, dominio y herramientas | 40 USD al mes |
| Precio del pase | 4 USD |
| Comisión de la pasarela o tienda | 15 a 30 % |
| Familias que compran, de cada 100 que juegan | 2 a 5 |

Con 4 USD y 30 % de comisión, cada pase deja 2.80 USD: se necesitan unas 15 compras al mes para cubrir 40 USD. Si compran 3 de cada 100 familias, eso son unas 500 familias activas al mes.

## Cómo medir si funciona (sin rastrear a los niños)

Solo contadores agregados y anónimos: misiones iniciadas y completadas, palabras aprendidas por partida, porcentaje que termina el tutorial y compras del pase. Nada de perfiles individuales ni identificadores de publicidad.

## Qué ya está listo en el código y qué falta

| Pieza | Estado |
| --- | --- |
| Juego completo gratis, sin cuentas | Hecho |
| Medallas y bitácora (base de los desbloqueos gratuitos) | Hecho (`src/game/learning.ts`) |
| Colores de traje por tripulante (`swap` en `PixelSprite`) | Mecanismo hecho; falta el vestidor |
| Sección "Para familias", puerta parental y diploma imprimible | Por hacer |
| Pasarela de pago y revisión legal | Por hacer; requiere decisión del equipo |

## Orden sugerido

1. Vestidor gratuito ligado a medallas (prueba si a los niños les importa personalizar).
2. Diploma imprimible y sección "Para familias" con puerta parental, todavía sin cobro.
3. Prueba con 10 a 20 familias: ¿pagarían?, ¿cuánto?, ¿qué valoran?
4. Solo entonces, revisión legal y pasarela de pago.
