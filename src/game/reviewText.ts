/** Textos de decisiones, evaluación y procedencia. Los identificadores son estables. */
export function reviewText(locale: string) {
  return locale === "en" ? EN : ES;
}

const ES = {
  immediate: "Ahora", forecast: "Al avanzar 2 horas", without: "Sin esta acción", with: "Con esta acción",
  forecastError: "No pudimos calcular la previsión. Reintenta antes de confirmar.", retry: "Recalcular",
  noImmediate: "Las reservas no cambian ahora. Revisa el efecto del siguiente turno.",
  support: "Soporte vital", details: "Ver reservas", hide: "Ocultar reservas",
  foodHours: "Alimento almacenado", hours: "horas sin nueva cosecha", foodTarget: "Reserva al terminar",
  harvestNote: "El cultivo ya está creciendo. Apagarlo ahorra energía, pero reduce la comida de mañana.",
  pendingRadio: "Respuesta pendiente", minutes: "min", data: "Datos nuevos sin enviar",
  radioNote: "La señal de este ejercicio tarda 20 min por sentido. Leemos la respuesta al avanzar 2 h. Si hay peligro, decide antes de esperar.",
  shelterAlert: "La radiación seguirá elevada al avanzar. El refugio reduce la exposición; salir permite trabajar, pero aumenta ese coste.",
  shelterShort: "Radiación elevada · revisa el refugio antes de avanzar",
  exposureTarget: "Meta de exposición del juego", points: "puntos o menos",
  radioTitle: "Informe de la Tierra", reportFrom: "Recibido en el turno", reportExpired: "Informe anterior: vuelve a consultar para actualizarlo.",
  radioReportNote: "Plan del ejercicio: archivo de Curiosity y polvo simulado. No es un pronóstico NASA en vivo.",
  nextReading: "Lectura del próximo bloque", evaWindow: "Menor lectura para explorar: turno", noEvaWindow: "No hay una ventana de lectura baja en estos dos turnos. Salir sigue teniendo un coste de exposición.",
  dustWindow: "Polvo simulado: turnos", radioChoice: "Consultar usa 1 acción y 1 kWh. Esperar avanza 2 horas: la base consume suministros y el peligro puede llegar antes de leer la respuesta.",
  shelterFirst: "Revisar el refugio primero",
  radioAdvice: {
    shelter_now: "La radiación continúa elevada. Puedes protegerte ahora o aceptar más exposición para trabajar fuera.",
    save_power: "Se aproxima o continúa el polvo. Compara el ahorro eléctrico con la producción de aire y comida.",
    clean_panels: "El polvo quedó en los paneles. Limpiarlos recupera generación, pero requiere salir del refugio y usar una acción.",
    research_window: "Planifica la investigación y reúne datos antes de enviarlos. Transmitir el mismo lote otra vez no aporta ciencia.",
  } as Record<string, string>,
  historical: "Archivo NASA", training: "Entrenamiento variado", historicalMode: "Caso histórico",
  modeNote: "El entrenamiento cambia sólo averías y polvo simulados; las mediciones NASA conservan su orden real.",
  observed: "Observación (UTC)", downloaded: "Descarga (UTC)", originalNote: "Nota original de la fuente",
  provenance: "Curiosity · MSL-RAD · 20 may 2024 · medias de 2 horas. El índice de juego es una transformación didáctica.",
  simulation: "Reglas del simulador", sameCase: "Comparación con tu intento anterior", changed: "Decisiones distintas",
  previous: "Antes", current: "Ahora", none: "Ninguna", score: "Puntuación", health: "Salud", exposure: "Exposición",
  comparisonNote: "Misma semilla, mediciones y reglas. Las diferencias reflejan el conjunto de decisiones; consulta los turnos que cambiaste.",
  turn: "Turno", duration: "Turnos completados", food: "Comida", energy: "Energía",
  aiCredit: "Desarrollo asistido por IA: ChatGPT/Codex y Claude. El equipo revisa código, ciencia y decisiones. NASA no avala este proyecto.",
  objectives: {
    food_reserve: "Conservar alimento para mañana", science_shared: "Compartir datos nuevos con la Tierra",
    radiation_protection: "Cumplir la meta de protección radiológica del juego",
  } as Record<string, string>,
  feedback: {
    repair_leak: "Reparar pronto una fuga conserva agua para los turnos siguientes.",
    plan_shelter: "Planifica el refugio antes del incidente para reducir la exposición simulada.",
    protection_target: "La salud no cuenta toda la historia: usa el refugio para cumplir la meta de exposición del ejercicio.",
    research_lunar: "Dos exploraciones alcanzan el objetivo científico; cada una consume suministros.",
    research_mars: "Explora para reunir datos nuevos. Un informe con datos nuevos también aporta ciencia.",
    keep_food: "Conserva alimento para mañana. Apagar el cultivo ahorra energía ahora, pero reduce esa reserva.",
    share_data: "Envía los datos de al menos una exploración. Repetir una consulta sin datos no produce ciencia.",
    power_lunar: "Repara los paneles o pausa sistemas secundarios para proteger el soporte vital.",
    power_mars: "Limpia los paneles y planifica qué sistemas pausar durante el polvo.",
    good_balance: "Equilibraste protección, investigación y suministros para continuar.",
  } as Record<string, string>,
};

