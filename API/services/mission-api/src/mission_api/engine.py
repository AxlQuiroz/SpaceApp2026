"""Motor determinista: sin red, base de datos ni dependencia de FastAPI."""
import random
from datetime import datetime

from .errors import MissionError
from .models import (ActionOption, Command, CreateMission, Evaluation, MissionState, MissionView,
                     MutationResult, Resources, TimelineEvent)
from .rules import MARS, TERMINAL, rules_for

# El mismo catálogo alimenta validación, documentación y controles del frontend.
ACTIONS = {
    "repair_water_loop": ("Reparar fuga", "Detén la pérdida de agua del circuito.", {"spare_parts": 2, "energy_kwh": 2}),
    "repair_solar_panels": ("Reparar paneles", "Restaura 50 puntos de integridad de los paneles.", {"spare_parts": 2, "energy_kwh": 3}),
    "enter_shelter": ("Entrar al refugio", "Reduce el índice de exposición y suspende actividades exteriores.", {}),
    "leave_shelter": ("Salir del refugio", "Permite explorar y reparar paneles en el exterior.", {}),
    "explore": ("Explorar", "Obtén 12 puntos científicos usando suministros de la base.", {"energy_kwh": 2, "oxygen_kg": 0.12, "water_l": 0.5, "food_kg": 0.1}),
    "activate_oxygen_reserve": ("Abrir reserva de oxígeno", "Transfiere hasta 0.6 kg de la reserva finita al depósito principal.", {}),
    "activate_water_reserve": ("Abrir reserva de agua", "Transfiere hasta 3 L de la reserva finita al depósito principal.", {}),
    "toggle_greenhouse": ("Cambiar estado del invernadero", "Activa o pausa su producción y su consumo eléctrico.", {}),
    "toggle_oxygen_generator": ("Cambiar estado del generador de oxígeno", "Activa o pausa la generación de oxígeno y su consumo de agua y energía.", {}),
}

# Marte: no hay circuito con fuga; limpiar el polvo no gasta repuestos; el generador usa el CO2 del aire.
MARS_ACTIONS = {key: value for key, value in ACTIONS.items() if key != "repair_water_loop"} | {
    "repair_solar_panels": ("Limpiar paneles", "Retira el polvo marciano con cepillos y recupera 50 puntos de integridad.", {}),
    "toggle_oxygen_generator": ("Cambiar estado del generador de oxígeno", "Activa o pausa la obtención de oxígeno a partir del CO2 del aire marciano.", {}),
    "contact_earth": ("Informar a la Tierra", "Envía tus datos por radio. La respuesta tarda y llega en el turno siguiente con 6 puntos científicos.", {"energy_kwh": 1}),
}


def actions_for(scenario_id: str) -> dict:
    return MARS_ACTIONS if scenario_id == MARS else ACTIONS


def new_mission(mission_id: str, config: CreateMission, bundle_id: str, now: datetime,
                parent_id: str | None = None) -> MissionState:
    factor = 1 if config.difficulty == "cadet" else 0.75
    return MissionState(id=mission_id, scenario_id=config.scenario_id, rules_version=rules_for(config.scenario_id).version,
        difficulty=config.difficulty, seed=config.seed,
        resources=Resources(energy_kwh=32 * factor, oxygen_kg=2.8 * factor,
                            water_l=18 * factor, food_kg=3.2 * factor, spare_parts=6),
        created_at=now, updated_at=now, science_bundle_id=bundle_id, parent_mission_id=parent_id)


