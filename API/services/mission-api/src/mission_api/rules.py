"""Parámetros didácticos versionados; no son coeficientes certificados por NASA."""
from dataclasses import asdict, dataclass


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


RULES = Rules()
TERMINAL = {"completed", "failed", "aborted"}


def scenario_catalog() -> dict:
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
        "units": {"energy": "kWh", "oxygen": "kg", "water": "L", "food": "kg", "power": "kW", "risk": "simulation_points"},
    }
