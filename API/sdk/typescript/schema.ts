// Generado por scripts/export_contracts.py. No editar a mano.

export type ActionOption = {
  "id": "repair_water_loop" | "repair_solar_panels" | "enter_shelter" | "leave_shelter" | "explore" | "activate_oxygen_reserve" | "activate_water_reserve" | "toggle_greenhouse" | "toggle_oxygen_generator" | "contact_earth";
  "title": string;
  "description": string;
  "enabled": boolean;
  "disabled_reason": (string | null);
  "costs": Record<string, number>;
};

export type Command = {
  "type": "action" | "advance" | "pause" | "resume" | "abort";
  "expected_version": number;
  "action_id"?: ("repair_water_loop" | "repair_solar_panels" | "enter_shelter" | "leave_shelter" | "explore" | "activate_oxygen_reserve" | "activate_water_reserve" | "toggle_greenhouse" | "toggle_oxygen_generator" | "contact_earth" | null);
};

export type CreateMission = {
  "scenario_id"?: "lunar-outpost-v1" | "mars-outpost-v1";
  "difficulty"?: "cadet" | "commander";
  "seed"?: number;
  "data_mode"?: "snapshot" | "live";
  "practice_mode"?: "historical" | "training";
};

export type DecisionDifference = {
  "turn": number;
  "previous": Array<"repair_water_loop" | "repair_solar_panels" | "enter_shelter" | "leave_shelter" | "explore" | "activate_oxygen_reserve" | "activate_water_reserve" | "toggle_greenhouse" | "toggle_oxygen_generator" | "contact_earth">;
  "current": Array<"repair_water_loop" | "repair_solar_panels" | "enter_shelter" | "leave_shelter" | "explore" | "activate_oxygen_reserve" | "activate_water_reserve" | "toggle_greenhouse" | "toggle_oxygen_generator" | "contact_earth">;
};

export type EarthGuidance = {
  "received_turn": number;
  "valid_until_turn": number;
  "advice_code": "shelter_now" | "save_power" | "clean_panels" | "research_window";
  "next_turn_dose_rate_ugy_h": (number | null);
  "suggested_eva_turn": (number | null);
  "dust_start_turn": (number | null);
  "dust_end_turn": (number | null);
};

export type ErrorDetail = {
  "field": string;
  "message": string;
  "type": string;
};

export type ErrorInfo = {
  "code": string;
  "message": string;
  "request_id": string;
  "details"?: (Array<ErrorDetail> | null);
};

export type ErrorResponse = {
  "error": ErrorInfo;
};

export type Evaluation = {
  "mission_id": string;
  "final": boolean;
  "outcome": "in_progress" | "success" | "partial" | "failed" | "aborted";
  "score": number;
  "objectives": Record<string, boolean>;
  "feedback": Array<string>;
  "feedback_codes": Array<string>;
  "comparison": (MissionComparison | null);
  "rules_version": string;
};

export type EventList = {
  "data": Array<StoredEvent>;
  "total": number;
  "limit": number;
  "offset": number;
};

export type ForecastComparison = {
  "horizon_hours": number;
  "without_action": MutationResult;
  "with_action": MutationResult;
};

export type MissionComparison = {
  "previous_mission_id": string;
  "previous_turns": number;
  "current_turns": number;
  "score_delta": number;
  "health_delta": number;
  "exposure_delta": number;
  "food_delta_kg": number;
  "energy_delta_kwh": number;
  "decisions": Array<DecisionDifference>;
};

export type MissionList = {
  "data": Array<MissionSummary>;
  "total": number;
  "limit": number;
  "offset": number;
};

