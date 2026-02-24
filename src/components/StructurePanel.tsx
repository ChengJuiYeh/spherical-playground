// src/components/StructurePanel.tsx
"use client";

import { useMemo } from "react";
import { analyzeStructure, degreeSummary, type Vec3 } from "../lib/structure";

export default function StructurePanel({
  points,
  tol = 2e-3,
}: {
  points: Vec3[];
  tol?: number;
}) {
  const info = useMemo(() => analyzeStructure(points, tol), [points, tol]);

  const { layer, contact } = info;
  const deg = degreeSummary(contact.degrees);

  const freqStr = Array.from(deg.freq.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([d, c]) => `${d}×${c}`)
    .join(", ");

  const m = contact.edges.length;

  // pretty inner product centers
  const centersStr = layer.centers
    .map((c) => (Math.abs(c) < 1e-12 ? "0" : c.toFixed(6)))
    .join(", ");

  return (
    <div className="w-full">
      <div className="mb-1 text-sm font-medium">Structure (Gram/Distances)</div>

      <div className="text-[11px] text-gray-700">
        <div>
          k-distance (by ⟨xᵢ,xⱼ⟩ clustering):{" "}
          <span className="font-semibold">{layer.k}</span>{" "}
          <span className="text-gray-500">(tol={layer.tol})</span>
        </div>
        <div className="mt-1">
          centers:{" "}
          <span className="font-mono text-[10px]">{centersStr}</span>
        </div>
        <div className="mt-1">
          pair counts:{" "}
          <span className="font-mono text-[10px]">
            [{layer.counts.join(", ")}]
          </span>
        </div>
      </div>

      <div className="mt-3 border-t pt-2">
        <div className="mb-1 text-sm font-medium">Contact graph</div>
        <div className="text-[11px] text-gray-700">
          <div>
            n = {contact.n}, m = {m}
          </div>
          <div className="mt-1">
            degree multiset:{" "}
            <span className="font-mono text-[10px]">{freqStr || "—"}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-gray-500">
        Contact edges = pairs in the <span className="font-semibold">max</span>{" "}
        inner-product layer (closest distance).
      </div>
    </div>
  );
}
