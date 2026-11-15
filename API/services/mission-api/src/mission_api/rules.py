"""Parámetros didácticos versionados; no son coeficientes certificados por NASA."""
from dataclasses import asdict, dataclass, replace
import random

LUNAR = "lunar-outpost-v1"
MARS = "mars-outpost-v1"

# Tasa de dosis absorbida medida por MSL-RAD (rover Curiosity, superficie de Marte) el 20 de mayo
# de 2024: media de cada bloque de dos horas UTC, en uGy/h. Proviene de la captura RadLab
# `radlab-msl-rad-2024-05-20`; scripts/tests/test_mars_profile.py comprueba que coincide.
MARS_RAD_PROFILE_UGY_H = (3.81, 3.93, 60.05, 246.39, 122.15, 91.23, 72.12, 48.51, 38.63, 31.07, 27.25, 22.93)


@dataclass(frozen=True)
class Rules:
    version: str = "lunar-1.0.0"
    turns: int = 12
    turn_hours: int = 2
    crew_count: int = 4
    actions_per_turn: int = 2
    energy_capacity_kwh: float = 50
    oxygen_capacity_kg: float = 6
    water_capacity_l: float = 30
    food_capacity_kg: float = 6
    solar_kw: float = 5.5
    habitat_kw: float = 2
    oxygen_generator_kw: float = 1.2
    water_loop_kw: float = 0.4
    greenhouse_kw: float = 1
    oxygen_produced_kg_per_hour: float = 0.20
    water_used_by_generator_l_per_hour: float = 0.225
    water_recovered_l_per_hour: float = 0.30
    food_produced_kg_per_hour: float = 0.035
    crew_oxygen_kg_per_person_hour: float = 0.035
    crew_water_l_per_person_hour: float = 0.15
    crew_food_kg_per_person_hour: float = 0.025
    leak_l_per_hour: float = 0.8
    background_risk_per_turn: float = 0.2
    shelter_risk_factor: float = 0.1
    science_target: int = 24
    # --- Campos usados por el escenario marciano; en la Luna conservan valores neutros. ---
    # Fracción de la luz solar que llega respecto a la órbita terrestre (Marte: ~43 %).
    solar_irradiance_factor: float = 1.0
    # Perfil real de dosis por turno (uGy/h) y su conversión a puntos didácticos de exposición.
    radiation_profile_ugy_h: tuple[float, ...] = ()
    exposure_points_per_ugy_h: float = 0.0
    # Tormenta de polvo: turnos afectados, fracción de luz que pasa y polvo depositado al terminar.
    dust_storm_turns: tuple[int, ...] = ()
    dust_generation_factor: float = 1.0
    dust_deposit_pct: float = 0.0
    # Puntos científicos que aporta la respuesta de la Tierra a un informe.
    earth_reply_science: int = 0
    food_reserve_target_kg: float = 0.0
    required_transmitted_data: int = 0
    radio_delay_minutes_one_way: int = 20
    water_leak_turn: int = 2
    panel_damage_turn: int = 8
    power_protection_factor: float = 0.3


RULES = Rules()
MARS_RULES = Rules(
    version="mars-1.0.0",
    # Paneles 2.3 veces mayores: 12.8 kW nominales x 0.43 de luz solar = 5.5 kW útiles.
    solar_kw=12.8, solar_irradiance_factor=0.43,
    # El generador obtiene oxígeno del CO2 del aire (como MOXIE): no gasta agua y pide más energía.
    oxygen_generator_kw=2.0, water_used_by_generator_l_per_hour=0.0,
    background_risk_per_turn=0.0, radiation_profile_ugy_h=MARS_RAD_PROFILE_UGY_H, exposure_points_per_ugy_h=0.13,
    dust_storm_turns=(6, 7, 8, 9), dust_generation_factor=0.2, dust_deposit_pct=40,
    science_target=30, earth_reply_science=6,
)
LEGACY_RULESETS = {LUNAR: RULES, MARS: MARS_RULES}
RULESETS = {
    LUNAR: replace(RULES, version="lunar-1.1.0", food_reserve_target_kg=0.8),
    MARS: replace(MARS_RULES, version="mars-1.1.0", food_reserve_target_kg=0.8, required_transmitted_data=12),
}
VERSIONED_RULESETS = {r.version: r for r in (*LEGACY_RULESETS.values(), *RULESETS.values())}
TERMINAL = {"completed", "failed", "aborted"}


def legacy_rules_for(scenario_id: str) -> Rules:
    return LEGACY_RULESETS[scenario_id]


def rules_for(scenario_id: str, version: str | None = None) -> Rules:
    if version is None:
        return RULESETS[scenario_id]
    expected = "mars-" if scenario_id == MARS else "lunar-"
    if not version.startswith(expected) or version not in VERSIONED_RULESETS:
        raise ValueError("La versión de reglas no corresponde al escenario.")
    return VERSIONED_RULESETS[version]


def rules_for_state(state) -> Rules:
    rules = rules_for(state.scenario_id, state.rules_version)
    if state.rules_version.endswith("1.0.0") or state.practice_mode != "training":
        return rules
    rng = random.Random(f"{state.scenario_id}:{state.seed}:incidents-v1")
    if state.scenario_id == MARS:
        first = rng.choice((5, 6, 7))
        return replace(rules, dust_storm_turns=tuple(range(first, first + 4)))
    return replace(rules, water_leak_turn=rng.choice((2, 3)), panel_damage_turn=rng.choice((7, 8, 9)))


_UNITS = {"energy": "kWh", "oxygen": "kg", "water": "L", "food": "kg", "power": "kW", "risk": "simulation_points"}


