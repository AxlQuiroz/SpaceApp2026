"use client";

import type { EarthGuidance } from "@/lib/orbita/schema";
import { useI18n } from "@/lib/providers";
import { reviewText } from "./reviewText";

/** Información recibida, con vigencia visible; ninguna regla se recalcula en el navegador. */
export function RadioReport({ report, turn }: { report: EarthGuidance | null; turn: number }) {
  const { locale } = useI18n();
  const copy = reviewText(locale);
  if (!report) return null;
  const expired = turn > report.received_turn && turn >= report.valid_until_turn;
  return (
    <details className="bevel-inset px-3 py-2" data-testid="earth-report" open={turn === report.received_turn}>
      <summary className="font-pixel cursor-pointer py-1 text-lg text-neon-cyan">{copy.radioTitle} · {copy.reportFrom} {report.received_turn}</summary>
      {expired ? <p className="text-amber">{copy.reportExpired}</p> : <>
        <p className="my-2 text-lg">{copy.radioAdvice[report.advice_code]}</p>
        <ul className="flex list-inside list-disc flex-col gap-1 text-base text-steel-200">
          {report.next_turn_dose_rate_ugy_h !== null && <li>{copy.nextReading}: {report.next_turn_dose_rate_ugy_h.toFixed(2)} µGy/h</li>}
          <li>{report.suggested_eva_turn !== null ? `${copy.evaWindow} ${report.suggested_eva_turn}` : copy.noEvaWindow}</li>
          {report.dust_start_turn !== null && <li>{copy.dustWindow} {report.dust_start_turn}–{report.dust_end_turn}</li>}
        </ul>
      </>}
      <p className="mt-2 text-base text-steel-400">{copy.radioReportNote}</p>
    </details>
  );
}
