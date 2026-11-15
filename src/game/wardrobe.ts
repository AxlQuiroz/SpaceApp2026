/**
 * Vestidor: colores de traje para los cuatro astronautas.
 *
 * Modelo de negocio (docs/modelo-de-negocio.md): los cosméticos NUNCA cambian la simulación.
 * - "free": disponibles desde el principio.
 * - "medal": se ganan jugando (cada medalla desbloquea un traje), así nadie se queda sin personalizar.
 * - "pass": solo mientras el Plan Familiar (suscripción mensual de los padres) está activo; al cancelar,
 *   el traje vuelve a uno gratuito, pero lo ganado con medallas se conserva. Todavía no hay pasarela de
 *   pago, así que se ocultan al niño y se muestran sin precio en "Para familias": nunca ve un botón de compra.
 *
 * La elección se guarda solo en este navegador.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { PIXEL_PALETTE } from "@/sprites/sprites.config";
import type { Lang } from "./learning";

type L = Record<Lang, string>;

export type SuitUnlock = { kind: "free" } | { kind: "medal"; medal: string } | { kind: "pass" };

export type Suit = {
  id: string;
  name: L;
  /** cambios de color sobre el sprite del astronauta (O = franjas, W = traje) */
  swap: Record<string, string>;
  unlock: SuitUnlock;
};

export const SUITS: Suit[] = [
  { id: "orange", name: { es: "Naranja clásico", en: "Classic orange" }, swap: {}, unlock: { kind: "free" } },
  { id: "cyan", name: { es: "Cian neón", en: "Neon cyan" }, swap: { O: "C" }, unlock: { kind: "free" } },
  { id: "lime", name: { es: "Lima", en: "Lime" }, swap: { O: "L" }, unlock: { kind: "free" } },
  { id: "amber", name: { es: "Ámbar", en: "Amber" }, swap: { O: "Y" }, unlock: { kind: "free" } },
  { id: "red", name: { es: "Rojo cohete", en: "Rocket red" }, swap: { O: "A" }, unlock: { kind: "medal", medal: "first_day" } },
  { id: "water", name: { es: "Azul agua", en: "Water blue" }, swap: { O: "c" }, unlock: { kind: "medal", medal: "plumber" } },
  { id: "shadow", name: { es: "Sombra de refugio", en: "Shelter shadow" }, swap: { O: "b" }, unlock: { kind: "medal", medal: "storm_safe" } },
  { id: "moss", name: { es: "Musgo de invernadero", en: "Greenhouse moss" }, swap: { O: "D" }, unlock: { kind: "medal", medal: "scientist" } },
  { id: "cream", name: { es: "Crema estelar", en: "Star cream" }, swap: { O: "S" }, unlock: { kind: "medal", medal: "healthy" } },
  { id: "rust", name: { es: "Óxido marciano", en: "Martian rust" }, swap: { O: "R" }, unlock: { kind: "medal", medal: "mars_pioneer" } },
  { id: "steel", name: { es: "Acero de comandante", en: "Commander steel" }, swap: { O: "G" }, unlock: { kind: "medal", medal: "commander" } },
  // Plan Familiar (suscripción mensual): trajes de dos tonos (cambian también el blanco del traje).
  { id: "regolith", name: { es: "Polvo lunar", en: "Moon dust" }, swap: { W: "M", O: "O" }, unlock: { kind: "pass" } },
  { id: "night", name: { es: "Noche estelar", en: "Starry night" }, swap: { W: "b", O: "C" }, unlock: { kind: "pass" } },
  { id: "redplanet", name: { es: "Planeta rojo", en: "Red planet" }, swap: { W: "R", O: "Y" }, unlock: { kind: "pass" } },
  { id: "golden", name: { es: "Dorado de gala", en: "Gala gold" }, swap: { W: "S", O: "Y" }, unlock: { kind: "pass" } },
];

const BY_ID = Object.fromEntries(SUITS.map((s) => [s.id, s])) as Record<string, Suit>;

/** Trajes por defecto: los mismos colores que tenía la tripulación antes del vestidor. */
export const DEFAULT_LOOK = ["orange", "cyan", "lime", "amber"];

export function suitUnlocked(suit: Suit, medals: string[]): boolean {
  if (suit.unlock.kind === "free") return true;
  if (suit.unlock.kind === "medal") return medals.includes(suit.unlock.medal);
  return false; // el Plan Familiar aún no se puede contratar (sin pasarela ni cuenta del adulto)
}

export function suitForMedal(medalId: string): Suit | undefined {
  return SUITS.find((s) => s.unlock.kind === "medal" && s.unlock.medal === medalId);
}

/** Color principal del traje (para los puntos del minimapa). */
export function suitColor(id: string): string {
  const suit = BY_ID[id] ?? BY_ID.orange;
  return PIXEL_PALETTE[suit.swap.O ?? "O"];
}

export function suitSwap(id: string): Record<string, string> {
  return (BY_ID[id] ?? BY_ID.orange).swap;
}

const KEY = "selene.wardrobe.v1";

export function loadLook(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
    if (Array.isArray(raw) && raw.length === 4) return raw.map((id, i) => (typeof id === "string" && BY_ID[id] ? id : DEFAULT_LOOK[i]));
  } catch {
    /* sin almacenamiento: se usan los trajes por defecto */
  }
  return [...DEFAULT_LOOK];
}

function saveLook(look: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    /* el cambio dura lo que dure la pestaña */
  }
}

/** Trajes elegidos para cada tripulante (índice 0..3). */
export function useCrewLook() {
  const [look, setLook] = useState<string[]>(DEFAULT_LOOK);
  useEffect(() => setLook(loadLook()), []);
  const dress = useCallback((crewIndex: number, suitId: string) => {
    setLook((prev) => {
      const next = prev.map((id, i) => (i === crewIndex ? suitId : id));
      saveLook(next);
      return next;
    });
  }, []);
  return { look, dress };
}