const EN: typeof ES = {
  immediate: "Now", forecast: "After advancing 2 hours", without: "Without this action", with: "With this action",
  forecastError: "We could not calculate the forecast. Retry before confirming.", retry: "Recalculate",
  noImmediate: "Supplies do not change immediately. Check the next-turn effect.",
  support: "Life support", details: "Show supplies", hide: "Hide supplies",
  foodHours: "Stored food", hours: "hours without another harvest", foodTarget: "Finish with at least",
  harvestNote: "The crop is already established. Switching it off saves power but reduces tomorrow's food.",
  pendingRadio: "Reply pending", minutes: "min", data: "New data not yet sent",
  radioNote: "This exercise uses 20 min each way. We read the reply when advancing 2 h. If danger is coming, decide before waiting.",
  shelterAlert: "Radiation will still be elevated after advancing. Shelter reduces exposure; leaving lets you work but increases that cost.",
  shelterShort: "Elevated radiation · check shelter before advancing",
  exposureTarget: "Game exposure goal", points: "points or less",
  radioTitle: "Earth planning report", reportFrom: "Received on turn", reportExpired: "Older report: contact Earth again to update it.",
  radioReportNote: "Exercise plan: Curiosity archive and simulated dust, not a live NASA forecast.",
  nextReading: "Next block reading", evaWindow: "Lower-reading exploration window: turn", noEvaWindow: "No low-reading window in these two turns. Going outside still costs exposure.",
  dustWindow: "Simulated dust: turns", radioChoice: "Contacting Earth uses 1 action and 1 kWh. Waiting advances 2 hours: supplies are consumed and danger may arrive before you read the reply.",
  shelterFirst: "Check shelter first",
  radioAdvice: {
    shelter_now: "Radiation remains elevated. Protect the crew now or accept more exposure to work outside.",
    save_power: "Dust is approaching or continuing. Compare power savings with air and food production.",
    clean_panels: "Dust remains on the panels. Cleaning restores generation but requires leaving shelter and using an action.",
    research_window: "Plan research and collect data before sending it. Transmitting the same batch twice earns no science.",
  },
  historical: "NASA archive", training: "Varied training", historicalMode: "Historical case",
  modeNote: "Training varies only simulated faults and dust; NASA readings keep their real order.",
  observed: "Observation (UTC)", downloaded: "Downloaded (UTC)", originalNote: "Original source note",
  provenance: "Curiosity · MSL-RAD · May 20, 2024 · 2-hour means. Game exposure is an educational transformation.",
  simulation: "Simulation rules", sameCase: "Compared with your previous attempt", changed: "Different decisions",
  previous: "Before", current: "Now", none: "None", score: "Score", health: "Health", exposure: "Exposure",
  comparisonNote: "Same seed, readings and rules. Differences reflect all your decisions; review the turns you changed.",
  turn: "Turn", duration: "Turns completed", food: "Food", energy: "Power",
  aiCredit: "AI-assisted development: ChatGPT/Codex and Claude. The team reviews code, science and decisions. NASA does not endorse this project.",
  objectives: { food_reserve: "Keep food for tomorrow", science_shared: "Share new research with Earth", radiation_protection: "Meet the game's radiation protection goal" },
  feedback: {
    repair_leak: "Fixing a leak early saves water for later turns.",
    plan_shelter: "Plan shelter before the event to reduce simulated exposure.",
    protection_target: "Health does not tell the whole story: use shelter to meet the exercise exposure goal.",
    research_lunar: "Two explorations reach the science goal; each uses supplies.",
    research_mars: "Explore to gather new data. A report with new data also earns science.",
    keep_food: "Keep food for tomorrow. Switching crops off saves power now but reduces that reserve.",
    share_data: "Send data from at least one exploration. Repeating a request without new data earns no science.",
    power_lunar: "Repair panels or pause secondary systems to protect life support.",
    power_mars: "Clean the panels and plan which systems to pause during the dust storm.",
    good_balance: "You balanced protection, research and supplies for the next stage.",
  },
};

