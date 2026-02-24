// src/components/GramMatrixPanel.tsx
"use client";

import { useMemo } from "react";
import { analyzeStructure, gramMatrix, type Vec3 } from "../lib/structure";

function fmt(x: number) {
  if (Math.abs(x) < 5e-13) return "0";
  return x.toFixed(6);
}

export default function GramMatrixPanel({ points, tol = 2e-3 }: { points: Vec3[]; tol?: number }) {
  const info = useMemo(() => analyzeStructure(points, tol), [points, tol]);
  const G = useMemo(() => gramMatrix(points), [points]);

  const n = points.length;
  const showN = Math.min(n, 20); // preview size

  return (
    <div className="h-full w-full overflow-auto p-4">
      <div className="mb-3">
        <div className="text-lg font-semibold">Gram matrix & distance layers</div>
        <div className="text-sm text-gray-600">Gᵢⱼ = ⟨xᵢ, xⱼ⟩, clustered to detect k-distance structure</div>
      </div>

      <div className="mb-4 rounded-lg border bg-white p-3">
        <div className="text-sm">
          k-distance (by ⟨xᵢ,xⱼ⟩ clustering): <span className="font-semibold">{info.layer.k}</span>{" "}
          <span className="text-gray-500">(tol={info.layer.tol})</span>
        </div>
        <div className="mt-1 text-xs text-gray-700">
          centers: <span className="font-mono">{info.layer.centers.map(fmt).join(", ")}</span>
        </div>
        <div className="mt-1 text-xs text-gray-700">
          pair counts: <span className="font-mono">[{info.layer.counts.join(", ")}]</span>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-3">
        <div className="mb-2 flex items-baseline justify-between">
          <div className="font-medium">Gram matrix preview</div>
          <div className="text-xs text-gray-500">
            showing {showN}×{showN} of {n}×{n}
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

        {n > showN && (
          <div className="mt-2 text-xs text-gray-500">
            Tip: later we can add “Copy full Gram (CSV)” / “Download JSON” buttons.
          </div>
        )}
      </div>
    </div>
  );
}