def _reason(s: MissionState, action: str) -> str | None:
    R, actions = rules_for(s.scenario_id), actions_for(s.scenario_id)
    if action not in actions:
        return "Esta acción no existe en esta misión."
    if s.status != "active":
        return "La misión debe estar activa."
    if s.actions_used >= R.actions_per_turn:
        return "Ya utilizaste las dos acciones de este turno; avanza el tiempo."
    sy, r = s.systems, s.resources
    if action == "repair_water_loop" and not sy.water_leak_active:
        return "No hay una fuga activa."
    if action == "repair_solar_panels" and sy.solar_integrity_pct >= 100:
        return "Los paneles ya están reparados."
    if action in {"explore", "repair_solar_panels"} and sy.crew_in_shelter:
        return "La tripulación está en el refugio."
    if action == "enter_shelter" and sy.crew_in_shelter:
        return "La tripulación ya está en el refugio."
    if action == "leave_shelter" and not sy.crew_in_shelter:
        return "La tripulación ya está fuera del refugio."
    if action == "activate_oxygen_reserve" and (r.reserve_oxygen_kg <= 0 or r.oxygen_kg >= R.oxygen_capacity_kg):
        return "La reserva está vacía o el depósito de oxígeno está lleno."
    if action == "activate_water_reserve" and (r.reserve_water_l <= 0 or r.water_l >= R.water_capacity_l):
        return "La reserva está vacía o el depósito de agua está lleno."
    if action == "contact_earth" and sy.earth_message_pending:
        return "Ya enviaste un informe; espera la respuesta de la Tierra."
    for resource, amount in actions[action][2].items():
        if getattr(r, resource) < amount:
            return f"Recurso insuficiente: {resource}."
    return None


def action_options(s: MissionState) -> list[ActionOption]:
    return [ActionOption(id=key, title=value[0], description=value[1], enabled=_reason(s, key) is None,
                         disabled_reason=_reason(s, key), costs=value[2]) for key, value in actions_for(s.scenario_id).items()]


def view(s: MissionState) -> MissionView:
    mars = s.scenario_id == MARS
    alerts = []
    if s.systems.water_leak_active:
        alerts.append("Fuga activa: el agua se pierde cada turno hasta repararla.")
    if s.systems.solar_integrity_pct < 100:
        alerts.append("Paneles con polvo: la producción eléctrica está reducida." if mars
                      else "Paneles dañados: la producción eléctrica está reducida.")
    if s.systems.dust_storm_active:
        alerts.append("Tormenta de polvo: llega muy poca luz a los paneles.")
    if mars and s.turn == 2:
        alerts.append("El próximo avance trae la radiación de una eyección solar real: considera entrar al refugio.")
    if mars and s.turn == rules_for(s.scenario_id).dust_storm_turns[0] - 1:
        alerts.append("Se acerca una tormenta de polvo: ahorra batería antes del próximo avance.")
    if not mars and s.turn == 5:
        alerts.append("El próximo avance incluye un incidente solar simulado: considera entrar al refugio.")
    for field, threshold, message in [
        ("oxygen_kg", 0.8, "Reserva principal de oxígeno baja."),
        ("water_l", 4, "Reserva principal de agua baja."),
        ("food_kg", 0.8, "Alimentos bajos."),
        ("energy_kwh", 8, "Batería baja."),
    ]:
        if getattr(s.resources, field) < threshold:
            alerts.append(message)
    return MissionView(state=s, available_actions=action_options(s), alerts=alerts)


