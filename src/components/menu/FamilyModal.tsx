"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Modal, PixelButton, PixelSprite } from "@/components/hud";
import { useI18n } from "@/lib/providers";
import { MEDALS, TERMS, type Lang, type Progress } from "@/game/learning";
import { SUITS } from "@/game/wardrobe";
import { ICONS, PIXEL_PALETTE, type IconName } from "@/sprites/sprites.config";
import type { Dict } from "@/i18n/dictionaries";

/**
 * Sección "Para familias" (docs/modelo-de-negocio.md):
 * puerta parental → Pase de Familia (sin pasarela todavía), diploma imprimible,
 * guía para jugar juntos y licencia para escuelas.
 */

type Tab = "pass" | "diploma" | "together" | "schools";
const TABS: Tab[] = ["pass", "diploma", "together", "schools"];

/** Paso de lectura para adultos; no verifica edad ni identidad. */
function newQuestion() {
  const r = () => 12 + Math.floor(Math.random() * 8); // 12..19
  return { a: r(), b: r() };
}

type Props = { open: boolean; onClose: () => void; progress: Progress };

export function FamilyModal({ open, onClose, progress }: Props) {
  const { t } = useI18n();
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<Tab>("pass");

  // Cada vez que se abre, la puerta vuelve a cerrarse.
  useEffect(() => {
    if (open) {
      setUnlocked(false);
      setTab("pass");
    }
  }, [open]);

  return (
    <Modal open={open} title={t.family.title} onClose={onClose} wide>
      {!unlocked ? (
        <ParentalGate open={open} onPass={() => setUnlocked(true)} />
      ) : (
        <div className="flex flex-col gap-3">
          <div role="tablist" aria-label={t.family.title} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`family-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`family-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onKeyDown={event => {
                  const index = TABS.indexOf(id);
                  const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : null;
                  if (next === null) return;
                  event.preventDefault(); setTab(TABS[next]);
                  document.getElementById(`family-tab-${TABS[next]}`)?.focus();
                }}
                onClick={() => setTab(id)}
                className={`bevel pixel-btn font-pixel px-2 py-1 text-base uppercase ${tab === id ? "glow" : ""}`}
                style={{ ["--bevel-fill" as string]: tab === id ? "var(--color-cyan-dark)" : "var(--color-steel-800)" }}
              >
                {t.family.tabs[id]}
              </button>
            ))}
          </div>
          <div role="tabpanel" tabIndex={0} id={`family-panel-${tab}`} aria-labelledby={`family-tab-${tab}`} className="max-h-[55vh] overflow-y-auto pr-2">
            {tab === "pass" && <PassTab />}
            {tab === "diploma" && <DiplomaTab progress={progress} />}
            {tab === "together" && <TogetherTab />}
            {tab === "schools" && <SchoolsTab />}
          </div>
          <p className="font-tiny text-xs text-steel-400">{t.family.privacy}</p>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function ParentalGate({ open, onPass }: { open: boolean; onPass: () => void }) {
  const { t } = useI18n();
  const inputId = useId();
  const [q, setQ] = useState({ a: 13, b: 14 });
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (open) {
      setQ(newQuestion());
      setValue("");
      setWrong(false);
    }
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (Number(value) === q.a * q.b) return onPass();
    setWrong(true);
    setValue("");
    setQ(newQuestion());
  };

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-3 text-center">
      <PixelSprite sprite="robot" anim="idle" scale={4} label="R0-B1" />
      <h3 className="font-pixel text-2xl text-amber">{t.family.gateTitle}</h3>
      <p className="text-xl text-steel-200">{t.family.gateBody}</p>
      <p className="font-pixel text-4xl text-neon-cyan" aria-live="polite">
        {q.a} × {q.b} = ?
      </p>
      <label htmlFor={inputId} className="sr-only">
        {t.family.gateAnswer}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          data-autofocus
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder={t.family.gateAnswer}
          className="bevel-inset font-pixel h-12 w-36 px-3 text-center text-2xl text-steel-50 outline-none focus-visible:outline-2 focus-visible:outline-neon-cyan"
        />
        <PixelButton type="submit" variant="primary" disabled={!value}>
          {t.family.gateEnter}
        </PixelButton>
      </div>
      {wrong && (
        <p role="alert" className="text-lg text-amber">
          {t.family.gateWrong}
        </p>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */

function PassTab() {
  const { t, locale } = useI18n();
  const lang = locale as Lang;
  const [asked, setAsked] = useState(false);
  const passIcons: IconName[] = ["heart", "shelter", "medal", "book", "explore"];
  return (
    <div className="flex flex-col gap-4">
      <p className="bevel-inset p-2 text-lg text-amber">{t.family.previewNote}</p>
      <p className="text-lg text-steel-200">{t.family.passIntro}</p>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="bevel-inset p-3">
          <h3 className="font-pixel mb-2 text-lg text-lime uppercase">{t.family.freeTitle}</h3>
          <ul className="flex flex-col gap-1 text-lg">
            {t.family.freeItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="text-lime">✔</span>
                {item}
              </li>
            ))}
          </ul>
        </section>
        <section className="bevel-inset p-3">
          <h3 className="font-pixel mb-2 text-lg text-amber uppercase">{t.family.passTitle}</h3>
          <ul className="flex flex-col gap-2">
            {t.family.passItems.map(([title, desc], i) => (
              <li key={title} className="flex gap-2">
                <PixelSprite icon={passIcons[i]} scale={2} className="shrink-0" />
                <span className="text-base leading-tight">
                  <strong className="font-pixel text-amber">{title}.</strong> {desc}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h3 className="font-pixel mb-2 text-lg text-neon-cyan uppercase">{t.family.passSuits}</h3>
        <ul className="flex flex-wrap gap-3">
          {SUITS.filter((s) => s.unlock.kind === "pass").map((s) => (
            <li key={s.id} className="bevel-inset flex flex-col items-center gap-1 p-2">
              <PixelSprite sprite="astronaut" anim="idle" scale={3} swap={s.swap} />
              <span className="font-tiny text-xs">{s.name[lang]}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="bevel flex flex-col gap-2 p-3" style={{ ["--bevel-fill" as string]: "var(--color-steel-900)" }}>
        <p className="text-lg">{t.family.price}</p>
        <div className="flex flex-wrap items-center gap-3">
          <PixelButton variant="primary" onClick={() => setAsked(true)} icon={<PixelSprite icon="heart" scale={2} />}>
            {t.family.buy}
          </PixelButton>
          {asked && (
            <p role="status" className="flex-1 text-lg text-amber">
              {t.family.buySoon}
            </p>
          )}
        </div>
      </div>

      <section>
        <h3 className="font-pixel mb-2 text-lg text-neon-cyan uppercase">{t.family.rulesTitle}</h3>
        <ol className="flex list-decimal flex-col gap-1 pl-6 text-lg text-steel-200">
          {t.family.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Icono pixelado como SVG en texto, para el documento imprimible. */
function iconSvg(name: IconName, scale = 4) {
  const frame = ICONS[name].frames[0];
  const h = frame.length;
  const w = frame[0].length;
  let rects = "";
  frame.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== "." && PIXEL_PALETTE[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PIXEL_PALETTE[ch]}"/>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function diplomaHtml(t: Dict, lang: Lang, name: string, progress: Progress) {
  const medals = MEDALS.filter((m) => progress.medals.includes(m.id));
  const words = TERMS.filter((term) => progress.terms.includes(term.id)).length;
  const date = new Date().toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const medalList = medals.length
    ? medals.map((m) => `<li>${iconSvg(m.icon)}<span>${escapeHtml(m.name[lang])}</span></li>`).join("")
    : `<li class="none">${escapeHtml(t.family.diplomaNoMedals)}</li>`;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${escapeHtml(t.family.diplomaHeading)}</title>
<style>
@page { size: landscape; margin: 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Courier New", monospace; color: #1b2330; background: #fff; }
.frame { border: 10px solid #2b3648; outline: 4px solid #3ee6f0; outline-offset: -18px; padding: 40px 56px; min-height: 180mm; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
.brand { letter-spacing: 6px; font-weight: bold; color: #1a8c9e; }
h1 { font-size: 40px; margin: 4px 0; text-transform: uppercase; letter-spacing: 2px; }
.given { font-size: 18px; margin: 0; }
.name { font-size: 44px; font-weight: bold; border-bottom: 4px dashed #8796ad; padding: 0 24px 4px; min-width: 60%; }
.text { font-size: 18px; max-width: 70ch; }
h2 { font-size: 18px; text-transform: uppercase; margin: 10px 0 0; color: #4f8a1d; }
ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 14px 24px; }
li { display: flex; align-items: center; gap: 8px; font-size: 16px; }
li.none { font-style: italic; }
svg { image-rendering: pixelated; }
.foot { margin-top: auto; display: flex; justify-content: space-between; width: 100%; font-size: 14px; }
</style></head><body><div class="frame">
<div class="brand">${escapeHtml(t.app.title)}</div>
<h1>${escapeHtml(t.family.diplomaHeading)}</h1>
<p class="given">${escapeHtml(t.family.diplomaGiven)}</p>
<div class="name">${escapeHtml(name.trim() || " ")}</div>
<p class="text">${escapeHtml(t.family.diplomaText)}</p>
<h2>${escapeHtml(t.family.diplomaMedals)} (${medals.length}/${MEDALS.length})</h2>
<ul>${medalList}</ul>
<p class="text">${words} ${escapeHtml(t.family.diplomaWords)}</p>
<div class="foot"><span>${escapeHtml(date)}</span><span>${escapeHtml(t.family.diplomaSign)}</span></div>
</div><script>window.onload = function () { window.print(); };</script></body></html>`;
}

function DiplomaTab({ progress }: { progress: Progress }) {
  const { t, locale } = useI18n();
  const lang = locale as Lang;
  const inputId = useId();
  const [name, setName] = useState("");
  const [blocked, setBlocked] = useState(false);
  const medals = MEDALS.filter((m) => progress.medals.includes(m.id));

  const print = () => {
    const url = URL.createObjectURL(new Blob([diplomaHtml(t, lang, name, progress)], { type: "text/html" }));
    const win = window.open(url, "_blank");
    setBlocked(!win);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg text-steel-200">{t.family.diplomaIntro}</p>
      <p className="font-tiny text-xs text-lime uppercase">{t.family.diplomaFree}</p>
      <label htmlFor={inputId} className="font-pixel text-lg text-amber">
        {t.family.diplomaName}
      </label>
      <input
        id={inputId}
        value={name}
        maxLength={40}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
        placeholder={t.family.diplomaPlaceholder}
        className="bevel-inset h-12 px-3 text-2xl text-steel-50 outline-none focus-visible:outline-2 focus-visible:outline-neon-cyan"
      />
      <div className="bevel-inset flex flex-wrap gap-2 p-3">
        {medals.length ? (
          medals.map((m) => <PixelSprite key={m.id} icon={m.icon} scale={3} label={m.name[lang]} />)
        ) : (
          <span className="text-lg text-steel-200">{t.family.diplomaNoMedals}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PixelButton variant="primary" onClick={print} icon={<PixelSprite icon="medal" scale={2} />}>
          {t.family.diplomaPrint}
        </PixelButton>
        {blocked && <p role="alert" className="text-lg text-amber">{t.family.diplomaPopup}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TogetherTab() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg text-steel-200">{t.family.togetherIntro}</p>
      <ol className="flex flex-col gap-2">
        {t.family.questions.map((q, i) => (
          <li key={q} className="bevel-inset flex items-start gap-3 p-2 text-lg">
            <span className="font-pixel text-xl text-neon-cyan">{i + 1}</span>
            {q}
          </li>
        ))}
      </ol>
      <p className="text-lg text-lime">{t.family.togetherTip}</p>
    </div>
  );
}

function SchoolsTab() {
  const { t } = useI18n();
  const icons: IconName[] = ["book", "flask", "gear"];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg text-steel-200">{t.family.schoolsIntro}</p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {t.family.schoolsItems.map(([title, desc], i) => (
          <li key={title} className="bevel-inset flex flex-col items-start gap-1 p-3">
            <PixelSprite icon={icons[i]} scale={3} />
            <span className="font-pixel text-lg text-amber">{title}</span>
            <span className="text-base text-steel-200">{desc}</span>
          </li>
        ))}
      </ul>
      <p className="text-lg text-lime">{t.family.schoolsSoon}</p>
    </div>
  );
}
