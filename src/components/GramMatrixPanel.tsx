// src/components/GramMatrixPanel.tsx
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

export default function GramMatrixPanel({ points, tol = 2e-3 }: { points: Vec3[]; tol?: number }) {
  const nearConverged = useSimStore((s) => s.nearConverged);

  const info = useMemo(() => analyzeStructure(points, tol), [points, tol]);
  const G = useMemo(() => gramMatrix(points), [points]);

  const nPts = points.length;
  const showN = Math.min(nPts, 20); // preview size

  // ---- t-design computation (only when nearConverged) ----
  const design = useMemo(() => {
    if (!nearConverged) return null;
    // You can tune these:
    const Kmax = 20;
    const tolDesign = 1e-6;

    const { dim, sk } = computeDesignSums(points as unknown as number[][], Kmax);
    const t = estimateDesignStrength(sk, tolDesign);

    return { dim, Kmax, tolDesign, sk, t };
  }, [nearConverged, points]);

  return (
    <div className="h-full w-full overflow-auto p-4">
      <div className="mb-3">
        <div className="text-lg font-semibold">Distance, Strength, and Gram Matrix</div>
        <div className="text-sm text-gray-600">
          Gᵢⱼ = ⟨xᵢ, xⱼ⟩, clustered to detect m-distance structure
        </div>
      </div>

      {/* m-distance summary */}
      <div className="mb-4 rounded-lg border bg-white p-3">
        <div className="text-sm">
          m-distance set (by ⟨xᵢ,xⱼ⟩ clustering):{" "}
          <span className="font-semibold">{info.layer.k}</span>{" "}
          <span className="text-gray-500">(tol={info.layer.tol})</span>
        </div>
        <div className="mt-1 text-xs text-gray-700">
          centers: <span className="font-mono">{info.layer.centers.map(fmt).join(", ")}</span>
        </div>
        <div className="mt-1 text-xs text-gray-700">
          pair counts: <span className="font-mono">[{info.layer.counts.join(", ")}]</span>
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
              <span className="font-semibold">t ≈ {design.t}</span>{" "}
              <span className="text-gray-500">(dim = {design.dim})</span>
            </div>
            <div className="mt-2 text-[11px] text-gray-700">
              We compute{" "}
              <MathTex
                tex={`s_k = \\frac{1}{|X|^2}\\sum_{x,y\\in X} G_k^{(${design.dim})}(\\langle x,y\\rangle)`}
                block={false}
              />
              {" "}
              for k = 1,...,{design.Kmax}, and mark those with |sₖ| ≤ {design.tolDesign}.
            </div>


            <div className="mt-2 overflow-auto">
              <table className="border-collapse text-[11px] font-mono">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left">k</th>
                    <th className="border px-2 py-1 text-left">s_k</th>
                    <th className="border px-2 py-1 text-left">≈0?</th>
                  </tr>
                </thead>
                <tbody>
                  {design.sk.map((v, i) => {
                    const k = i + 1;
                    const ok = Math.abs(v) <= design.tolDesign;
                    return (
                      <tr key={k}>
                        <td className="border px-2 py-1">{k}</td>
                        <td className="border px-2 py-1">{v.toExponential(3)}</td>
                        <td className="border px-2 py-1">{ok ? "✅" : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
