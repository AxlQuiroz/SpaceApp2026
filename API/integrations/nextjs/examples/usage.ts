/** Funciones para incorporar a la gestión de estado del frontend externo. */
import { MissionApiClient } from "../../../sdk/typescript/client";
import type { ActionOption, MissionView } from "../../../sdk/typescript/schema";

export async function startMission(api = new MissionApiClient()): Promise<MissionView> {
  await api.createSession();
  const result = await api.createMission({ data_mode: "snapshot", difficulty: "cadet", seed: 42 });
  return result.mission;
}

export async function advance(api: MissionApiClient, mission: MissionView, key: string): Promise<MissionView> {
  return (await api.command(mission.state.id, { type: "advance", expected_version: mission.state.version }, key)).mission;
}

export async function act(api: MissionApiClient, mission: MissionView, action: ActionOption, key: string): Promise<MissionView> {
  return (await api.command(mission.state.id, { type: "action", action_id: action.id, expected_version: mission.state.version }, key)).mission;
}