def transition(original: MissionState, command: Command, now: datetime) -> MutationResult:
    if command.expected_version != original.version:
        raise MissionError("VERSION_CONFLICT", "La partida cambió. Consulta su estado y vuelve a evaluar la decisión.")
    if original.status in TERMINAL:
        raise MissionError("MISSION_FINISHED", "La misión terminó; puedes iniciar otra mediante restart.")
    s = original.model_copy(deep=True)
    R, actions, mars = rules_for(s.scenario_id), actions_for(s.scenario_id), s.scenario_id == MARS
    events: list[TimelineEvent] = []

    def emit(kind, message, payload=None, refs=None):
        events.append(TimelineEvent(type=kind, turn=s.turn, message=message, occurred_at=now,
                                    payload=payload or {}, source_refs=refs or []))

    if command.type == "pause":
        if s.status != "active":
            raise MissionError("INVALID_STATE", "La misión ya está pausada.")
        s.status = "paused"
        emit("mission_paused", "Misión pausada; el tiempo sólo avanza mediante una orden explícita.")
    elif command.type == "resume":
        if s.status != "paused":
            raise MissionError("INVALID_STATE", "Sólo se puede reanudar una misión pausada.")
        s.status = "active"
        emit("mission_resumed", "Misión reanudada.")
    elif command.type == "abort":
        s.status, s.end_reason = "aborted", "Misión finalizada por el jugador."
        emit("mission_aborted", s.end_reason)
    elif s.status != "active":
        raise MissionError("MISSION_PAUSED", "Reanuda la misión antes de actuar o avanzar.")
    elif command.type == "action":
        action = command.action_id
        reason = _reason(s, action)
        if reason:
            raise MissionError("ACTION_UNAVAILABLE", reason)
        before = s.resources.model_dump()
        for field, amount in actions[action][2].items():
            setattr(s.resources, field, getattr(s.resources, field) - amount)
        sy, r = s.systems, s.resources
        if action == "repair_water_loop":
            sy.water_leak_active = False
        elif action == "repair_solar_panels":
            sy.solar_integrity_pct = min(100, sy.solar_integrity_pct + 50)
        elif action == "enter_shelter":
            sy.crew_in_shelter = True
        elif action == "leave_shelter":
            sy.crew_in_shelter = False
        elif action == "explore":
            s.science_points += 12
            s.exposure_risk_index = min(100, s.exposure_risk_index + 1)
        elif action == "activate_oxygen_reserve":
            amount = min(0.6, r.reserve_oxygen_kg, R.oxygen_capacity_kg - r.oxygen_kg)
            r.oxygen_kg += amount
            r.reserve_oxygen_kg -= amount
        elif action == "activate_water_reserve":
            amount = min(3, r.reserve_water_l, R.water_capacity_l - r.water_l)
            r.water_l += amount
            r.reserve_water_l -= amount
        elif action == "toggle_greenhouse":
            sy.greenhouse_on = not sy.greenhouse_on
        elif action == "toggle_oxygen_generator":
            sy.oxygen_generator_on = not sy.oxygen_generator_on
        elif action == "contact_earth":
            sy.earth_message_pending = True
        s.actions_used += 1
        _round_resources(s)
        emit("action_applied", actions[action][0], {"action_id": action, "resource_delta": _delta(before, s.resources.model_dump())})
    elif command.type == "advance":
        s.turn += 1
        s.elapsed_hours = s.turn * R.turn_hours
        s.actions_used = 0
        r, sy = s.resources, s.systems
        before = r.model_dump()
        dose_rate = None
        if mars:
            storm, dose_rate = False, R.radiation_profile_ugy_h[s.turn - 1]
            if sy.earth_message_pending:
                sy.earth_message_pending = False
                s.science_points += R.earth_reply_science
                emit("earth_reply", "La Tierra recibió tu informe y respondió: la señal de radio tarda entre 5 y 20 minutos en cada sentido.",
                     {"science_points": R.earth_reply_science, "radio_delay_minutes_one_way": [5, 20]})
            if s.turn == 2:
                emit("solar_warning", "Aviso de clima espacial: una eyección de masa coronal real (20 de mayo de 2024, 05:36 UTC) se dirige a Marte.",
                     {"cme_start_utc": "2024-05-20T05:36Z"}, ["donki-episode"])
            if s.turn == 3:
                emit("solar_incident", "Llegó la radiación de la tormenta solar: MSL-RAD registró este aumento en la superficie de Marte.",
                     {"sheltered": sy.crew_in_shelter, "risk_unit": "simulation_points", "dose_rate_ugy_h": dose_rate},
                     ["donki-episode", "radlab-reference"])
            if s.turn == R.dust_storm_turns[0] - 1:
                emit("dust_warning", "Se acerca una tormenta de polvo: los paneles recibirán muy poca luz durante varios turnos.")
            if s.turn == R.dust_storm_turns[0]:
                sy.dust_storm_active = True
                emit("dust_storm", "Incidente simulado: una tormenta de polvo oscurece el cielo y reduce la energía solar.",
                     {"generation_factor": R.dust_generation_factor})
            if s.turn == R.dust_storm_turns[-1] + 1:
                sy.dust_storm_active = False
                sy.solar_integrity_pct = max(0, sy.solar_integrity_pct - R.dust_deposit_pct)
                emit("dust_cleared", "La tormenta de polvo terminó, pero dejó los paneles cubiertos: límpialos para recuperar energía.",
                     {"deposit_pct": R.dust_deposit_pct})
            sky = R.dust_generation_factor if sy.dust_storm_active else 1
        else:
            if s.turn == 2:
                sy.water_leak_active = True
                emit("water_leak", "Incidente simulado: se detectó una fuga en el circuito de agua.")
            if s.turn == 5:
                emit("solar_warning", "Ejercicio de clima espacial: prepara el refugio para el siguiente turno.", refs=["donki-episode"])
            if s.turn == 8:
                sy.solar_integrity_pct = max(0, sy.solar_integrity_pct - 50)
                emit("panel_damage", "Incidente simulado: el polvo redujo la integridad de los paneles en 50 puntos.")
            storm = s.turn == 6
            sky = 0.3 if storm else 1

        # Se asigna la electricidad por prioridad. No se produce oxígeno sin energía o sin agua.
        generation = R.solar_kw * R.solar_irradiance_factor * R.turn_hours * sy.solar_integrity_pct / 100 * sky
        available = r.energy_kwh + generation
        supplied = {}
        for name, kw, enabled in [
            ("habitat", R.habitat_kw, True), ("oxygen", R.oxygen_generator_kw, sy.oxygen_generator_on),
            ("water", R.water_loop_kw, True), ("greenhouse", R.greenhouse_kw, sy.greenhouse_on),
        ]:
            demand = kw * R.turn_hours if enabled else 0
            allocated = min(available, demand)
            available -= allocated
            supplied[name] = allocated / demand if demand else 0
        curtailed = max(0, available - R.energy_capacity_kwh)
        r.energy_kwh = min(R.energy_capacity_kwh, available)
        r.water_l += R.water_recovered_l_per_hour * R.turn_hours * supplied["water"]
        water_needed = R.water_used_by_generator_l_per_hour * R.turn_hours
        generator_fraction = min(supplied["oxygen"], r.water_l / water_needed) if water_needed else supplied["oxygen"]
        r.water_l -= R.water_used_by_generator_l_per_hour * R.turn_hours * generator_fraction
        r.oxygen_kg += R.oxygen_produced_kg_per_hour * R.turn_hours * generator_fraction
        r.food_kg += R.food_produced_kg_per_hour * R.turn_hours * supplied["greenhouse"]
        r.oxygen_kg = min(R.oxygen_capacity_kg, max(0, r.oxygen_kg - s.crew_count * R.crew_oxygen_kg_per_person_hour * R.turn_hours))
        r.water_l = min(R.water_capacity_l, max(0, r.water_l - s.crew_count * R.crew_water_l_per_person_hour * R.turn_hours
                                             - (R.leak_l_per_hour * R.turn_hours if sy.water_leak_active else 0)))
        r.food_kg = min(R.food_capacity_kg, max(0, r.food_kg - s.crew_count * R.crew_food_kg_per_person_hour * R.turn_hours))
        risk = R.background_risk_per_turn
        if dose_rate is not None:
            # Marte: la forma de la exposición sigue la medición real del turno, en puntos didácticos.
            risk += dose_rate * R.exposure_points_per_ugy_h
        if storm:
            risk += random.Random(f"{R.version}:{s.seed}:storm").uniform(24, 32)
            emit("solar_incident", "Incidente solar didáctico: el refugio reduce el índice de exposición.",
                 {"sheltered": sy.crew_in_shelter, "risk_unit": "simulation_points"}, ["donki-episode", "radlab-reference"])
        risk *= R.shelter_risk_factor if sy.crew_in_shelter else 1
        s.exposure_risk_index = min(100, s.exposure_risk_index + risk)
        health_loss = 35 * (1 - supplied["habitat"])
        health_loss += 40 if r.oxygen_kg <= 0 else 0
        health_loss += 25 if r.water_l <= 0 else 0
        health_loss += 10 if r.food_kg <= 0 else 0
        health_loss += max(0, s.exposure_risk_index - 60) / 10
        s.crew_health_pct = round(max(0, s.crew_health_pct - health_loss), 4)
        s.exposure_risk_index = round(s.exposure_risk_index, 4)
        _round_resources(s)
        payload = {
            "resource_delta": _delta(before, r.model_dump()), "generated_kwh": round(generation, 4),
            "curtailed_kwh": round(curtailed, 4), "power_fractions": supplied,
            "risk_delta_points": round(risk, 4), "health_loss_points": round(health_loss, 4),
        }
        if dose_rate is not None:
            payload |= {"dose_rate_ugy_h": dose_rate, "dose_rate_source": "radlab-reference", "sky_factor": sky}
        emit("turn_advanced", "Se calcularon dos horas de producción y consumo.", payload)
        if s.crew_health_pct <= 0:
            s.status, s.end_reason = "failed", "La salud de la tripulación llegó a cero en el modelo didáctico."
            emit("mission_failed", s.end_reason)
        elif s.turn >= R.turns:
            s.status, s.end_reason = "completed", "Se completó el periodo de entrenamiento de 24 horas."
            emit("mission_completed", s.end_reason)
    s.version += 1
    s.updated_at = now
    # Revalidar invariantes después de todos los cambios, incluso en llamadas directas al motor.
    s = MissionState.model_validate(s.model_dump())
    return MutationResult(mission=view(s), events=events)