const LEGACY_FEEDBACK_EN: Record<string, string> = {
  "Reparar pronto una fuga conserva agua para los turnos siguientes.": EN.feedback.repair_leak,
  "Planificar el refugio antes del incidente reduce el índice de exposición simulado.": EN.feedback.plan_shelter,
  "Dos exploraciones alcanzan el objetivo científico; cada una consume suministros.": EN.feedback.research_lunar,
  "Dos exploraciones y un informe a la Tierra alcanzan el objetivo científico.": EN.feedback.research_mars,
  "Limpia los paneles o pausa sistemas secundarios durante la tormenta de polvo.": EN.feedback.power_mars,
  "Repara los paneles o pausa sistemas secundarios para proteger el soporte vital.": EN.feedback.power_lunar,
  "Buen equilibrio entre investigación, reservas y protección durante este ejercicio.": EN.feedback.good_balance,
  "Completaste la misión y sus objetivos de salud y exploración.": "You completed the mission and its health and exploration goals.",
  "Modo demo: enciende el backend para la evaluación oficial.": "Visual demo: connect the backend for the mission evaluation.",
};

export function feedbackText(code: string | undefined, original: string, locale: string): string {
  return reviewText(locale).feedback[code ?? ""] ?? (locale === "en"
    ? LEGACY_FEEDBACK_EN[original] ?? "Review your supplies, research and protection for the next attempt."
    : original);
}

