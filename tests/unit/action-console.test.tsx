import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ActionConsole, type FlightCommand } from "@/game/ActionConsole";
import { actionAvailability, decisionGuidance } from "@/game/actionPresentation";
import { Coach } from "@/game/LearningCards";
import { MockMissionClient } from "@/lib/orbita/mock";
import { Providers } from "@/lib/providers";
import { SettingsBar } from "@/components/hud/SettingsBar";
import { MissionPlan } from "@/game/MissionPlan";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); localStorage.clear(); });

function choices() {
  return [
    { id: "explore", icon: "explore", label: "Explorar", hint: "Recoge datos científicos", costs: "−2.0 kWh", group: "research", locked: false, reason: null, onActivate: vi.fn() },
    { id: "repair_water_loop", icon: "repairWater", label: "Reparar agua", hint: "Repara el circuito", costs: "−1 repuesto", group: "systems", locked: true, reason: "El circuito está bien: no hay fuga.", onActivate: vi.fn() },
  ] satisfies FlightCommand[];
}

it("presenta nombre, propósito, coste y motivo de bloqueo sin hover", () => {
  const commands = choices();
  render(<Providers><ActionConsole commands={commands} actionsLeft={2} maxActions={2} guidance="Compara antes de elegir" /></Providers>);
  expect(screen.getByRole("heading", {name:"Ciencia y comunicación"})).toBeTruthy();
  expect(screen.getByText(/−2.0 kWh/)).toBeTruthy();
  fireEvent.click(screen.getByRole("tab",{name:"Sistemas"}));
  expect(screen.getByText(/El circuito está bien: no hay fuga/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", {name:"Reparar agua"}));
  expect(commands[1].onActivate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("tab",{name:"Investigar"}));
  fireEvent.click(screen.getByRole("button", {name:"Explorar"}));
  expect(commands[0].onActivate).toHaveBeenCalledOnce();
});

it("los atajos no repiten órdenes ni se ejecutan al escribir", () => {
  const commands=choices();
  render(<Providers><input aria-label="Nombre" /><ActionConsole hotkeys commands={commands} actionsLeft={2} maxActions={2} guidance="Compara" /></Providers>);
  fireEvent.keyDown(window, {key:"q", repeat:true});
  fireEvent.keyDown(screen.getByRole("textbox"), {key:"q"});
  fireEvent.keyDown(window, {key:"w"});
  expect(commands[0].onActivate).not.toHaveBeenCalled();
  fireEvent.keyDown(window, {key:"q"});
  expect(commands[0].onActivate).toHaveBeenCalledOnce();
});

it("no ofrece el control de refugio oculto mediante un atajo", () => {
  const commands=choices();
  const hidden={...commands[0],hidden:true};
  render(<Providers><ActionConsole hotkeys commands={[hidden]} actionsLeft={2} maxActions={2} guidance="Compara" /></Providers>);
  fireEvent.keyDown(window,{key:"q"});
  expect(hidden.onActivate).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:"Explorar"})).toBeNull();
});

it("explica los bloqueos en inglés aunque el backend escriba en español", async () => {
  const {mission}=await new MockMissionClient().createMission({});
  expect(actionAvailability(mission,"repair_water_loop","en")).toBe("The water loop is working: no leak.");
  mission.state.systems.crew_in_shelter=true;
  mission.available_actions.find(a=>a.id==="explore")!.enabled=false;
  expect(actionAvailability(mission,"explore","en")).toContain("Leave the shelter");
});

it("con oxígeno bajo no recomienda apagar una máquina que ya produce oxígeno", async () => {
  const {mission}=await new MockMissionClient().createMission({});
  mission.state.resources.oxygen_kg=0.4; mission.state.resources.reserve_oxygen_kg=0;
  mission.state.systems.oxygen_generator_on=true;
  expect(decisionGuidance(mission,"es",false).action).toBeNull();
  mission.state.systems.oxygen_generator_on=false;
  expect(decisionGuidance(mission,"es",false).action).toBe("toggle_oxygen_generator");
});

it("orienta ante un aviso confirmado sin adelantar un refugio cuando todo está tranquilo", async () => {
  const {mission}=await new MockMissionClient().createMission({});
  expect(decisionGuidance(mission,"es",false).action).toBeNull();
  expect(decisionGuidance(mission,"es",true).action).toBe("enter_shelter");
  mission.state.systems.crew_in_shelter=true;
  expect(decisionGuidance(mission,"es",true).action).toBeNull();
});

it("el paso práctico del tutorial deja el foco en los controles del juego", () => {
  render(<Providers><button data-tour="base">Hábitat</button><Coach step={1} hidden={false} onNext={()=>{}} onSkip={()=>{}} /></Providers>);
  const habitat=screen.getByRole("button",{name:"Hábitat"}); habitat.focus();
  expect(document.activeElement).toBe(habitat);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("conserva volumen cero al recuperar los ajustes", () => {
  localStorage.setItem("selene.volume","0");localStorage.setItem("selene.muted","false");
  render(<Providers><SettingsBar /></Providers>);
  expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0");
});

it("un rechazo de pantalla completa se comunica sin romper el juego", async () => {
  Object.defineProperty(document,"fullscreenEnabled",{configurable:true,value:true});
  document.documentElement.requestFullscreen=vi.fn().mockRejectedValue(new Error("NotAllowed"));
  render(<Providers><SettingsBar /></Providers>);
  fireEvent.click(screen.getByRole("button",{name:"Pantalla completa"}));
  await waitFor(()=>expect(screen.getByRole("status").textContent).toContain("Puedes continuar jugando"));
  Object.defineProperty(document,"fullscreenEnabled",{configurable:true,value:false});
});

it("el plan hace visible compartir datos en Marte sin imponerlo a partidas anteriores", async () => {
  const {mission}=await new MockMissionClient().createMission({scenario_id:"mars-outpost-v1"});
  const parameters={turns:12,actions_per_turn:2,energy_capacity_kwh:50,oxygen_capacity_kg:6,water_capacity_l:30,food_capacity_kg:6,science_target:30};
  const view=render(<Providers><MissionPlan mission={mission} parameters={parameters} /></Providers>);
  expect(screen.getByText("Datos compartidos")).toBeTruthy();
  mission.state.rules_version="mars-1.0.0";
  view.rerender(<Providers><MissionPlan mission={mission} parameters={parameters} /></Providers>);
  expect(screen.queryByText("Datos compartidos")).toBeNull();
});
