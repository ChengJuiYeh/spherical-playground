"use client";

import type { TorusPotential } from "../lib/torus_sim";

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function fmt(x: number, digits = 6) {
  if (!isFinite(x)) return "NaN";
  if (Math.abs(x) >= 1000 || (Math.abs(x) > 0 && Math.abs(x) < 1e-4)) {
    return x.toExponential(3);
  }
  return x.toFixed(digits);
}

function potentialLabel(pot: TorusPotential) {
  switch (pot.kind) {
    case "riesz":
      return `r^{-s}`;
    case "log":
      return `-log r`;
    case "power":
      return `-r^p`;
  }
}

type Props = {
  N: number;
  setN: (v: number) => void;
  eta: number;
  setEta: (v: number) => void;
  stepsPerSec: number;
  setStepsPerSec: (v: number) => void;
  softening: number;
  potKind: "riesz" | "log" | "power";
  setPotKind: (v: "riesz" | "log" | "power") => void;
  rieszS: number;
  setRieszS: (v: number) => void;
  powerP: number;
  setPowerP: (v: number) => void;
  pot: TorusPotential;
  running: boolean;
  setRunning: React.Dispatch<React.SetStateAction<boolean>>;
  stepCount: number;
  energy: number;
  minDist: number;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  oneStep: () => void;
  randomInit: () => void;
};

export default function FlatTorusControlPanel({
  N,
  setN,
  eta,
  setEta,
  stepsPerSec,
  setStepsPerSec,
  softening,
  potKind,
  setPotKind,
  rieszS,
  setRieszS,
  powerP,
  setPowerP,
  pot,
  running,
  setRunning,
  stepCount,
  energy,
  minDist,
  zoom,
  setZoom,
  oneStep,
  randomInit,
}: Props) {
  const formulaText =
    pot.kind === "riesz"
      ? `Potential: ${potentialLabel(pot)} with s = ${pot.s}, ε = ${softening.toFixed(3)}`
      : pot.kind === "power"
        ? `Potential: ${potentialLabel(pot)} with p = ${pot.p}, ε = ${softening.toFixed(3)}`
        : `Potential: ${potentialLabel(pot)} with ε = ${softening.toFixed(3)}`;

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 pb-4">
      <div>
        <div className="text-lg font-semibold">Flat Torus Energy Playground</div>
        <div className="text-sm text-gray-600">
          Discrete energy minimization on the flat torus{" "}
          <span className="font-mono">T² = [0,1)²</span> with periodic boundary
          conditions.
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-2 text-sm font-semibold">Status</div>
        <div className="space-y-1 text-sm text-gray-800">
          <div>Step: <span className="font-mono">{stepCount}</span></div>
          <div>Energy: <span className="font-mono">{fmt(energy, 6)}</span></div>
          <div>Minimum distance: <span className="font-mono">{fmt(minDist, 6)}</span></div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Parameters</div>

        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-700">
            Number of points N (2 – 400)
          </label>
          <input
            className="w-full"
            type="range"
            min={2}
            max={400}
            step={1}
            value={N}
            onChange={(e) => setN(Number(e.target.value))}
          />
          <input
            className="mt-1 w-24 rounded border px-2 py-1 text-sm font-mono text-gray-700"
            type="number"
            min={2}
            max={400}
            step={1}
            value={N}
            onChange={(e) => setN(clamp(Number(e.target.value), 2, 400))}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-700">Step size η</label>
          <input
            className="w-full"
            type="range"
            min={0.0001}
            max={0.01}
            step={0.0001}
            value={eta}
            onChange={(e) => setEta(Number(e.target.value))}
          />
          <input
            className="mt-1 w-28 rounded border px-2 py-1 text-sm font-mono text-gray-700"
            type="number"
            min={0.0001}
            max={0.01}
            step={0.0001}
            value={eta}
            onChange={(e) => setEta(clamp(Number(e.target.value), 0.0001, 0.01))}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-gray-700">Steps / second</label>
          <input
            className="w-full"
            type="range"
            min={1}
            max={120}
            step={1}
            value={stepsPerSec}
            onChange={(e) => setStepsPerSec(Number(e.target.value))}
          />
          <input
            className="mt-1 w-24 rounded border px-2 py-1 text-sm font-mono text-gray-700"
            type="number"
            min={1}
            max={120}
            step={1}
            value={stepsPerSec}
            onChange={(e) => setStepsPerSec(clamp(Number(e.target.value), 1, 120))}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Potential</div>

        <select
          className="w-full rounded border px-3 py-2 text-sm"
          value={potKind}
          onChange={(e) => setPotKind(e.target.value as "riesz" | "log" | "power")}
        >
          <option value="riesz">Riesz potential</option>
          <option value="log">Log potential</option>
          <option value="power">Power potential</option>
        </select>

        <div className="mt-3 text-sm text-gray-700">{formulaText}</div>

        {potKind === "riesz" && (
          <div className="mt-4">
            <label className="mb-1 block text-sm text-gray-700">s</label>
            <input
              className="w-full"
              type="range"
              min={0.2}
              max={6}
              step={0.1}
              value={rieszS}
              onChange={(e) => setRieszS(Number(e.target.value))}
            />
            <input
              className="mt-1 w-24 rounded border px-2 py-1 text-sm font-mono text-gray-700"
              type="number"
              min={0.2}
              max={6}
              step={0.1}
              value={rieszS}
              onChange={(e) => setRieszS(clamp(Number(e.target.value), 0.2, 6))}
            />
          </div>
        )}

        {potKind === "power" && (
          <div className="mt-4">
            <label className="mb-1 block text-sm text-gray-700">p</label>
            <input
              className="w-full"
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={powerP}
              onChange={(e) => setPowerP(Number(e.target.value))}
            />
            <input
              className="mt-1 w-24 rounded border px-2 py-1 text-sm font-mono text-gray-700"
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={powerP}
              onChange={(e) => setPowerP(clamp(Number(e.target.value), 0, 5))}
            />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <button
          className="w-full rounded bg-black px-4 py-3 text-white"
          onClick={() => setRunning((v) => !v)}
        >
          {running ? "Stop" : "Start"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded border bg-white px-4 py-3 text-black"
            onClick={oneStep}
          >
            Step
          </button>
          <button
            className="rounded border bg-white px-4 py-3 text-black"
            onClick={randomInit}
          >
            Random init
          </button>
        </div>
      </div>
    </div>
  );
}