export type MissionState = {
  "id": string;
  "scenario_id": "lunar-outpost-v1" | "mars-outpost-v1";
  "rules_version": "lunar-1.0.0" | "mars-1.0.0" | "lunar-1.1.0" | "mars-1.1.0" | "lunar-1.2.0" | "mars-1.2.0";
  "version": number;
  "status": "active" | "paused" | "completed" | "failed" | "aborted";
  "difficulty": "cadet" | "commander";
  "seed": number;
  "turn": number;
  "elapsed_hours": number;
  "duration_hours": number;
  "turn_hours": number;
  "actions_used": number;
  "crew_count": number;
  "crew_health_pct": number;
  "exposure_risk_index": number;
  "science_points": number;
  "unreported_data_points": number;
  "reported_data_points": number;
  "practice_mode": "historical" | "training";
  "radiation_profile_ugy_h": Array<number>;
  "radiation_profile_source_hash": (string | null);
  "earth_guidance": (EarthGuidance | null);
  "resources": Resources;
  "systems": Systems;
  "created_at": string;
  "updated_at": string;
  "parent_mission_id": (string | null);
  "end_reason": (string | null);
  "science_bundle_id": string;
};

export type MissionSummary = {
  "id": string;
  "scenario_id": string;
  "status": "active" | "paused" | "completed" | "failed" | "aborted";
  "version": number;
  "turn": number;
  "updated_at": string;
};

export type MissionView = {
  "state": MissionState;
  "available_actions": Array<ActionOption>;
  "alerts": Array<string>;
  "planning": (PlanningIndicators | null);
};

export type MutationResult = {
  "mission": MissionView;
  "events": Array<TimelineEvent>;
};

export type PlanningIndicators = {
  "food_autonomy_hours": number;
  "food_reserve_target_kg": number;
  "pending_reply_minutes": (number | null);
  "radio_round_trip_minutes": number;
  "shelter_recommended": boolean;
  "exposure_target_points": (number | null);
};

export type Preview = {
  "action_id": "repair_water_loop" | "repair_solar_panels" | "enter_shelter" | "leave_shelter" | "explore" | "activate_oxygen_reserve" | "activate_water_reserve" | "toggle_greenhouse" | "toggle_oxygen_generator" | "contact_earth";
  "expected_version": number;
};

export type PreviewResult = {
  "persisted": false;
  "based_on_version": number;
  "result": MutationResult;
  "forecast": (ForecastComparison | null);
};

export type Resources = {
  "energy_kwh": number;
  "oxygen_kg": number;
  "water_l": number;
  "food_kg": number;
  "spare_parts": number;
  "reserve_oxygen_kg": number;
  "reserve_water_l": number;
};

export type RestartMission = {
  "expected_version": number;
};

export type ScienceBundle = {
  "id": string;
  "requested_mode": "snapshot" | "live";
  "captured_at": string;
  "historical_replay": true;
  "sources": Array<SourceItem>;
  "model_derivations": Record<string, unknown>;
  "notice": string;
};

export type SessionCreated = {
  "session_id": string;
  "created_at": string;
  "expires_at": string;
  "access_token": string;
  "token_type": "Bearer";
};

export type SessionInfo = {
  "session_id": string;
  "created_at": string;
  "expires_at": string;
};

export type SourceItem = {
  "id": string;
  "role": string;
  "interpretation": string;
  "records": Array<Record<string, unknown>>;
  "pages_meta": Array<Record<string, unknown>>;
};

export type StoredEvent = {
  "sequence": number;
  "mission_version": number;
  "event": TimelineEvent;
};

export type Systems = {
  "solar_integrity_pct": number;
  "oxygen_generator_on": boolean;
  "greenhouse_on": boolean;
  "water_leak_active": boolean;
  "crew_in_shelter": boolean;
  "dust_storm_active": boolean;
  "earth_message_pending": boolean;
  "earth_message_data_points": number;
  "earth_reply_due_minutes": (number | null);
};

export type TimelineEvent = {
  "type": string;
  "turn": number;
  "message": string;
  "occurred_at": string;
  "payload": Record<string, unknown>;
  "source_refs": Array<string>;
  "rule_origin": "simulation";
};
