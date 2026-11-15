# Modelo de negocio · RockieOS

**Estado del MVP 0.4:** el Plan Familiar es una propuesta sin suscripciones activas, pasarela ni cobros. La interfaz distingue los extras futuros del diploma básico y las preguntas que ya funcionan gratis. Las políticas comerciales siguientes describen el diseño futuro, no servicios ya contratables.

Público: niñas y niños de 7 a 12 años. Quien paga: **sus familias**. Condiciones que pidió el equipo: nada de pagar para avanzar, ninguna ventaja para quien paga, poco invasivo y atractivo. Desde el 15 de noviembre de 2026 el plan para familias es **una suscripción mensual**, no un pago único.

## Recomendación en una frase

**Juego completo gratis + una suscripción mensual opcional de los padres ("Plan Familiar") que, mientras está activa, añade cosas para verse, novedades cada mes y extras para compartir en casa: nunca reglas, recursos, misiones ni ayudas.**

## Por qué una suscripción mensual y qué la justifica

Un cobro recurrente solo es honesto si cada mes trae algo nuevo. Por eso el plan no es "el mismo paquete cobrado doce veces":

- **Novedad cada mes**: un traje, una decoración de base y un reto familiar nuevos.
- **Resumen mensual para la familia**: qué palabras aprendió y qué medallas ganó en el mes (se calcula en el navegador; no se envía a ningún servidor).
- **Ingreso estable** para mantener el backend, añadir misiones gratuitas (que siguen siendo para todos) y actualizar las capturas de datos NASA.

| Modelo | ¿Cumple "sin ventaja"? | ¿Poco invasivo? | Veredicto |
| --- | --- | --- | --- |
| Anuncios | Sí | **No**: interrumpen, y la publicidad dirigida a menores está muy restringida | Descartado |
| Monedas, cofres o energía que se recarga pagando | **No** | **No**: empuja a comprar por impulso | Descartado |
| Pago único cosmético | Sí | Sí | Modelo anterior; deja sin ingresos para mantener el juego |
| **Suscripción mensual cosmética de los padres** | **Sí** | **Sí, con las reglas de abajo** | **Elegido** |
| Vender misiones extra | Dudoso: quien paga aprende más contenido | Sí | Evitar; las misiones son para todos |
| Donación ("invita un café al equipo") | Sí | Sí | Complemento |

El riesgo conocido de las suscripciones es que las familias olvidan el cobro y luego lo resienten. Las reglas de cancelación y aviso de más abajo existen para evitarlo.

## Qué es gratis (siempre, con o sin plan)

Todo lo que enseña o afecta la partida: las dos misiones (Luna y Marte), las dos dificultades, el tutorial, las palabras de la bitácora, las preguntas de R0-B1, las medallas, los trajes que se ganan con medallas, las fuentes NASA y cualquier misión futura.

## Qué incluye el Plan Familiar (mientras esté activo)

Solo apariencia, novedades y recuerdos. Ninguna de estas cosas cambia un número de la simulación:

1. **Vestidor ampliado**: trajes de dos tonos para los cuatro astronautas y aspectos para R0-B1.
2. **Decoración de la base**: banderas, pósteres y mascota robot en el hábitat; temas de color del HUD.
3. **Diploma decorado** con el nombre que escriban los padres y las medallas ganadas (se genera en el navegador; no se guarda ningún nombre en servidores).
4. **Álbum de misión**: tarjetas coleccionables con los datos reales de cada partida.
5. **Guía Modo familia**: preguntas y retos para jugar y conversar juntos.
6. **Novedad cada mes**: un traje, una decoración y un reto familiar nuevos.
7. **Resumen para la familia** del mes, calculado en el navegador.

## Qué pasa si se cancela

- **Se conserva todo lo ganado jugando**: medallas, bitácora, progreso y trajes de medallas.
- Los trajes, decoraciones y extras del plan se desactivan **al terminar el mes ya pagado** (nunca a mitad de mes). El juego vuelve al traje gratuito elegido antes.
- Al reactivar el plan, todo lo del plan reaparece. No se pierde nada.

Así nadie siente que "le quitaron" lo que ganó, y la ventaja del plan es solo seguir recibiendo novedades y extras.

## Precio

**5 USD al mes** (o su equivalente local), fijado por el equipo el 15 de noviembre de 2026. Conviene confirmar con familias que lo perciben justo frente a lo que reciben cada mes. Opcional, cuando haya datos: un plan anual con descuento para quien lo prefiera, siempre con el mensual como opción principal.

## Reglas que hacen que no sea invasivo

1. **El niño nunca ve un precio ni un botón de suscripción dentro de la partida.** La información vive en el menú principal: una tarjeta "Plan Familiar" dirigida a madres, padres y tutores (sin precio) y la sección "Para familias" (con precio y botón).
2. **Confirmación del adulto en el pago.** Desde el 15 de noviembre de 2026 "Para familias" se abre sin la multiplicación (decisión del equipo, para que el plan se vea más). Por eso el cobro real debe pedir siempre la contraseña, huella o PIN del adulto en la tienda o pasarela. Ojo: las tiendas con categoría infantil (Apple Kids, Google Families) exigen una puerta parental antes de compras o enlaces externos; si se publica ahí, habrá que reponerla justo antes del pago.
3. **Aviso antes de cada cobro mensual** y **cancelación en cualquier momento** en el mismo lugar donde se contrató, sin llamadas ni formularios.
4. **Sin pruebas gratis que se convierten en cobro sin avisar**, sin ofertas "solo hoy", sin contadores, sin ventanas emergentes y sin notificaciones de venta.
5. **Los cosméticos también se ganan jugando**: cada medalla desbloquea un traje gratis. El plan solo añade más variedad.
6. **El cobro lo procesa un tercero** (tienda de aplicaciones o pasarela con soporte de suscripciones). El juego no guarda tarjetas.