def _round_resources(s):
    for field in s.resources.__class__.model_fields:
        value = getattr(s.resources, field)
        if isinstance(value, float):
            setattr(s.resources, field, round(max(0, value), 6))


def _delta(before, after):
    return {key: round(after[key] - before[key], 6) for key in before}


def evaluate(s: MissionState) -> Evaluation:
    R, mars = rules_for(s.scenario_id), s.scenario_id == MARS
    objectives = {"completed_duration": s.turn >= R.turns, "healthy_crew": s.crew_health_pct >= 60,
                  "science_target": s.science_points >= R.science_target}
    score = round(40 * s.turn / R.turns + 30 * s.crew_health_pct / 100
                  + 20 * min(1, s.science_points / R.science_target) + 10 * (1 - s.exposure_risk_index / 100))
    outcome = "in_progress"
    if s.status == "completed":
        outcome = "success" if all(objectives.values()) else "partial"
    elif s.status in {"failed", "aborted"}:
        outcome = s.status
    feedback = []
    if s.systems.water_leak_active:
        feedback.append("Reparar pronto una fuga conserva agua para los turnos siguientes.")
    if s.exposure_risk_index > 20:
        feedback.append("Planificar el refugio antes del incidente reduce el índice de exposición simulado.")
    if not objectives["science_target"]:
        feedback.append("Dos exploraciones y un informe a la Tierra alcanzan el objetivo científico." if mars
                        else "Dos exploraciones alcanzan el objetivo científico; cada una consume suministros.")
    if s.resources.energy_kwh < 8:
        feedback.append("Limpia los paneles o pausa sistemas secundarios durante la tormenta de polvo." if mars
                        else "Repara los paneles o pausa sistemas secundarios para proteger el soporte vital.")
    if outcome == "success":
        feedback.append("Completaste la misión y sus objetivos de salud y exploración.")
    return Evaluation(mission_id=s.id, final=s.status in TERMINAL, outcome=outcome,
                      score=max(0, min(100, score)), objectives=objectives, feedback=feedback, rules_version=s.rules_version)
