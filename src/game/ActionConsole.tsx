"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PixelSprite } from "@/components/hud/PixelSprite";
import { HOTKEYS } from "@/components/hud/CommandCard";
import type { IconName } from "@/sprites/sprites.config";
import { useAudio, useI18n } from "@/lib/providers";
import { flightText } from "./flightText";
import type { ActionGroup } from "./actionPresentation";
import type { ActionId } from "./useMission";

export type FlightCommand = {
  id: ActionId; icon: IconName; label: string; hint: string; previewHint?: string; costs: string; group: ActionGroup;
  locked: boolean; reason: string | null; hidden?: boolean; state?: string; recommended?: boolean; onActivate: () => void;
};

/** La misma consola legible en escritorio y en la hoja móvil. Elegir sólo abre la previsión. */
export function ActionConsole({ commands, actionsLeft, maxActions, guidance, hotkeys = false, onSelect }: {
  commands: FlightCommand[]; actionsLeft: number; maxActions: number; guidance: string;
  hotkeys?: boolean; onSelect?: (command: FlightCommand) => void;
}) {
  const { locale } = useI18n(), { play } = useAudio();
  const c = flightText(locale), prefix = useId(), root = useRef<HTMLElement>(null);
  const [selectedGroup, setSelectedGroup] = useState<ActionGroup>("research");
  const groups = (["research", "systems", "protection"] as const).filter(group => commands.some(command => command.group === group && !command.hidden));
  const recommended = commands.find(command => command.recommended && !command.locked && !command.hidden);
  const activate = (command: FlightCommand) => {
    if (command.locked || command.hidden) return;
    play("click");
    if (onSelect) onSelect(command); else command.onActivate();
  };
  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || !root.current?.getClientRects().length) return;
      const target = event.target instanceof Element ? event.target : document.activeElement;
      if (target?.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
      const index = HOTKEYS.indexOf(event.key.toUpperCase() as typeof HOTKEYS[number]);
      const command = commands[index];
      if (index >= 0 && command && !command.locked && !command.hidden) { event.preventDefault(); activate(command); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <section ref={root} aria-label={c.decisions} className="flex min-w-0 flex-col gap-3" data-testid="action-console">
    <header className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="font-tiny text-xs text-steel-200 uppercase">{c.control}</p><h2 className="font-pixel text-xl text-neon-cyan">{c.decisions}</h2></div>
      <span className={`bevel-inset px-2 py-1 font-pixel text-lg ${actionsLeft ? "text-lime" : "text-amber"}`} aria-label={`${actionsLeft} / ${maxActions} ${c.remaining}`}>
        {actionsLeft}<span className="text-steel-400">/{maxActions}</span> <span className="text-sm">{c.remaining}</span>
      </span>
      <p className="w-full text-base text-steel-200">{c.steps}</p>
    </header>
    <aside className="bevel-inset flex items-start gap-2 p-2" aria-label={c.guidance}>
      <PixelSprite sprite="robot" anim="idle" scale={2} className="shrink-0" />
      <div className="min-w-0"><p className="font-pixel text-sm text-amber">{c.guidance}</p><p className="text-base text-steel-200">{actionsLeft === 0 ? c.used : guidance}</p></div>
    </aside>
    {recommended && <button type="button" onClick={() => setSelectedGroup(recommended.group)} className="pixel-btn self-start px-2 text-base text-amber">◆ {c.showAdvice}: {recommended.label} →</button>}
    <div role="tablist" aria-label={c.decisions} className="grid grid-cols-3 gap-1">
      {groups.map((group,index) => <button key={group} id={`${prefix}-tab-${group}`} type="button" role="tab" aria-selected={selectedGroup === group} aria-controls={`${prefix}-panel-${group}`} aria-label={c.tabs[group]}
        tabIndex={selectedGroup === group ? 0 : -1} onClick={() => setSelectedGroup(group)}
        onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (index + 1) % groups.length : event.key === "ArrowLeft" ? (index + groups.length - 1) % groups.length : event.key === "Home" ? 0 : event.key === "End" ? groups.length - 1 : null;
          if (next === null) return;
          event.preventDefault(); setSelectedGroup(groups[next]); document.getElementById(`${prefix}-tab-${groups[next]}`)?.focus();
        }}
        className={`bevel pixel-btn min-w-0 px-1 py-2 font-pixel text-sm ${selectedGroup === group ? "text-neon-cyan" : "text-steel-200"}`}
        style={{["--bevel-fill" as string]:selectedGroup === group ? "var(--color-cyan-dark)" : "var(--color-steel-900)"}}>
        {c.tabs[group]} {recommended?.group === group && <span aria-hidden className="text-amber">◆</span>}
      </button>)}
    </div>
    {groups.map(group => {
      const items = commands.filter(command => command.group === group && !command.hidden);
      if (!items.length) return null;
      return <section key={group} id={`${prefix}-panel-${group}`} role="tabpanel" aria-labelledby={`${prefix}-tab-${group}`} hidden={selectedGroup !== group}>
        <h3 id={`${prefix}-${group}`} className="mb-2 border-b-2 border-steel-700 pb-1 font-pixel text-base text-steel-200">{c.groups[group]}</h3>
        <div className={`grid gap-2 ${items.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {items.map(command => {
            const index = commands.indexOf(command), detailId = `${prefix}-${command.id}`;
            return <button key={command.id} type="button" data-action-id={command.id} aria-label={command.label} aria-describedby={detailId}
              aria-disabled={command.locked || undefined} aria-keyshortcuts={hotkeys ? HOTKEYS[index] : undefined}
              onClick={() => activate(command)} className={`bevel pixel-btn action-choice flex min-w-0 flex-col gap-1 p-2 text-left ${command.locked ? "action-unavailable" : ""} ${command.recommended && !command.locked ? "action-priority" : ""}`}>
              <span className="flex w-full items-start gap-2"><PixelSprite icon={command.icon} scale={2} className="shrink-0" />
                <span className="min-w-0 flex-1 font-pixel text-base leading-tight text-steel-50">{command.label}</span>
                {hotkeys && <kbd className="hidden bg-steel-950 px-1 font-tiny text-xs text-steel-400 lg:block" aria-hidden>{HOTKEYS[index]}</kbd>}
              </span>
              <span id={detailId} className="flex flex-1 flex-col gap-1">
                {command.state && <span className="text-sm text-neon-cyan">● {command.state}</span>}
                {command.recommended && !command.locked && <span className="font-pixel text-sm text-amber">◆ {c.recommended}</span>}
                <span className="text-base leading-tight text-steel-200">{command.hint}</span>
                {command.locked && command.reason ? <span className="mt-auto text-sm text-amber">⊘ {command.reason}</span> : <span className="mt-auto text-sm text-neon-cyan">1 {c.action} · {command.costs || c.noCost}</span>}
              </span>
            </button>;
          })}
        </div>
      </section>;
    })}
  </section>;
}
