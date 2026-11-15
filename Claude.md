### Diseño y UX: estilo PIXEL ART con HUD de estrategia sci-fi (inspirado en StarCraft)

Toda la interfaz debe verse como un videojuego de estrategia retro en pixel art. Toma INSPIRACIÓN en la estructura del HUD de los RTS clásicos de ciencia ficción, pero crea TODO con diseño original: no uses assets, logos, nombres, fuentes ni sprites de StarCraft/Blizzard ni de otra franquicia.

**Layout del HUD (pantalla principal)**
- **Barra superior de recursos** (esquina superior derecha, estilo contador de recursos): Oxígeno, Comida/Agua, Energía y Día de misión, cada uno con icono pixelado + número grande. Parpadean en rojo cuando están en peligro.
- **Zona central**: la base 2D en corte transversal (estilo Fallout Shelter) con la superficie lunar/marciana arriba y el cielo con estrellas. Es el "mapa" de juego.
- **Panel inferior fijo tipo consola** con marco metálico de 3 secciones:
  1. **Izquierda: minimapa** de la base (vista reducida de los módulos con puntos de color para astronautas y alertas) + indicador de clima espacial del Sol.
  2. **Centro: unidad/módulo seleccionado**: retrato pixelado animado (astronauta o módulo), nombre, barras de salud/ánimo/energía y una breve descripción en lenguaje sencillo.
  3. **Derecha: tarjeta de comandos**: cuadrícula de 3x3 botones cuadrados con icono pixelado, tooltip y tecla rápida visible (Q W E / A S D / Z X C). Máximo 4 o 5 botones activos a la vez; los demás aparecen bloqueados hasta desbloquearlos.
- **Ventana de mensajes/NPC**: caja de diálogo con retrato pixelado del asistente (robot o astronauta), texto con efecto de máquina de escribir y botón "Entendido".
- **Alertas de eventos** (tormenta solar, falla de oxígeno): banner superior con parpadeo, sonido opcional y un minimapa que marca el módulo afectado, como las alertas de ataque de un RTS.
- **Modales** (eventos, glosario, fuentes y créditos, fin de misión): ventanas con marco metálico biselado, barra de título y botón de cerrar pixelado.

**Estilo visual pixel art**
- Resolución base baja (ej. 480x270 o 640x360) escalada por múltiplos enteros, con `image-rendering: pixelated` y sin suavizado. Los sprites y el fondo no deben verse borrosos en ningún tamaño.
- Paleta limitada (16 a 32 colores) definida como variables CSS/Tailwind: acero oscuro (#1b2330 / #2b3648), bordes metálicos claros, acentos cian neón, verde lima, naranja y rojo para alertas. Fondo con paralaje de estrellas pixeladas.
- Paneles con bordes biselados de 2 a 4 px (luz arriba-izquierda, sombra abajo-derecha), tornillos/remaches en las esquinas, líneas de "scanlines" muy sutiles y un leve brillo (glow) en elementos activos. Impleméntalo con `border-image`/9-slice, `box-shadow` por capas o canvas; elige la opción más mantenible y documenta la elección.
- Tipografía pixelada legible para niños: **Pixelify Sans** o **Silkscreen** para títulos y números, y **VT323** o similar para texto largo. Nunca menos de 16px visuales en texto de lectura, buen espaciado y alto contraste. No uses Press Start 2P para párrafos largos (se lee mal).
- Sprites y arte propio: astronautas con animaciones de 2 a 4 frames (idle, caminar, trabajar, enfermo, celebrar) en spritesheets; módulos con estados (normal, dañado, sin energía); iconos 16x16 / 32x32 consistentes. Genera los sprites como SVG con `shape-rendering="crispEdges"`, o como arrays de píxeles renderizados en canvas, para no depender de assets externos. Deja una carpeta `/public/sprites` y un archivo `sprites.config.ts` con las definiciones, para poder reemplazarlos por arte hecho a mano luego.
- Interacciones con feedback tipo retro: hover con borde brillante, clic con efecto de "presionado" (desplazamiento de 2px), números que cambian con animación por pasos (`steps()`), transiciones secas, no suaves.
- Audio opcional estilo chiptune/8-bit (clics, alertas, éxito, error), apagado por defecto, con botón de silencio visible y volumen.

**Adaptación para niños de 7 a 12 (no negociable)**
- El HUD debe verse "de videojuego serio" pero mostrar poca información a la vez: oculta módulos del panel hasta que se necesiten y usa tutorial guiado que resalte una zona del HUD por paso.
- Iconos + texto siempre juntos, nunca solo color; accesible con teclado, `aria-label`, contraste AA y `prefers-reduced-motion` (desactiva parpadeos y scanlines).
- Botones y objetivos táctiles de al menos 44px aunque el estilo sea pixelado.
- Si el HUD completo no cabe en pantallas pequeñas, colapsa el minimapa en un botón y mantén la tarjeta de comandos accesible.

**Entregable extra en Fase 1**: crea una página `/ui-kit` (oculta del menú) que muestre todos los componentes pixelados (paneles, botones, barras, retratos, modal, tooltip, alerta) y la paleta, para validar el estilo antes de construir las pantallas.