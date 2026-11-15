/**
 * Contenido educativo: palabras técnicas que explica R0-B1, mini-preguntas y medallas.
 * Todo es presentación; ninguna de estas piezas cambia las reglas ni da ventajas en la partida.
 *
 * Los textos están pensados para 7 a 12 años: frases cortas, una idea por frase y una comparación
 * con algo cotidiano. Los datos provienen de NASA (ver docs/contenido-educativo.md).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Evaluation, MissionView, TimelineEvent } from "@/lib/orbita/schema";
import type { IconName } from "@/sprites/sprites.config";

export type Lang = "es" | "en";
type L = Record<Lang, string>;

/* ------------------------------------------------------------------ */
/* Disparadores                                                        */
/* ------------------------------------------------------------------ */

/**
 * Un disparador describe "qué acaba de pasar": `start`, `event:<tipo>` o `action:<id>`,
 * con el sufijo opcional `@lunar` o `@mars` para limitarlo a una misión.
 */
export function triggersFor(events: TimelineEvent[], scenarioId: string): string[] {
  const where = scenarioId.startsWith("mars") ? "mars" : "lunar";
  const out: string[] = [];
  for (const e of events) {
    const base =
      e.type === "mission_created" || e.type === "mission_restarted"
        ? "start"
        : e.type === "action_applied"
          ? `action:${String(e.payload.action_id)}`
          : e.type === "turn_advanced"
            ? `turn:${e.turn}`
            : `event:${e.type}`;
    out.push(base, `${base}@${where}`);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Palabras técnicas (bitácora)                                        */
/* ------------------------------------------------------------------ */

export type Term = { id: string; icon: IconName; on: string[]; term: L; text: L };

export const TERMS: Term[] = [
  {
    id: "kwh",
    icon: "energy",
    on: ["start"],
    term: { es: "kWh (kilovatio-hora)", en: "kWh (kilowatt-hour)" },
    text: {
      es: "Un kWh es una medida de energía, como los litros miden el agua. Con 1 kWh puedes tener una consola de videojuegos encendida unas 5 horas. Nuestra batería guarda hasta 50.",
      en: "A kWh measures energy, like liters measure water. With 1 kWh you can run a game console for about 5 hours. Our battery holds up to 50.",
    },
  },
  {
    id: "life_support",
    icon: "heart",
    on: ["turn:1"],
    term: { es: "Soporte vital", en: "Life support" },
    text: {
      es: "Son las máquinas que nos dan aire, agua y calor. En la Tierra la naturaleza lo hace gratis. Aquí afuera, si esas máquinas se quedan sin energía, la tripulación se enferma.",
      en: "These are the machines that give us air, water and warmth. On Earth, nature does it for free. Out here, if they lose power, the crew gets sick.",
    },
  },
  {
    id: "electrolysis",
    icon: "oxygen",
    on: ["action:toggle_oxygen_generator@lunar", "turn:2@lunar"],
    term: { es: "Electrólisis", en: "Electrolysis" },
    text: {
      es: "El agua está hecha de hidrógeno y oxígeno pegados (H₂O). La electrólisis usa electricidad para separarlos, como desarmar una pieza de bloques. Así se fabrica oxígeno en la Estación Espacial.",
      en: "Water is hydrogen and oxygen stuck together (H₂O). Electrolysis uses electricity to split them, like pulling apart building blocks. That's how the Space Station makes oxygen.",
    },
  },
  {
    id: "water_recycling",
    icon: "food",
    on: ["event:water_leak"],
    term: { es: "Reciclaje de agua", en: "Water recycling" },
    text: {
      es: "En el espacio no hay ríos ni lluvia, así que el agua se limpia y se vuelve a usar una y otra vez. La Estación Espacial recupera casi 98 de cada 100 gotas. ¡Por eso una fuga es tan grave!",
      en: "There are no rivers or rain in space, so water is cleaned and used again and again. The Space Station recovers about 98 of every 100 drops. That's why a leak is so serious!",
    },
  },
  {
    id: "solar_flare",
    icon: "sun",
    on: ["event:solar_warning@lunar"],
    term: { es: "Llamarada solar", en: "Solar flare" },
    text: {
      es: "Es una explosión de luz y energía en el Sol. Su luz tarda unos 8 minutos en llegar hasta aquí. El 10 de mayo de 2024 la NASA registró varias muy fuertes: son las que usamos en esta misión.",
      en: "It's a burst of light and energy on the Sun. Its light takes about 8 minutes to get here. On May 10, 2024 NASA recorded several strong ones: those are the ones in this mission.",
    },
  },
  {
    id: "radiation",
    icon: "warning",
    on: ["event:solar_incident"],
    term: { es: "Radiación", en: "Radiation" },
    text: {
      es: "Son partículas diminutas y rapidísimas que lanza el Sol. No se ven ni se sienten, pero demasiadas dañan el cuerpo. En la Tierra nos protegen el aire y un escudo magnético invisible. Aquí nos protege el refugio.",
      en: "These are tiny, super-fast particles thrown out by the Sun. You can't see or feel them, but too many harm the body. On Earth, air and an invisible magnetic shield protect us. Here, the shelter does.",
    },
  },
  {
    id: "regolith",
    icon: "explore",
    on: ["event:panel_damage"],
    term: { es: "Regolito", en: "Regolith" },
    text: {
      es: "Es el polvo que cubre la Luna. Como allí no hay viento ni agua que lo desgasten, cada granito tiene puntas afiladas como vidrio roto. Se pega a todo: trajes, herramientas y paneles solares.",
      en: "It's the dust that covers the Moon. With no wind or water to wear it down, every grain has sharp edges like broken glass. It sticks to everything: suits, tools and solar panels.",
    },
  },
  {
    id: "photosynthesis",
    icon: "farm",
    on: ["action:toggle_greenhouse"],
    term: { es: "Fotosíntesis", en: "Photosynthesis" },
    text: {
      es: "Es el truco de las plantas: con luz, agua y aire fabrican su comida y sueltan oxígeno. Por eso el invernadero necesita energía para sus lámparas. Los astronautas ya han cultivado y comido lechuga en el espacio.",
      en: "It's the plants' trick: with light, water and air they make their food and release oxygen. That's why the greenhouse needs power for its lamps. Astronauts have already grown and eaten lettuce in space.",
    },
  },
  {
    id: "sol",
    icon: "day",
    on: ["start@mars"],
    term: { es: "Sol (día marciano)", en: "Sol (Martian day)" },
    text: {
      es: "En Marte un día se llama «sol» y dura 24 horas y 39 minutos: casi 40 minutos más que un día en la Tierra. Los científicos que manejan los rovers a veces viven con horario marciano.",
      en: "On Mars a day is called a “sol” and lasts 24 hours and 39 minutes: almost 40 minutes longer than an Earth day. Scientists who drive the rovers sometimes live on Mars time.",
    },
  },
  {
    id: "irradiance",
    icon: "solar",
    on: ["turn:1@mars"],
    term: { es: "Luz solar en Marte", en: "Sunlight on Mars" },
    text: {
      es: "Marte está más lejos del Sol que la Tierra, así que le llega menos luz: solo 43 de cada 100 rayitos. Es como alejarte de una fogata. Por eso aquí los paneles solares son más del doble de grandes.",
      en: "Mars is farther from the Sun than Earth, so less light arrives: only 43 of every 100 rays. It's like stepping back from a campfire. That's why solar panels here are more than twice as big.",
    },
  },
  {
    id: "isru",
    icon: "oxygen",
    on: ["action:toggle_oxygen_generator@mars", "turn:2@mars"],
    term: { es: "MOXIE: oxígeno del aire marciano", en: "MOXIE: oxygen from Martian air" },
    text: {
      es: "El aire de Marte es casi todo dióxido de carbono (CO₂), que no se puede respirar. MOXIE fue un experimento real del rover Perseverance que le quitó el oxígeno a ese CO₂. Nuestro generador hace lo mismo, en grande.",
      en: "Mars air is almost all carbon dioxide (CO₂), which we can't breathe. MOXIE was a real experiment on the Perseverance rover that pulled the oxygen out of that CO₂. Our generator does the same, but bigger.",
    },
  },
  {
    id: "cme",
    icon: "sun",
    on: ["event:solar_warning@mars"],
    term: { es: "Eyección de masa coronal", en: "Coronal mass ejection" },
    text: {
      es: "Es una nube gigante de partículas que el Sol lanza como un estornudo. La de hoy es real: salió el 20 de mayo de 2024 a las 05:36, viajando a unos 2,000 kilómetros por segundo, y llegó a Marte.",
      en: "It's a giant cloud of particles the Sun throws out like a sneeze. Today's is real: it left on May 20, 2024 at 05:36, traveling about 2,000 kilometers per second, and it reached Mars.",
    },
  },
  {
    id: "rad",
    icon: "flask",
    on: ["event:solar_incident@mars"],
    term: { es: "RAD, el medidor del rover Curiosity", en: "RAD, the Curiosity rover's detector" },
    text: {
      es: "Curiosity es un rover de la NASA que explora Marte desde 2012. Lleva un aparato llamado RAD que cuenta la radiación. Los números de esta misión son los que RAD midió de verdad ese día.",
      en: "Curiosity is a NASA rover that has explored Mars since 2012. It carries a device called RAD that counts radiation. The numbers in this mission are the ones RAD really measured that day.",
    },
  },
  {
    id: "dust_storm",
    icon: "warning",
    on: ["event:dust_warning"],
    term: { es: "Tormenta de polvo", en: "Dust storm" },
    text: {
      es: "En Marte el viento levanta polvo tan fino como el talco y puede tapar el cielo durante semanas. En 2018 una tormenta cubrió todo el planeta y dejó sin energía al rover Opportunity, que usaba paneles solares.",
      en: "On Mars the wind lifts dust as fine as baby powder and can hide the sky for weeks. In 2018 a storm covered the whole planet and left the solar-powered Opportunity rover without energy.",
    },
  },
  {
    id: "radio_delay",
    icon: "antenna",
    on: ["action:contact_earth"],
    term: { es: "Retraso de la señal", en: "Signal delay" },
    text: {
      es: "Los mensajes viajan por radio a la velocidad de la luz, ¡la más rápida que existe! Aun así, Marte está tan lejos que tardan entre 5 y 20 minutos en llegar. No se puede platicar en vivo con la Tierra.",
      en: "Messages travel by radio at the speed of light, the fastest there is! Even so, Mars is so far away that they take 5 to 20 minutes to arrive. You can't chat live with Earth.",
    },
  },
];

/* ------------------------------------------------------------------ */
/* Mini-preguntas (nunca penalizan)                                    */
/* ------------------------------------------------------------------ */

export type Quiz = { id: string; on: string[]; question: L; options: L[]; answer: number; explain: L };

export const QUIZZES: Quiz[] = [
  {
    id: "why_leak",
    on: ["action:repair_water_loop"],
    question: { es: "¿Por qué en el espacio se recicla el agua en vez de traer más?", en: "Why is water recycled in space instead of bringing more?" },
    options: [
      { es: "Porque traerla desde la Tierra es muy difícil y caro", en: "Because bringing it from Earth is very hard and expensive" },
      { es: "Porque el agua nueva sabe mal", en: "Because new water tastes bad" },
      { es: "Porque a los astronautas no les da sed", en: "Because astronauts don't get thirsty" },
    ],
    answer: 0,
    explain: { es: "El agua pesa mucho y cada kilo que sube en un cohete cuesta muchísimo. Es mejor limpiarla y volver a usarla.", en: "Water is heavy and every kilo on a rocket costs a lot. It's better to clean it and use it again." },
  },
  {
    id: "earth_shield",
    on: ["event:solar_incident@lunar"],
    question: { es: "¿Qué protege a la Tierra de las tormentas solares?", en: "What protects Earth from solar storms?" },
    options: [
      { es: "Las nubes de lluvia", en: "Rain clouds" },
      { es: "El aire y un escudo magnético invisible", en: "The air and an invisible magnetic shield" },
      { es: "La Luna, que se pone enfrente", en: "The Moon, which stands in front" },
    ],
    answer: 1,
    explain: { es: "La atmósfera y el campo magnético de la Tierra desvían casi todas las partículas. La Luna no tiene ninguno de los dos.", en: "Earth's atmosphere and magnetic field turn away almost all the particles. The Moon has neither." },
  },
  {
    id: "sharp_dust",
    on: ["action:repair_solar_panels@lunar"],
    question: { es: "¿Por qué el polvo de la Luna es tan afilado?", en: "Why is Moon dust so sharp?" },
    options: [
      { es: "Porque está congelado", en: "Because it's frozen" },
      { es: "Porque es de metal", en: "Because it's made of metal" },
      { es: "Porque no hay viento ni agua que lo desgasten", en: "Because there's no wind or water to wear it down" },
    ],
    answer: 2,
    explain: { es: "En la Tierra el viento y el agua redondean la arena. En la Luna nada la pule, así que queda puntiaguda.", en: "On Earth, wind and water round off sand. On the Moon nothing smooths it, so it stays pointy." },
  },
  {
    id: "moxie_source",
    on: ["turn:3@mars"],
    question: { es: "¿De dónde saca oxígeno nuestro generador en Marte?", en: "Where does our generator get oxygen on Mars?" },
    options: [
      { es: "Del dióxido de carbono (CO₂) del aire marciano", en: "From the carbon dioxide (CO₂) in Martian air" },
      { es: "De tanques que llegan cada día desde la Tierra", en: "From tanks that arrive daily from Earth" },
      { es: "De las piedras rojas", en: "From the red rocks" },
    ],
    answer: 0,
    explain: { es: "El CO₂ tiene oxígeno «pegado». El experimento MOXIE demostró en Marte que se puede separar.", en: "CO₂ has oxygen “stuck” to it. The MOXIE experiment showed on Mars that it can be separated." },
  },
  {
    id: "rad_times",
    on: ["turn:4@mars"],
    question: {
      es: "RAD midió unos 4 de radiación antes de la tormenta y unos 246 en lo más fuerte. ¿Cuántas veces más es eso?",
      en: "RAD measured about 4 of radiation before the storm and about 246 at its strongest. How many times more is that?",
    },
    options: [
      { es: "Unas 6 veces", en: "About 6 times" },
      { es: "Unas 60 veces", en: "About 60 times" },
      { es: "Unas 600 veces", en: "About 600 times" },
    ],
    answer: 1,
    explain: { es: "246 entre 4 da un poco más de 60. Por eso convenía estar en el refugio.", en: "246 divided by 4 is a little over 60. That's why the shelter was a good idea." },
  },
  {
    id: "dust_power",
    on: ["event:dust_storm"],
    question: { es: "¿Por qué los paneles producen menos durante la tormenta de polvo?", en: "Why do the panels make less power during the dust storm?" },
    options: [
      { es: "Porque el viento los apaga", en: "Because the wind switches them off" },
      { es: "Porque hace más frío", en: "Because it's colder" },
      { es: "Porque el polvo tapa la luz del Sol", en: "Because dust blocks the sunlight" },
    ],
    answer: 2,
    explain: { es: "Los paneles convierten luz en electricidad. Sin luz, no hay electricidad: toca ahorrar batería.", en: "Panels turn light into electricity. No light, no electricity: time to save battery." },
  },
  {
    id: "why_delay",
    on: ["event:earth_reply"],
    question: { es: "¿Por qué la respuesta de la Tierra tardó en llegar?", en: "Why did Earth's reply take time to arrive?" },
    options: [
      { es: "Porque en la Tierra estaban dormidos", en: "Because everyone on Earth was asleep" },
      { es: "Porque Marte está lejísimos y la señal tarda minutos en cruzar", en: "Because Mars is very far and the signal takes minutes to cross" },
      { es: "Porque la radio estaba descompuesta", en: "Because the radio was broken" },
    ],
    answer: 1,
    explain: { es: "Ni la luz, que es lo más rápido que existe, llega al instante: tarda entre 5 y 20 minutos.", en: "Not even light, the fastest thing there is, arrives instantly: it takes 5 to 20 minutes." },
  },
];

/* ------------------------------------------------------------------ */
/* Medallas (sólo reconocimiento; no cambian nada en la partida)       */
/* ------------------------------------------------------------------ */

export type Progress = { terms: string[]; quizzes: Record<string, boolean>; medals: string[]; tutorialDone: boolean };
type MedalInput = { mission: MissionView; log: TimelineEvent[]; evaluation: Evaluation | null; progress: Progress };
export type Medal = { id: string; icon: IconName; name: L; how: L; earned: (i: MedalInput) => boolean };

const done = (i: MedalInput) => i.mission.state.status === "completed";
const happened = (i: MedalInput, type: string) => i.log.some((e) => e.type === type);
const acted = (i: MedalInput, action: string, turn?: number) =>
  i.log.some((e) => e.type === "action_applied" && e.payload.action_id === action && (turn === undefined || e.turn === turn));

export const MEDALS: Medal[] = [
  {
    id: "graduate",
    icon: "flask",
    name: { es: "Cadete graduado", en: "Graduated cadet" },
    how: { es: "Termina el tutorial jugable.", en: "Finish the playable tutorial." },
    // Saltar también marca tutorialDone para no volver a mostrar el entrenador.
    // Sólo nextCoach entrega esta medalla al completar todos los pasos.
    earned: () => false,
  },
  {
    id: "first_day",
    icon: "day",
    name: { es: "Primer día fuera de casa", en: "First day away from home" },
    how: { es: "Completa los 12 turnos de una misión.", en: "Complete all 12 turns of a mission." },
    earned: done,
  },
  {
    id: "plumber",
    icon: "repairWater",
    name: { es: "Fontanero lunar", en: "Lunar plumber" },
    how: { es: "Repara la fuga de agua en el mismo turno en que aparece.", en: "Fix the water leak on the same turn it appears." },
    earned: (i) => acted(i, "repair_water_loop", 2),
  },
  {
    id: "storm_safe",
    icon: "shelter",
    name: { es: "A salvo de la tormenta", en: "Safe from the storm" },
    how: { es: "Termina una misión con la exposición por debajo de 40.", en: "Finish a mission with exposure below 40." },
    earned: (i) => done(i) && i.mission.state.exposure_risk_index < 40,
  },
  {
    id: "scientist",
    icon: "explore",
    name: { es: "Gran exploradora, gran explorador", en: "Great explorer" },
    how: { es: "Alcanza la meta de puntos de ciencia.", en: "Reach the science points goal." },
    earned: (i) => !!i.evaluation?.objectives.science_target,
  },
  {
    id: "healthy",
    icon: "heart",
    name: { es: "Tripulación feliz", en: "Happy crew" },
    how: { es: "Termina una misión con la salud en 100.", en: "Finish a mission with health at 100." },
    earned: (i) => done(i) && i.mission.state.crew_health_pct >= 100,
  },
  {
    id: "mars_pioneer",
    icon: "mars",
    name: { es: "Pionero de Marte", en: "Mars pioneer" },
    how: { es: "Completa la misión de Marte.", en: "Complete the Mars mission." },
    earned: (i) => done(i) && i.mission.state.scenario_id === "mars-outpost-v1",
  },
  {
    id: "earth_call",
    icon: "antenna",
    name: { es: "Hola, Tierra", en: "Hello, Earth" },
    how: { es: "Recibe una respuesta de la Tierra en Marte.", en: "Get a reply from Earth on Mars." },
    earned: (i) => happened(i, "earth_reply"),
  },
  {
    id: "dust_buster",
    icon: "repairSolar",
    name: { es: "Cazapolvo", en: "Dust buster" },
    how: { es: "Limpia los paneles después de la tormenta de polvo.", en: "Clean the panels after the dust storm." },
    earned: (i) => happened(i, "dust_cleared") && i.mission.state.systems.solar_integrity_pct >= 100,
  },
  {
    id: "commander",
    icon: "gear",
    name: { es: "Comandante de verdad", en: "True commander" },
    how: { es: "Logra una misión exitosa en dificultad Comandante.", en: "Achieve a successful mission on Commander difficulty." },
    earned: (i) => i.evaluation?.outcome === "success" && i.mission.state.difficulty === "commander",
  },
  {
    id: "word_collector",
    icon: "book",
    name: { es: "Coleccionista de palabras", en: "Word collector" },
    how: { es: "Aprende 8 palabras científicas.", en: "Learn 8 science words." },
    earned: (i) => i.progress.terms.length >= 8,
  },
  {
    id: "quiz_ace",
    icon: "medal",
    name: { es: "Mente brillante", en: "Bright mind" },
    how: { es: "Responde bien 5 preguntas de R0-B1.", en: "Answer 5 of R0-B1's questions correctly." },
    earned: (i) => Object.values(i.progress.quizzes).filter(Boolean).length >= 5,
  },
];

/* ------------------------------------------------------------------ */
/* Progreso guardado en este navegador (sin cuentas ni datos personales) */
/* ------------------------------------------------------------------ */

const KEY = "selene.progress.v1";
const EMPTY: Progress = { terms: [], quizzes: {}, medals: [], tutorialDone: false };

export function loadProgress(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Progress> | null;
    if (!raw || typeof raw !== "object") return { ...EMPTY };
    return {
      terms: Array.isArray(raw.terms) ? raw.terms.filter((x) => typeof x === "string") : [],
      quizzes: raw.quizzes && typeof raw.quizzes === "object" ? raw.quizzes : {},
      medals: Array.isArray(raw.medals) ? raw.medals.filter((x) => typeof x === "string") : [],
      // Compatibilidad con la marca que usaba el tutorial anterior.
      tutorialDone: raw.tutorialDone === true || localStorage.getItem("selene.tutorialDone") === "1",
    };
  } catch {
    return { ...EMPTY };
  }
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: el progreso dura lo que dure la pestaña */
  }
}