## Privacidad y normas (resumen, no asesoría legal)

El juego funciona con **sesiones anónimas**: sin nombre, correo ni contraseña, y el progreso educativo se guarda solo en el navegador. Conviene mantenerlo así porque los servicios dirigidos a menores están regulados (COPPA en Estados Unidos, RGPD en Europa, y en México la Ley Federal de Protección de Datos Personales en Posesión de los Particulares).

Una suscripción añade obligaciones propias: en muchos países hay reglas sobre **renovación automática** (consentimiento claro, aviso previo y cancelación sencilla) y protección al consumidor (en México, la PROFECO). Además, para saber si una familia tiene el plan activo hará falta **una cuenta del adulto** o un comprobante de la tienda. Esa cuenta debe ser del adulto, nunca del niño. Antes de cobrar, un abogado debe revisar el aviso de privacidad, el consentimiento de los padres, las condiciones de renovación y las reglas de la tienda donde se publique.

## Ingresos secundarios compatibles

- **Licencia para escuelas, museos y planetarios** (también mensual o por ciclo escolar): panel del docente, guías de clase y modo quiosco. Paga la institución; los alumnos no ven compras.
- **Becas y convocatorias** de divulgación científica y educación STEM.
- **Patrocinio discreto** de instituciones afines ("Misión apoyada por…") solo en la pantalla de créditos.

## Costos y punto de equilibrio (ejemplo con supuestos)

Los costos fijos son bajos: el frontend es estático y el backend usa SQLite con capturas NASA sin costo por consulta. **Todas las cifras son supuestos para ilustrar el cálculo; hay que medirlas.**

| Supuesto | Valor de ejemplo |
| --- | --- |
| Hosting, dominio y herramientas | 40 USD al mes |
| Precio del plan | 5 USD al mes |
| Comisión de la pasarela o tienda | 15 a 30 % |
| Familias que se suscriben, de cada 100 que juegan | 2 a 4 |
| Bajas mensuales (familias que cancelan cada mes) | 8 a 12 % |

Con 5 USD y 30 % de comisión, cada suscripción deja unos 3.50 USD al mes: bastan **unas 12 suscripciones activas** para cubrir 40 USD mensuales. A diferencia del pago único, esas familias pagan otra vez el mes siguiente, así que el ingreso se acumula mientras las bajas sean menores que las altas. Con un 10 % de bajas, una familia se queda en promedio unos 10 meses, que equivalen a unos 35 USD netos por familia, frente a 2.80 USD del pase único anterior.

## Cómo medir si funciona (sin rastrear a los niños)

Solo contadores agregados y anónimos: misiones iniciadas y completadas, palabras aprendidas por partida, porcentaje que termina el tutorial, altas, bajas y reactivaciones del plan. Nada de perfiles individuales ni identificadores de publicidad. Si las bajas son altas, la señal es que las novedades mensuales no valen el precio: se mejora el contenido, no se dificulta cancelar.

## Qué ya está listo en el código y qué falta

| Pieza | Estado |
| --- | --- |
| Juego completo gratis, sin cuentas | Hecho |
| Medallas y bitácora (base de los desbloqueos gratuitos) | Hecho (`src/game/learning.ts`) |
| Vestidor gratuito ligado a medallas (`src/game/wardrobe.ts`, menú principal) | Hecho; se aplica en la partida |
| Tarjeta "Plan Familiar" en la portada y sección "Para familias" (sin puerta parental desde el 15-11-2026) con presentación destacada del plan, explicación del Plan Familiar mensual (qué incluye, qué pasa al cancelar), diploma, guía para jugar juntos y licencia escolar (`src/components/menu/FamilyModal.tsx`) | Hecho, sin cobro |
| Saber si el plan está activo (cuenta del adulto o comprobante de la tienda) | Por hacer |
| Contenido mensual (trajes, decoraciones, retos) y resumen para la familia | Por hacer |
| Pasarela con suscripciones, avisos de renovación y revisión legal | Por hacer; requiere decisión del equipo |

## Orden sugerido

1. Vestidor gratuito ligado a medallas (prueba si a los niños les importa personalizar). Hecho.
2. Sección "Para familias", todavía sin cobro, y tarjeta de promoción en la portada. Hecho.
3. Preparar al menos tres meses de novedades antes de cobrar el primero, para que el plan cumpla lo que promete.
4. Prueba con 10 a 20 familias: ¿se suscribirían?, ¿cuánto pagarían al mes?, ¿qué los haría cancelar?
5. Solo entonces: cuenta del adulto, pasarela con suscripciones y revisión legal.
