// src/components/ControlPanel.tsx
"use client";

import { useSimStore } from "@/store/useSimStore";
import type { Potential } from "@/lib/sim";
import MathTex from "./MathTex";

export default function ControlPanel() {
  const N = useSimStore((s) => s.N);
  const eta = useSimStore((s) => s.eta);
  const stepsPerSecond = useSimStore((s) => s.stepsPerSecond);
  const pot = useSimStore((s) => s.pot);
  const running = useSimStore((s) => s.running);
  const step = useSimStore((s) => s.step);
  const energy = useSimStore((s) => s.energy);
  const minDist = useSimStore((s) => s.minDist);

  const setN = useSimStore((s) => s.setN);
  const setEta = useSimStore((s) => s.setEta);
  const setStepsPerSecond = useSimStore((s) => s.setStepsPerSecond);
  const setPotential = useSimStore((s) => s.setPotential);

  const randomize = useSimStore((s) => s.randomize);
  const toggleRunning = useSimStore((s) => s.toggleRunning);
  const singleStep = useSimStore((s) => s.singleStep);

  const potKind = pot.kind;

  const showP = pot.kind === "power" || pot.kind === "pframe";

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div>
        <div className="text-lg font-semibold">Spherical Energy Playground</div>
        <div className="text-sm text-gray-600">
          Discrete Energy Minimization Problem on <MathTex tex = {'S^2'} /> and Gradient Descent
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 font-medium">Status</div>
        <div className="text-sm">step: {step}</div>
        <div className="text-sm">energy: {energy.toFixed(6)}</div>
        <div className="text-sm">min dist: {minDist.toFixed(6)}</div>
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 font-medium">Parameters</div>

        <label className="block text-sm">
          N (2–200)
          <input
            className="mt-1 w-full"
            type="range"
            min={2}
            max={200}
            value={N}
            onChange={(e) => setN(Number(e.target.value))}
          />
          <div className="text-xs text-gray-600">{N}</div>
        </label>

        <label className="mt-3 block text-sm">
          Step size η
          <input
            className="mt-1 w-full"
            type="range"
            min={0.0005}
            max={0.05}
            step={0.0005}
            value={eta}
            onChange={(e) => setEta(Number(e.target.value))}
          />
          <div className="text-xs text-gray-600">{eta.toFixed(4)}</div>
        </label>

        <label className="mt-3 block text-sm">
          Steps / second
          <input
            className="mt-1 w-full"
            type="range"
            min={1}
            max={240}
            step={1}
            value={stepsPerSecond}
            onChange={(e) => setStepsPerSecond(Number(e.target.value))}
          />
          <div className="text-xs text-gray-600">{stepsPerSecond}</div>
        </label>
      </div>

      <div className="rounded-lg border p-3">
        <div className="mb-2 font-medium">Potential</div>

        <select
          className="w-full rounded border px-2 py-1"
          value={potKind}
          onChange={(e) => {
            const k = e.target.value as Potential["kind"];
            if (k === "riesz") setPotential({ kind: "riesz", s: 1 });
            if (k === "log") setPotential({ kind: "log" });
            if (k === "power") setPotential({ kind: "power", p: 2 });   // minimize -r^p (maximize r^p)
            if (k === "pframe") setPotential({ kind: "pframe", p: 2 }); // minimize |<x,y>|^p
          }}
        >
          <option value="riesz">Riesz s-potential</option>
          <option value="log">Logarithmic potential</option>
          <option value="power">Power potential (maximize)</option>
          <option value="pframe">p-frame potential</option>
        </select>
        <div className="mt-2 text-sm text-gray-700">
          {pot.kind === "riesz" && <MathTex tex={`f(x,y)=|x-y|^{-s}`} />}
          {pot.kind === "log" && <MathTex tex={`f(x,y)=-\\log |x-y|`} />}
          {pot.kind === "power" && <MathTex tex={`f(x,y)=-|x-y|^{p}\\ \\ (\\text{maximize } |x-y|^p)`} />}
          {pot.kind === "pframe" && <MathTex tex={`f(x,y)=|\\langle x,y\\rangle|^{p}`} />}
        </div>

        {pot.kind === "riesz" && (
          <label className="mt-3 block text-sm">
            s
            <input
              className="mt-1 w-full"
              type="range"
              min={0.1}
              max={6}
              step={0.1}
              value={pot.s}
              onChange={(e) => setPotential({ kind: "riesz", s: Number(e.target.value) })}
            />
            <div className="text-xs text-gray-600">{pot.s.toFixed(1)}</div>
          </label>
        )}

        {showP && (
          <label className="mt-3 block text-sm">
            p
            <input
              className="mt-1 w-full"
              type="range"
              min={1}
              max={10}
              step={0.1}
              value={pot.p}
              onChange={(e) => {
                const p = Number(e.target.value);
                if (pot.kind === "power") setPotential({ kind: "power", p });
                if (pot.kind === "pframe") setPotential({ kind: "pframe", p });
              }}
            />
            <div className="text-xs text-gray-600">{pot.p.toFixed(1)}</div>
          </label>
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
