// src/components/ControlPanel.tsx
"use client";

import { useEffect, useId, useState } from "react";
import { useSimStore } from "@/store/useSimStore";
import { DEFAULT_RA_RADIUS, sphereRadius, type Potential } from "@/lib/sim";
import MathTex from "./MathTex";

type SliderFieldProps = {
  label: string; value: number; min: number; max: number; step: number;
  digits: number; onChange: (value: number) => void; skipZero?: boolean;
  manualMin?: number; manualMax?: number; minExclusive?: boolean;
  maxExclusive?: boolean; integer?: boolean;
};

function SliderField({ label, value, min, max, step, digits, onChange, skipZero = false,
  manualMin = min, manualMax = max, minExclusive = false, maxExclusive = false,
  integer = false }: SliderFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [error, setError] = useState("");
  const limits = `${minExclusive ? "(" : "["}${manualMin}, ${Number.isFinite(manualMax) ? manualMax : "∞"}${maxExclusive ? ")" : "]"}${integer ? "; integers only" : ""}${skipZero ? "; zero excluded" : ""}`;
  useEffect(() => { setDraft(String(value)); setError(""); }, [value, manualMin, manualMax]);
  const commit = () => {
    const next = Number(draft);
    if (!draft.trim() || !Number.isFinite(next) ||
      (minExclusive ? next <= manualMin : next < manualMin) ||
      (maxExclusive ? next >= manualMax : next > manualMax) ||
      (integer && !Number.isInteger(next)) || (skipZero && next === 0)) {
      setDraft(String(value));
      setError(`Enter a finite value in ${limits}.`);
      return;
    }
    setError(""); setDraft(String(next));
    if (next !== value) onChange(next);
  };
  // Only the thumb is clamped. The actual value and numeric input stay unchanged.
  let thumb = Math.max(min, Math.min(max, value));
  if (skipZero && Math.abs(thumb) < step) thumb = thumb < 0 ? -step : step;
  const rangeValue = skipZero ? Math.round((thumb - min) / step) - (thumb > 0 ? 1 : 0) : thumb;
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <label className="min-w-0" htmlFor={id}>{label}</label>
        <input className={`w-28 shrink-0 rounded border bg-white px-2 py-0.5 text-right text-xs tabular-nums ${error ? "border-red-500" : "border-gray-300"}`}
          aria-label={`${label}: numeric value`} aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          type="number" min={manualMin} max={Number.isFinite(manualMax) ? manualMax : undefined}
          step={integer ? 1 : "any"} value={draft}
          title={`Manual input: ${limits}. Enter or click away to apply.`}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => { setDraft(e.target.value); setError(""); }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === "Escape") { e.preventDefault(); setDraft(String(value)); setError(""); }
          }} />
      </div>
      <input id={id} className="mt-1 block w-full" type="range"
        title={`Suggested slider range: ${min} to ${max}. Manual values may extend beyond it.`}
        min={skipZero ? 0 : min} max={skipZero ? Math.round((max-min)/step)-1 : max}
        step={skipZero ? 1 : step} value={rangeValue}
        onChange={(e) => {
          const raw = Number(e.target.value);
          const decoded = skipZero ? min + raw * step + (raw >= Math.round(-min/step) ? step : 0) : raw;
          const next = Number(decoded.toFixed(digits));
          setDraft(String(next)); setError("");
          if (next !== value) onChange(next);
        }} />
      {error && <div id={`${id}-error`} role="status" className="mt-1 text-xs text-red-700">{error}</div>}
    </div>
  );
}