export function sourceText(id: string, mars: boolean, locale: string): { title: string; detail: string } {
  const english = locale === "en";
  const sources: Record<string, [string, string]> = english ? {
    "donki-episode": ["DONKI · historical space weather", mars
      ? "Solar events on May 20, 2024. The exercise warning is brought forward so you can prepare; it is not a live forecast."
      : "Flares recorded on May 10, 2024 provide historical context. Flare class is not converted into a habitat radiation dose."],
    "radlab-reference": [mars ? "RadLab · Curiosity on Mars" : "RadLab · CRaTER in lunar orbit", mars
      ? "Surface measurements from MSL-RAD on May 20, 2024. Two-hour means shape game exposure, which is not a dose for people."
      : "CRaTER/LRO measurements on January 1, 2014 are orbital references, not measurements inside a surface shelter."],
    "osdr-study": ["OSDR · OSD-104", "Mouse space-biology research. The study documents biological effects of spaceflight; its metadata do not establish human health coefficients."],
  } : {
    "donki-episode": ["DONKI · clima espacial histórico", mars
      ? "Sucesos del 20 de mayo de 2024. El aviso se adelanta para practicar; no es un pronóstico actual."
      : "Llamaradas del 10 de mayo de 2024 como contexto. Su clase no se convierte en dosis del hábitat."],
    "radlab-reference": [mars ? "RadLab · Curiosity en Marte" : "RadLab · CRaTER en órbita lunar", mars
      ? "MSL-RAD midió en la superficie el 20 de mayo de 2024. Las medias de dos horas dan forma al índice del juego; no son dosis para personas."
      : "CRaTER/LRO, 1 de enero de 2014: referencia orbital, no medición del interior de un refugio de superficie."],
    "osdr-study": ["OSDR · OSD-104", "Investigación de biología espacial en ratones. Sus metadatos documentan el estudio; no establecen coeficientes de salud humana."],
  };
  const [title, detail] = sources[id] ?? [id, english ? "Original scientific reference; see the linked source." : "Referencia científica original; consulta el enlace."];
  return { title, detail };
}

const WARNINGS_EN: Record<string, string> = {
  "DONKI aporta eventos observados y análisis; no mide la dosis de una base lunar o marciana.": "DONKI provides observed events and analyses, not outpost radiation doses.",
  "Las mediciones pertenecen al instrumento y trayectoria indicados; no representan automáticamente la superficie ni la dosis humana.": "Measurements belong to the stated instrument and trajectory; they are not automatically surface measurements or human doses.",
  "uGy/h y uSv/h son magnitudes distintas; esta API no las convierte entre sí.": "uGy/h and uSv/h are different quantities; the API does not convert between them.",
  "Captura histórica estática; no es una consulta en vivo.": "Static historical archive, not a live observation.",
  "Los timestamps sin zona de RadLab se interpretaron como UTC.": "RadLab timestamps without a timezone were interpreted as UTC.",
  "Existen filas sin mediciones disponibles; no se sustituyeron por cero.": "Some rows have no measurements; missing values were not replaced with zero.",
  "La consulta no devolvió registros; esto no prueba la ausencia de riesgo o de fenómenos.": "The query returned no records; this does not establish an absence of risk or events.",
  "Los datos se obtuvieron, pero no pudieron guardarse en caché.": "The data were retrieved but could not be cached.",
};
export function warningText(text: string, locale: string): string {
  if (locale !== "en") return text;
  if (text.startsWith("Caché vencida")) return "An expired cached response was used after a temporary provider failure.";
  return WARNINGS_EN[text] ?? "Additional source conditions apply; consult the original NASA record.";
}


export function missionErrorText(message: string, locale: string, code?: string | null): string {
  if (locale !== "en") return message;
  const messages: Record<string, string> = {
    UNAUTHORIZED: "Your session has expired. Start a new session to continue.",
    VERSION_CONFLICT: "This mission changed. Refresh its state before making another decision.",
    ACTION_UNAVAILABLE: "This action is no longer available. Check the current mission state.",
    RATE_LIMITED: "Please wait for the countdown before trying again.",
    MISSION_LIMIT: "Finish or abandon a saved mission before starting another one.",
    MISSION_PAUSED: "Resume the mission before taking an action.",
    PROXY_CONFIG_ERROR: "The mission connection needs to be configured. Use the project launcher or contact its host.",
    INVALID_ORIGIN: "Open the game at its configured address and try again.",
    RESOURCE_CONTRACT_ERROR: "The scientific data could not be verified. Retry the connection.",
    RESOURCE_UNAVAILABLE: "The scientific resource service is unavailable. Please retry.",
  };
  return messages[code ?? ""] ?? "The mission request could not be completed. Please retry.";
}
