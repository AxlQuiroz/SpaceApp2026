"use client";

import { useEffect, useRef, useState } from "react";

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
