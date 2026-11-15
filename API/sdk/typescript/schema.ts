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
  "rules_version": string;
};

export type EventList = {
  "data": Array<StoredEvent>;
  "total": number;
  "limit": number;
  "offset": number;
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
  "rules_version": "lunar-1.0.0" | "mars-1.0.0";
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
};

export type MutationResult = {
  "mission": MissionView;
  "events": Array<TimelineEvent>;
};

export type Preview = {
  "action_id": "repair_water_loop" | "repair_solar_panels" | "enter_shelter" | "leave_shelter" | "explore" | "activate_oxygen_reserve" | "activate_water_reserve" | "toggle_greenhouse" | "toggle_oxygen_generator" | "contact_earth";
  "expected_version": number;
};

export type PreviewResult = {
  "persisted": false;
  "based_on_version": number;
  "result": MutationResult;
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
