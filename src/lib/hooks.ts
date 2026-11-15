"use client";

import { useEffect, useRef, useState } from "react";

/** Mantiene el teclado dentro de los overlays que no usan <dialog> nativo. */
export function useFocusTrap<T extends HTMLElement>(active = true) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => [...node.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
    const keepFocus = (event: FocusEvent) => {
      if (!node.contains(event.target as Node)) controls()[0]?.focus({ preventScroll: true });
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) { event.preventDefault(); return; }
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && (index < 0 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); }
    };
    node.addEventListener("keydown", onKey);
    document.addEventListener("focusin", keepFocus);
    return () => {
      node.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", keepFocus);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active]);
  return ref;
}

/** true si el sistema pide menos movimiento (desactiva parpadeos, typewriter, etc.). */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Número que avanza "por pasos" hacia el objetivo (contador retro). */
export function useSteppedNumber(target: number, steps = 6, stepMs = 50, decimals = 0) {
  const f = 10 ** decimals;
  const round = (n: number) => Math.round(n * f) / f;
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (reduced) {
      setShown(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      const v = i >= steps ? target : round(from + ((target - from) * i) / steps);
      setShown(v);
      fromRef.current = v;
      if (i >= steps) window.clearInterval(id);
    }, stepMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, steps, stepMs, reduced]);

  return shown.toFixed(decimals);
}