/** Primera palabra y primera pregunta pendientes para lo que acaba de pasar. */
export function pickLesson(triggers: string[], p: Progress) {
  const hit = (on: string[]) => on.some((t) => triggers.includes(t));
  return {
    term: TERMS.find((t) => !p.terms.includes(t.id) && hit(t.on)) ?? null,
    quiz: QUIZZES.find((q) => p.quizzes[q.id] !== true && hit(q.on)) ?? null,
  };
}

export function newMedals(input: MedalInput): Medal[] {
  return MEDALS.filter((m) => !input.progress.medals.includes(m.id) && m.earned(input));
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setProgress(loadProgress());
    setReady(true);
  }, []);
  const update = useCallback((change: (p: Progress) => Progress) => {
    setProgress((previous) => {
      const next = change(previous);
      if (next !== previous) saveProgress(next);
      return next;
    });
  }, []);
  return {
    progress,
    ready,
    learn: useCallback((id: string) => update((p) => (p.terms.includes(id) ? p : { ...p, terms: [...p.terms, id] })), [update]),
    answer: useCallback((id: string, correct: boolean) => update((p) => (p.quizzes[id] === true ? p : { ...p, quizzes: { ...p.quizzes, [id]: correct } })), [update]),
    award: useCallback((ids: string[]) => update((p) => (ids.every((id) => p.medals.includes(id)) ? p : { ...p, medals: [...new Set([...p.medals, ...ids])] })), [update]),
    finishTutorial: useCallback(() => update((p) => (p.tutorialDone ? p : { ...p, tutorialDone: true })), [update]),
  };
}