def _original_catalog(scenario_id: str = LUNAR) -> dict:
    if scenario_id == MARS:
        return _mars_catalog()
    return {
        "id": "lunar-outpost-v1", "title": "Órbita: primer turno lunar",
        "description": "Mantén una base de cuatro tripulantes durante una práctica de 24 horas.",
        "rules_version": RULES.version, "duration_hours": 24, "turn_hours": 2,
        "difficulties": ["cadet", "commander"], "science_target": RULES.science_target,
        "objectives": ["Completar 12 turnos", "Salud final de al menos 60", "Conseguir 24 puntos científicos"],
        "tutorial": [
            "Consulta recursos, alertas y acciones disponibles.",
            "Realiza hasta dos acciones y avanza dos horas para calcular producción y consumo.",
            "Repara las fugas y los paneles dañados; planifica cuándo explorar y cuándo refugiarte.",
            "Consulta /science para distinguir referencias NASA de reglas del simulador.",
        ],
        "assumptions": [
            "Segmento de 24 horas con iluminación disponible; no se modela un ciclo lunar completo.",
            "La cosecha del invernadero representa un cultivo ya establecido, no crecimiento instantáneo.",
            "El índice de exposición usa puntos didácticos; no Gy, Sv ni riesgo clínico.",
            "Los incidentes se programan en tiempo de simulación y no son predicciones en vivo.",
            "Las tres fuentes científicas tienen fechas y entornos distintos; no son mediciones simultáneas de esta base.",
        ],
        "parameters": asdict(RULES),
        "units": _UNITS,
    }


def _mars_catalog() -> dict:
    return {
        "id": MARS, "title": "Órbita: un sol en Marte",
        "description": "Mantén una base de cuatro tripulantes en Marte durante el 20 de mayo de 2024, "
                       "el día en que el rover Curiosity midió la mayor tormenta de radiación solar en la superficie marciana.",
        "rules_version": MARS_RULES.version, "duration_hours": 24, "turn_hours": 2,
        "difficulties": ["cadet", "commander"], "science_target": MARS_RULES.science_target,
        "objectives": ["Completar 12 turnos", "Salud final de al menos 60", "Conseguir 30 puntos científicos"],
        "tutorial": [
            "En Marte la luz solar llega con el 43 % de la fuerza que tiene cerca de la Tierra: cuida la batería.",
            "El generador obtiene oxígeno del aire marciano y no gasta agua, pero consume más energía.",
            "Refúgiate cuando suba la radiación y apaga sistemas secundarios durante la tormenta de polvo.",
            "Informa a la Tierra: la respuesta llega en el turno siguiente y aporta puntos científicos.",
        ],
        "assumptions": [
            "El índice de exposición de cada turno sigue la forma de las mediciones reales de MSL-RAD del 20 de mayo de 2024, "
            "convertidas a puntos didácticos; no es una dosis para personas ni tiene en cuenta el blindaje de una base.",
            "El aviso solar se adelanta un turno respecto a la eyección de masa coronal real (05:36 UTC) para permitir prepararse.",
            "La tormenta de polvo es un incidente del simulador inspirado en tormentas reales; ese día no hubo una en el cráter Gale.",
            "Se modelan 24 horas con iluminación disponible; un sol marciano dura 24 h 39 min y tiene noche.",
            "El generador de oxígeno representa una versión ampliada de MOXIE; sus consumos son didácticos.",
            "El índice de exposición usa puntos didácticos; no Gy, Sv ni riesgo clínico.",
        ],
        "facts": {
            "solar_irradiance_vs_earth_pct": 43, "gravity_vs_earth_pct": 38, "atmosphere_co2_pct": 95,
            "sol_duration": "24 h 39 min 35 s", "radio_delay_minutes_one_way": [5, 20],
            "cme_start_utc": "2024-05-20T05:36Z", "rad_baseline_ugy_h": MARS_RAD_PROFILE_UGY_H[0],
            "rad_peak_block_ugy_h": max(MARS_RAD_PROFILE_UGY_H),
        },
        "parameters": asdict(MARS_RULES),
        "units": _UNITS | {"dose_rate": "uGy/h"},
    }


def scenario_catalog(scenario_id: str = LUNAR) -> dict:
    catalog = _original_catalog(scenario_id)
    current = rules_for(scenario_id)
    catalog.update(rules_version=current.version, parameters=asdict(current))
    catalog["objectives"] += ["Conservar alimento para la siguiente jornada (0.8 kg en cadete; 0.6 kg en comandante)"]
    catalog["practice_modes"] = ["historical", "training"]
    catalog["assumptions"] += [
        "La reserva alimentaria final es un objetivo didáctico; no una recomendación nutricional.",
        "Entrenamiento varía sólo incidentes simulados con la semilla; conserva la secuencia real de mediciones NASA.",
        "La pérdida eléctrica lunar representa un modo de protección simulado, no una nube que tape el Sol.",
    ]
    if scenario_id == MARS:
        catalog["facts"]["radio_delay_minutes_one_way"] = [3, 22]
        catalog["facts"]["training_radio_delay_minutes_one_way"] = current.radio_delay_minutes_one_way
        catalog["objectives"] += ["Compartir datos nuevos de al menos una exploración con la Tierra"]
        catalog["assumptions"] += [
            "Se eligen 20 minutos por sentido para practicar el retraso, dentro del rango de referencia de 3–22; no es una efeméride del 20 de mayo.",
            "Los 40 minutos de ida y vuelta se resuelven al avanzar dos horas; la tripulación debe actuar antes si hay peligro.",
        ]
        catalog["tutorial"][-1] = "Envía datos nuevos a la Tierra: cada lote sólo puede acreditarse una vez. Una consulta sin datos aporta consejo, no ciencia."
    return catalog