export default function ControlPanel() {
  const N = useSimStore((s) => s.N);
  const eta = useSimStore((s) => s.eta);
  const stepsPerSecond = useSimStore((s) => s.stepsPerSecond);
  const pot = useSimStore((s) => s.pot);
  const running = useSimStore((s) => s.running);
  const step = useSimStore((s) => s.step);
  const energy = useSimStore((s) => s.energy);
  const trueEnergy = useSimStore((s) => s.trueEnergy);
  const simulationError = useSimStore((s) => s.simulationError);
  const minDist = useSimStore((s) => s.minDist);

  const setN = useSimStore((s) => s.setN);
  const setEta = useSimStore((s) => s.setEta);
  const setStepsPerSecond = useSimStore((s) => s.setStepsPerSecond);
  const setPotential = useSimStore((s) => s.setPotential);

  const randomize = useSimStore((s) => s.randomize);
  const toggleRunning = useSimStore((s) => s.toggleRunning);
  const singleStep = useSimStore((s) => s.singleStep);

  const domain = useSimStore((s) => s.domain);
  const setDomain = useSimStore((s) => s.setDomain);
  const potKind = pot.kind;

  const showP = pot.kind === "power" || pot.kind === "pframe";
  const maximize = pot.kind === "power" || pot.kind === "mixed"
    || (pot.kind === "lj" && pot.direction === "maximize");
  const energyLabel = pot.kind === "mixed" ? "Maximize scaled energy"
    : maximize ? "Maximize energy" : "Minimize energy";
  // Undo only the optimizer's sign convention, not the potential's actual sign.
  const displayedEnergy = pot.kind === "power" || pot.kind === "mixed" ? -energy : energy;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4 pb-10">
      <div>
        <div className="text-lg font-semibold">Spherical Energy Playground</div>
        <div className="text-sm text-gray-600">
          Discrete Energy Optimization on <MathTex tex={domain === "space" ? String.raw`\mathbb{R}^3` : 'S^2'} /> and Projected Gradient Methods
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="text-sm">Step: {step}</div>
        <div className="text-sm">{energyLabel}: {displayedEnergy.toFixed(6)}</div>
        {pot.kind === "mixed" && (
          <div className="text-sm">Maximize non-scaled energy: {trueEnergy == null ? "—" : trueEnergy.toFixed(8)}</div>
        )}
        {simulationError && <p role="alert" className="mt-2 text-sm text-red-700">{simulationError}</p>}
        <div className="text-sm">Minimal distance: {minDist.toFixed(6)}</div>
      </div>

      <div className="rounded-lg border p-3">

        <div className="space-y-2">
          <SliderField label="Number of points N" value={N} min={2} max={200} step={1} digits={0} manualMax={10000} integer onChange={setN} />
          <SliderField label="Step size η" value={eta} min={0.0005} max={domain === "space" ? 1 : 0.05}
            step={0.0005} digits={4} manualMin={0} minExclusive manualMax={Infinity} onChange={setEta} />
          <SliderField label="Steps / second" value={stepsPerSecond} min={1} max={240} step={1} digits={0} manualMax={1000} integer onChange={setStepsPerSecond} />
        </div>
      </div>

      <div className="rounded-lg border p-3">

        <select
          aria-label="Potential"
          className="w-full rounded border px-2 py-1"
          value={potKind}
          onChange={(e) => {
            const k = e.target.value as Potential["kind"];
            if (k === "riesz") setPotential({ kind: "riesz", s: 1 });
            if (k === "mixed") setPotential({ kind: "mixed", s: 1.25, gamma: 0.5, scale: 0.99 });
            if (k === "lj") setPotential({ kind: "lj", alpha: -6, beta: -12, direction: "minimize", radius: DEFAULT_RA_RADIUS });
            if (k === "log") setPotential({ kind: "log" });
            if (k === "power") setPotential({ kind: "power", p: 2 });   // minimize -r^p (maximize r^p)
            if (k === "pframe") setPotential({ kind: "pframe", p: 2 }); // minimize |<x,y>|^p
          }}
        >
          <option value="riesz">Riesz s-potential</option>
          <option value="log">Logarithmic potential</option>
          <option value="power">Power potential</option>
          <option value="lj">Repulsive-attractive potential</option>
          <option value="mixed">Mixed potential</option>
          <option value="pframe">p-frame potential</option>
        </select>
        <div className="mt-2 text-sm text-gray-700">
          {pot.kind === "riesz" && (
            <MathTex tex={String.raw`f(x,y)=|x-y|^{-s}`} />
          )}
          {pot.kind === "lj" && (
            <MathTex tex={String.raw`\textstyle f_{\alpha,\beta}(x,y)=\tfrac{1}{\alpha}|x-y|^\alpha-\tfrac{1}{\beta}|x-y|^\beta`} />
          )}
          {pot.kind === "log" && (
            <MathTex tex={String.raw`f(x,y)=-\log |x-y|`} />
          )}
          {pot.kind === "power" && (
            <MathTex tex={String.raw`f(x,y)=|x-y|^{p}`} />
          )}
          {pot.kind === "mixed" && (
            <div className="overflow-x-auto">
              <div><MathTex tex={String.raw`f_{s,\gamma}(x,y)`} /></div>
              <div><MathTex tex={String.raw`=(\gamma|x-y|+(1-\gamma)\arccos(\langle x,y\rangle))^s`} /></div>
            </div>
          )}
          {pot.kind === "pframe" && (
            <MathTex tex={String.raw`f(x,y)=|\langle x,y\rangle|^{p}`} />
          )}
        </div>

        {pot.kind === "lj" && (
          <div className="mt-2 space-y-2">
            <label className="block text-sm">
              Domain
              <select className="mt-1 w-full rounded border px-2 py-1" value={domain}
                onChange={(e) => setDomain(e.target.value === "space" ? "space" : "sphere")}>
                <option value="sphere">Sphere S²</option>
                <option value="space">Free space ℝ³</option>
              </select>
            </label>
            {domain === "sphere" && (
              <SliderField label="Sphere radius R" value={sphereRadius(pot)} min={0.1} max={2} step={0.001} digits={6}
                manualMin={0.01} manualMax={100}
                onChange={(radius) => setPotential({ ...pot, radius })} />
            )}
            <label className="block text-sm">
              Optimization direction
              <select className="mt-1 w-full rounded border px-2 py-1" value={pot.direction}
                onChange={(e) => setPotential({ ...pot, direction: e.target.value === "maximize" ? "maximize" : "minimize" })}>
                <option value="minimize">Minimize</option>
                <option value="maximize">Maximize</option>
              </select>
            </label>
            {(["alpha", "beta"] as const).map((parameter) => (
              <SliderField key={parameter} label={`Exponent ${parameter === "alpha" ? "α" : "β"}`}
                value={pot[parameter]} min={-12} max={12} step={0.1} digits={1} skipZero manualMin={-100} manualMax={100}
                onChange={(value) => setPotential({ ...pot, [parameter]: value })} />
            ))}
          </div>
        )}

        {pot.kind === "mixed" && (
          <div className="mt-2 space-y-2">
            <SliderField label="Exponent s" value={pot.s} min={1} max={6} step={0.01} digits={2} manualMin={0} minExclusive manualMax={100}
              onChange={(value) => setPotential({ ...pot, s: value })} />
            <SliderField label="Weight γ" value={pot.gamma} min={0} max={1} step={0.01} digits={2}
              onChange={(value) => setPotential({ ...pot, gamma: value })} />
            <SliderField label="Scale α" value={pot.scale ?? 0.99} min={0.9} max={0.9999} step={0.0001} digits={4} manualMin={0} manualMax={1} maxExclusive
              onChange={(value) => setPotential({ ...pot, scale: value })} />
          </div>
        )}

        {pot.kind === "riesz" && (
          <div className="mt-2">
            <SliderField label="Exponent s" value={pot.s} min={0.1} max={6} step={0.1} digits={1} manualMin={0} minExclusive manualMax={100}
              onChange={(value) => setPotential({ ...pot, s: value })} />
          </div>
        )}

        {showP && (pot.kind === "power" || pot.kind === "pframe") && (
          <div className="mt-2">
            <SliderField label="Exponent p" value={pot.p} min={1} max={10} step={0.1} digits={1} manualMin={0} minExclusive manualMax={100}
              onChange={(value) => setPotential({ ...pot, p: value })} />
          </div>
        )}

        {pot.kind === "pframe" && (
          <div className="mt-2 text-xs text-gray-500">
            Minimizing ∑|⟨x,y⟩|^p encourages small correlations (frame-like spread).
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button className="rounded bg-black px-3 py-2 text-white" onClick={toggleRunning}>
          {running ? "Pause" : "Start"}
        </button>

        <div className="flex gap-2">
          <button className="flex-1 rounded border px-3 py-2" onClick={() => singleStep(1)}>
            Step
          </button>
          <button className="flex-1 rounded border px-3 py-2" onClick={randomize}>
            Random init
          </button>
        </div>

        <button className="rounded border px-3 py-2" onClick={() => singleStep(50)}>
          Step × 50
        </button>
      </div>
    </div>
  );
}
