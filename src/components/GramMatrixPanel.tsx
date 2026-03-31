"use client";

import { useMemo } from "react";
import { analyzeStructure, gramMatrix, type Vec3 } from "../lib/structure";
import { computeDesignSums, estimateDesignStrength } from "../lib/design";
import { useSimStore } from "../store/useSimStore";
import MathTex from "./MathTex";

function fmt(x: number) {
  if (Math.abs(x) < 5e-13) return "0";
  return x.toFixed(6);
}

function fmtSkTex(x: number) {
  if (Math.abs(x) < 5e-13) return "0";

  const ax = Math.abs(x);

  if (ax >= 1e-3 && ax < 1e3) {
    return x.toFixed(6).replace(/\.?0+$/, "");
  }

  const s = x.toExponential(3); // e.g. -1.234e-8
  const [mant, exp] = s.split("e");
  const e = Number(exp);
  return `${mant}\\times 10^{${e}}`;
}

function ZeroBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        ok
          ? "border-emerald-500 bg-emerald-200 text-emerald-900 shadow-sm"
          : "border-gray-300 bg-gray-100 text-gray-500"
      }`}
    >
      {ok ? "yes" : "no"}
    </span>
  );
}

export default function GramMatrixPanel({ points, tol = 2e-3 }: { points: Vec3[]; tol?: number }) {
  const nearConverged = useSimStore((s) => s.nearConverged);

  const info = useMemo(() => analyzeStructure(points, tol), [points, tol]);
  const G = useMemo(() => gramMatrix(points), [points]);

  const nPts = points.length;
  const showN = Math.min(nPts, 20);

  const design = useMemo(() => {
    if (!nearConverged) return null;

    const Kmax = 20;
    const tolDesign = 1e-6;

    const { dim, sk } = computeDesignSums(points as unknown as number[][], Kmax);
    const t = estimateDesignStrength(sk, tolDesign);

    return { dim, Kmax, tolDesign, sk, t };
  }, [nearConverged, points]);

  return (
    <div className="h-full w-full overflow-auto p-4 pb-20">
      <div className="mb-3">
        <div className="text-lg font-semibold">Distance, Strength, and Gram Matrix</div>
        <div className="text-sm text-gray-600">
          <MathTex tex={`G_{i,j} = \\langle x_i,x_j \\rangle`} block={false} />
          {", "}clustered to detect m-distance structure
        </div>
      </div>

      {/* m-distance summary */}
      <div className="mb-4 rounded-lg border bg-white p-3">
        <div className="text-sm">m-distance set</div>
        <div className="mt-1 text-xs text-gray-700">
          Number of distances m = <span className="font-semibold">{info.layer.k}</span>{" "}
          <span className="text-gray-700">(tol = {info.layer.tol})</span>
        </div>
        <div className="mt-1 text-xs text-gray-700">
          Inner products: <span className="font-mono">{info.layer.centers.map(fmt).join(", ")}</span>
        </div>
        <div className="mt-1 text-xs text-gray-700">
          Pair counts: <span className="font-mono">[{info.layer.counts.join(", ")}]</span>
        </div>
      </div>

      {/* t-design summary */}
      <div className="mb-4 rounded-lg border bg-white p-3">
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-sm font-medium">Spherical t-design</div>
          <div className="text-xs text-gray-500">
            {nearConverged ? "computed near convergence" : "shown near convergence only"}
          </div>
        </div>

        {!nearConverged && (
          <div className="text-xs text-gray-600">
            Waiting for near convergence (when hull appears)…
          </div>
        )}

        {design && (
          <>
            <div className="text-sm">
              Estimate the strength of the spherical code:{" "}
              <span className="font-semibold">t ≈ {design.t}</span>
            </div>

            <div className="mt-2 text-[11px] text-gray-700">
              We compute{" "}
              <MathTex
                tex={`s_k = \\frac{1}{|X|^2}\\sum_{x,y\\in X} G_k^{(${design.dim})}(\\langle x,y\\rangle)`}
                block={false}
              />{" "}
              for k = 1,...,{design.Kmax}, and mark those with{" "}
              <MathTex tex={`|s_k| \\le ${design.tolDesign}`} block={false} />.
            </div>

            {/* notation explanation moved above the cards */}
            <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border bg-white p-3 text-[11px] text-gray-700 md:grid-cols-3">
              <div>
                <div className="font-medium text-gray-800">
                  <MathTex tex={`k`} block={false} />
                </div>
                <div className="mt-1">degree index</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">
                  <MathTex tex={`s_k`} block={false} />
                </div>
                <div className="mt-1">design moment statistic</div>
              </div>
              <div>
                <div className="font-medium text-gray-800">
                  <MathTex tex={`s_k\\ \\text{ is almost zero}`} block={false} />
                </div>
                <div className="mt-1">
                  whether <MathTex tex={`|s_k|`} block={false} /> is below tolerance
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {design.sk.map((v, i) => {
                const k = i + 1;
                const ok = Math.abs(v) <= design.tolDesign;

                return (
                  <div
                    key={k}
                    className={`rounded-lg border px-3 py-2 shadow-sm ${
                      ok ? "border-emerald-300 bg-emerald-50/50" : "bg-gray-50"
                    }`}
                  >
                    <div className="grid grid-cols-[56px_1fr_auto] items-center gap-3">
                      <div className="text-xs text-gray-500">
                        <MathTex tex={`k=${k}`} block={false} />
                      </div>

                      <div className="text-sm text-gray-800">
                        <MathTex tex={fmtSkTex(v)} block={false} />
                      </div>

                      <ZeroBadge ok={ok} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Gram matrix preview */}
      <div className="rounded-lg border bg-white p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="font-medium">Gram matrix preview</div>
          <div className="text-xs text-gray-500">
            showing {showN}×{showN} of {nPts}×{nPts}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="border-collapse text-[11px] font-mono">
            <tbody>
              {Array.from({ length: showN }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: showN }, (_, j) => (
                    <td key={j} className="border px-2 py-1">
                      {fmt(G[i][j])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {nPts > showN && (
          <div className="mt-2 text-xs text-gray-500">
            Tip: later we can add “Copy full Gram (CSV)” / “Download JSON” buttons.
          </div>
        )}
      </div>
    </div>
  );
}