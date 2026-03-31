// src/components/BoundPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { useSimStore } from "../store/useSimStore";
import type { Potential } from "../lib/sim";
import {
  cuttingPlaneLP,
  evalH,
  potentialToInnerProductFunction,
  uniformGrid,
} from "../lib/lp_bound";
import MathTex from "./MathTex";

function clampNumber(v: number, min?: number, max?: number) {
  let x = v;
  if (min !== undefined) x = Math.max(min, x);
  if (max !== undefined) x = Math.min(max, x);
  return x;
}

function NumberControl({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  integer = true,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  function normalize(v: number) {
    const clamped = clampNumber(v, min, max);
    return integer ? Math.round(clamped) : clamped;
  }

  function dec() {
    onChange(normalize(value - step));
  }

  function inc() {
    onChange(normalize(value + step));
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-white px-3 py-2 shadow-sm">
      <div className="mb-2 text-xs font-medium text-gray-700">{label}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={dec}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-lg leading-none hover:bg-gray-100 active:bg-gray-200"
          aria-label={`decrease ${label}`}
        >
          −
        </button>

        <input
          className="h-9 w-full rounded-md border border-gray-300 px-2 text-center text-sm outline-none focus:border-black"
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
              return;
            }
            const num = Number(raw);
            if (!Number.isNaN(num)) onChange(normalize(num));
          }}
        />

        <button
          type="button"
          onClick={inc}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-gray-50 text-lg leading-none hover:bg-gray-100 active:bg-gray-200"
          aria-label={`increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Plot({
  pot,
  N,
  h,
  activeTs,
  width = 720,
  height = 260,
}: {
  pot: Potential;
  N: number;
  h: number[] | null;
  activeTs: number[];
  width?: number;
  height?: number;
}) {
  const f = useMemo(() => potentialToInnerProductFunction(pot), [pot]);

  const padL = 46;
  const padR = 18;
  const padT = 18;
  const padB = 30;

  const W = width;
  const H = height;

  const tMax = pot.kind === "riesz" ? 0.95 : 1 - 1e-6;

  const grid = useMemo(() => uniformGrid(1400, tMax), [tMax]);

  const ys = useMemo(() => {
    const out: { t: number; f: number; h: number | null; mid: number; gap: number | null }[] = [];
    for (const t of grid) {
      const fv = f(t);
      const hv = h ? evalH(t, h) : null;
      const mid = hv === null ? fv : 0.5 * (fv + hv);
      const gap = hv === null ? null : fv - hv;
      out.push({ t, f: fv, h: hv, mid, gap });
    }
    return out;
  }, [grid, f, h]);

  let midMin = Infinity;
  let midMax = -Infinity;
  let yMin0 = Infinity;
  let yMax0 = -Infinity;
  let gapMax = 0;

  for (const p of ys) {
    yMin0 = Math.min(yMin0, p.f);
    yMax0 = Math.max(yMax0, p.f);
    if (p.h !== null) {
      yMin0 = Math.min(yMin0, p.h);
      yMax0 = Math.max(yMax0, p.h);
      gapMax = Math.max(gapMax, Math.max(0, p.f - p.h));
      midMin = Math.min(midMin, p.mid);
      midMax = Math.max(midMax, p.mid);
    } else {
      midMin = Math.min(midMin, p.f);
      midMax = Math.max(midMax, p.f);
    }
  }

  if (!isFinite(yMin0) || !isFinite(yMax0) || yMax0 - yMin0 < 1e-12) {
    yMin0 = 0;
    yMax0 = 1;
  }
  if (!isFinite(midMin) || !isFinite(midMax) || midMax - midMin < 1e-12) {
    midMin = yMin0;
    midMax = yMax0;
  }

  const midRange = Math.max(midMax - midMin, 1e-12);
  const basePad = 0.01 * midRange;
  const gapPad = h ? Math.max(gapMax * 0.01, basePad) : 0.1 * (yMax0 - yMin0);

  const yMin = (h ? midMin : yMin0) - gapPad;
  const yMax = (h ? midMax : yMax0) + gapPad;

  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xScale = (t: number) => padL + ((t + 1) * innerW) / (tMax + 1);
  const yScale = (y: number) => padT + ((yMax - y) * innerH) / Math.max(yMax - yMin, 1e-12);

  const fPath = ys
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.t).toFixed(2)} ${yScale(p.f).toFixed(2)}`)
    .join(" ");

  const hPath =
    h &&
    ys
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.t).toFixed(2)} ${yScale(p.h as number).toFixed(2)}`)
      .join(" ");

  const nx = 6;
  const ny = 5;

  const xTicks = Array.from({ length: nx + 1 }, (_, i) => {
    const t = -1 + ((tMax + 1) * i) / nx;
    return {
      value: t,
      x: xScale(t),
      label: t.toFixed(2),
    };
  });

  const yTicks = Array.from({ length: ny + 1 }, (_, j) => {
    const v = yMin + ((yMax - yMin) * (ny - j)) / ny;
    return {
      value: v,
      y: yScale(v),
      label: Math.abs(v) >= 1000 || (Math.abs(v) > 0 && Math.abs(v) < 1e-3)
        ? v.toExponential(1)
        : v.toFixed(2),
    };
  });

  const autoTouch = useMemo(() => {
    if (!h) return [];

    const arr = ys
      .map((p) => ({ t: p.t, gap: p.gap ?? Infinity }))
      .filter((p) => isFinite(p.gap))
      .sort((a, b) => a.t - b.t);

    if (arr.length === 0) return [];

    const minGap = Math.min(...arr.map((p) => p.gap));
    const maxGap = Math.max(...arr.map((p) => p.gap));

    const tolAbs = 5e-6;
    const tolRel = 0.01 * Math.max(maxGap, 1e-12);
    const thr = Math.max(tolAbs, minGap + tolRel);

    const cand = arr.filter((p) => p.gap <= thr);
    if (cand.length === 0) return [];

    const clusters: Array<{ t: number; gap: number }> = [];
    const epsT = 0.01;

    let cur: { t: number; gap: number }[] = [];
    for (const p of cand) {
      if (cur.length === 0) {
        cur.push(p);
      } else {
        const prev = cur[cur.length - 1];
        if (Math.abs(p.t - prev.t) <= epsT) {
          cur.push(p);
        } else {
          cur.sort((a, b) => a.gap - b.gap);
          clusters.push(cur[0]);
          cur = [p];
        }
      }
    }
    if (cur.length > 0) {
      cur.sort((a, b) => a.gap - b.gap);
      clusters.push(cur[0]);
    }

    clusters.sort((a, b) => a.t - b.t);
    return clusters.slice(0, 10);
  }, [h, ys]);

  const autoTouchLabelPos = useMemo(() => {
    if (!h) return [];
    return autoTouch.map((sp, i) => {
      const tt = Math.min(sp.t, tMax);
      const fx = f(tt);
      const x = xScale(tt);
      const y = yScale(fx);

      const x2 = Math.min(W - padR, x + 12);
      const y2 = Math.max(padT, y - 14);

      const tex = `t\\approx ${tt.toFixed(6)}`;
      return {
        key: `${i}-${tt.toFixed(6)}`,
        leftPct: (x2 / W) * 100,
        topPct: (y2 / H) * 100,
        tex,
      };
    });
  }, [autoTouch, h, f, tMax, W, H]);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border bg-white">
        {/* grid */}
        <g opacity="1">
          {xTicks.map((tick, i) => (
            <line
              key={`gx${i}`}
              x1={tick.x}
              y1={padT}
              x2={tick.x}
              y2={H - padB}
              stroke="black"
              opacity="0.06"
            />
          ))}
          {yTicks.map((tick, j) => (
            <line
              key={`gy${j}`}
              x1={padL}
              y1={tick.y}
              x2={W - padR}
              y2={tick.y}
              stroke="black"
              opacity="0.06"
            />
          ))}
        </g>

        {/* axes */}
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="black" opacity="0.18" />
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="black" opacity="0.18" />

        {/* x tick labels */}
        {xTicks.map((tick, i) => (
          <g key={`xt${i}`}>
            <line
              x1={tick.x}
              y1={H - padB}
              x2={tick.x}
              y2={H - padB + 4}
              stroke="black"
              opacity="0.25"
            />
            <text
              x={tick.x}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize={10}
              fill="black"
              opacity="0.75"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* y tick labels */}
        {yTicks.map((tick, i) => (
          <g key={`yt${i}`}>
            <line
              x1={padL - 4}
              y1={tick.y}
              x2={padL}
              y2={tick.y}
              stroke="black"
              opacity="0.25"
            />
            <text
              x={padL - 7}
              y={tick.y + 3}
              textAnchor="end"
              fontSize={10}
              fill="black"
              opacity="0.75"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* axis labels */}
        <text
          x={(padL + (W - padR)) / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize={11}
          fill="black"
          opacity="0.75"
        >
          t
        </text>
        <text
          x={14}
          y={(padT + (H - padB)) / 2}
          textAnchor="middle"
          fontSize={11}
          fill="black"
          opacity="0.75"
          transform={`rotate(-90 14 ${(padT + (H - padB)) / 2})`}
        >
          value
        </text>

        {/* f(t) */}
        <path d={fPath} fill="none" stroke="black" strokeWidth="1.7" opacity="0.85" />

        {/* h(t) */}
        {h && <path d={hPath as string} fill="none" stroke="#0ea5e9" strokeWidth="2.0" opacity="0.95" />}

        {/* active constraint markers */}
        {h &&
          activeTs.map((t, idx) => {
            const tt = Math.min(t, tMax);
            const fx = f(tt);
            const hx = evalH(tt, h);
            return (
              <g key={idx}>
                <circle cx={xScale(tt)} cy={yScale(fx)} r={2.1} fill="black" opacity={0.45} />
                <circle cx={xScale(tt)} cy={yScale(hx)} r={2.1} fill="#0ea5e9" opacity={0.75} />
              </g>
            );
          })}

        {/* near tangency markers */}
        {h &&
          autoTouch.map((sp, i) => {
            const tt = Math.min(sp.t, tMax);
            const fx = f(tt);
            return (
              <g key={`touch-${i}`}>
                <circle
                  cx={xScale(tt)}
                  cy={yScale(fx)}
                  r={5.0}
                  fill="white"
                  stroke="black"
                  strokeWidth="1.4"
                  opacity={0.95}
                />
              </g>
            );
          })}
      </svg>

      {h &&
        autoTouchLabelPos.map((p) => (
          <div
            key={p.key}
            className="pointer-events-none absolute text-[11px] text-black"
            style={{ left: `${p.leftPct}%`, top: `${p.topPct}%` }}
          >
            <MathTex tex={p.tex} block={false} />
          </div>
        ))}
    </div>
  );
}

function formatNumber(x: number, digits = 6) {
  if (!isFinite(x)) return "NaN";
  if (x === 0) return "0";

  const ax = Math.abs(x);
  if (ax >= 1000 || ax < 1e-4) return x.toExponential(3);

  let s = x.toFixed(digits);
  s = s.replace(/\.?0+$/, "");
  if (s === "-0") s = "0";
  return s;
}

function potentialToTex(pot: Potential): string {
  switch (pot.kind) {
    case "riesz":
      return `f(t)=(2-2t)^{-\\frac{${formatNumber(pot.s, 4)}}{2}}`;
    case "log":
      return `f(t)=-\\frac{1}{2}\\log(2-2t)`;
    case "power":
      return `f(t)=-(2-2t)^{\\frac{${formatNumber(pot.p, 4)}}{2}}`;
    case "pframe":
      return `f(t)=|t|^{${formatNumber(pot.p, 4)}}`;
  }
}

function formatCoeff(x: number, digits = 8) {
  if (!isFinite(x)) return "NaN";
  if (x === 0) return "0";

  let s = x.toFixed(digits);
  s = s.replace(/\.?0+$/, "");
  if (s === "-0") s = "0";
  return s;
}

function hToTex(h: number[] | null): string {
  if (!h || h.length === 0) {
    return `h(t)=\\text{(run LP to display coefficients)}`;
  }

  const eps = 1e-8;
  const terms: string[] = [];

  for (let k = 0; k < h.length; k++) {
    const c = h[k];
    if (!isFinite(c) || Math.abs(c) < eps) continue;

    const absStr = formatCoeff(Math.abs(c), 8);

    let basis = "";
    if (k === 0) basis = "";
    else if (k === 1) basis = "P_1(t)";
    else basis = `P_${k}(t)`;

    let piece = "";
    if (k === 0) {
      piece = absStr;
    } else if (absStr === "1") {
      piece = basis;
    } else {
      piece = `${absStr}${basis}`;
    }

    if (terms.length === 0) {
      terms.push(c < 0 ? `-${piece}` : piece);
    } else {
      terms.push(c < 0 ? `- ${piece}` : `+ ${piece}`);
    }
  }

  if (terms.length === 0) return `h(t)=0`;
  return `h(t)=${terms.join(" ")}`;
}

export default function BoundPanel() {
  const pot = useSimStore((s) => s.pot);
  const N = useSimStore((s) => s.N);
  const nearConverged = useSimStore((s) => s.nearConverged);
  const energy = useSimStore((s) => s.energy);

  const [deg, setDeg] = useState(10);
  const [initM, setInitM] = useState(200);
  const [checkM, setCheckM] = useState(2000);
  const [tol, setTol] = useState(1e-6);

  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [h, setH] = useState<number[] | null>(null);
  const [boundValue, setBoundValue] = useState<number | null>(null);
  const [maxViolation, setMaxViolation] = useState<number | null>(null);
  const [activeTs, setActiveTs] = useState<number[]>([]);
  const [iterHist, setIterHist] = useState<
    Array<{ iter: number; boundValue: number; maxViolation: number; newT?: number }>
  >([]);

  const formula = useMemo(() => {
    return `h(t)=\\sum_{k=0}^{d} h_k\\,P_k(t),\\quad h_k\\ge 0\\ (k\\ge 1),\\quad h(t)\\le f(t)\\ \\forall t\\in[-1,1).`;
  }, []);

  const fTex = useMemo(() => potentialToTex(pot), [pot]);
  const hTex = useMemo(() => hToTex(h), [h]);

  async function runLP() {
    setRunning(true);
    setErr(null);
    try {
      const tMax = pot.kind === "riesz" ? 0.95 : 1 - 1e-6;
      const res = await cuttingPlaneLP({
        pot,
        N,
        d: deg,
        initM,
        checkM,
        tol,
        maxIter: 25,
        tMax,
      });

      if (!res.ok || !res.res) throw new Error(res.err ?? "LP failed");

      const sol = res.res.sol;
      setH(sol.h);
      setBoundValue(sol.boundValue);
      setMaxViolation(sol.maxViolation);
      setActiveTs(sol.activeTs);
      setIterHist(res.res.history);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="h-full w-full overflow-auto p-4 pb-20">
      <div className="mb-3">
        <div className="text-lg font-semibold">Delsarte-Yudin&apos;s Linear Programming Bound</div>
        <div className="text-sm text-gray-600">
          Compute an auxiliary function h(t) to lower-bound energy for |X| = N on the sphere.
        </div>
      </div>

      <div className="mb-4 rounded-lg border bg-white p-3">
        <div className="text-sm font-medium">
          Current potential: <span className="font-mono">{pot.kind}</span>, N = <span className="font-mono">{N}</span>
        </div>

        <div className="mt-2 text-sm text-gray-700">
          <MathTex tex={formula} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <NumberControl
            label="degree d"
            value={deg}
            onChange={(v) => setDeg(clampNumber(v, 1, 20))}
            step={1}
            min={1}
            max={20}
            integer
          />

          <NumberControl
            label="init grid m"
            value={initM}
            onChange={(v) => setInitM(clampNumber(v, 50, 2000))}
            step={10}
            min={50}
            max={2000}
            integer
          />

          <NumberControl
            label="check grid M"
            value={checkM}
            onChange={(v) => setCheckM(clampNumber(v, 200, 10000))}
            step={50}
            min={200}
            max={10000}
            integer
          />

          <NumberControl
            label="tol"
            value={tol}
            onChange={(v) => setTol(clampNumber(v, 1e-8, 1))}
            step={1e-7}
            min={1e-8}
            max={1}
            integer={false}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
            onClick={runLP}
            disabled={running}
          >
            {running ? "Running..." : "Run LP"}
          </button>

          {!nearConverged && <div className="text-xs text-gray-500">Tip: You can run anytime.</div>}
        </div>

        {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
      </div>

      <div className="mb-4 rounded-lg border bg-white p-3">
        <div className="space-y-2 text-sm text-gray-800">
          <div className="overflow-x-auto">
            <MathTex tex={fTex} />
          </div>
          <div className="overflow-x-auto">
            <MathTex tex={hTex} />
          </div>
        </div>

        <div className="mt-2 text-[11px] text-gray-600">
          {h ? (
            <>
              Auto tangency markers use{" "}
              <span className="font-mono">gap(t)=f(t)−h(t) ≤ thr</span>,{" "}
              <span className="font-mono">thr=max(5e−6, minGap + 0.01·maxGap)</span>{" "}
              (dense grid + clustering).
            </>
          ) : (
            <>Run LP to show h(t) and auto tangency markers.</>
          )}
        </div>

        <div className="mt-2">
          <Plot pot={pot} N={N} h={h} activeTs={activeTs} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="inline-block h-[2px] w-6 bg-black" />
            <span>f(t)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-[2px] w-6 bg-sky-500" />
            <span>h(t)</span>
          </div>
          <div>Dots show values at active constraint points.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm font-medium">Bound summary</div>
          <div className="mt-2 text-sm text-gray-700">
            Actual energy (current configuration): <span className="font-mono">{energy.toFixed(6)}</span>
          </div>
          <div className="mt-1 text-sm text-gray-700">
            LP bound value: <span className="font-mono">{boundValue === null ? "—" : boundValue.toFixed(6)}</span>
          </div>
          <div className="mt-1 text-sm text-gray-700">
            Max violation max(h−f):{" "}
            <span className="font-mono">{maxViolation === null ? "—" : maxViolation.toExponential(3)}</span>
          </div>

          {boundValue !== null && (
            <div className="mt-2 text-xs text-gray-500">
              (For the theorem form you stated: compare the inequality direction you intend—this UI reports the objective{" "}
              <span className="font-mono">N²h₀ − N h(1)</span>.)
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-white p-3">
          <div className="text-sm font-medium">Cutting-plane Method</div>
          <div className="mt-2 max-h-[260px] overflow-auto">
            <table className="w-full border-collapse text-[11px] font-mono">
              <thead>
                <tr>
                  <th className="border px-2 py-1 text-left">iter</th>
                  <th className="border px-2 py-1 text-left">bound</th>
                  <th className="border px-2 py-1 text-left">max(h−f)</th>
                  <th className="border px-2 py-1 text-left">new t</th>
                </tr>
              </thead>
              <tbody>
                {iterHist.map((r) => (
                  <tr key={r.iter}>
                    <td className="border px-2 py-1">{r.iter}</td>
                    <td className="border px-2 py-1">{r.boundValue.toFixed(4)}</td>
                    <td className="border px-2 py-1">{r.maxViolation.toExponential(2)}</td>
                    <td className="border px-2 py-1">{r.newT === undefined ? "" : r.newT.toFixed(6)}</td>
                  </tr>
                ))}
                {iterHist.length === 0 && (
                  <tr>
                    <td className="border px-2 py-2 text-gray-500" colSpan={4}>
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}