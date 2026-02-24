// src/components/ContactGraphPanel.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import { analyzeStructure, degreeSummary, type Vec3 } from "../lib/structure";
import SphericalGraphScene from "@/components/SphericalGraphScene";

function polarLayout(n: number, r: number, cx: number, cy: number) {
  const pos: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * i) / n - Math.PI / 2; // start at top
    pos.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }
  return pos;
}

export default function ContactGraphPanel({
  points,
  tol = 2e-3,
}: {
  points: Vec3[];
  tol?: number;
}) {
  const info = useMemo(() => analyzeStructure(points, tol), [points, tol]);
  const { contact } = info;

  const deg = degreeSummary(contact.degrees);
  const freqStr = Array.from(deg.freq.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([d, c]) => `${d}×${c}`)
    .join(", ");

  // --- SVG sizing ---
  const W = 760;
  const H = 520;
  const pad = 28;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(W, H) * 0.38;

  const pos = useMemo(() => polarLayout(contact.n, r, cx, cy), [contact.n, r, cx, cy]);

  // --- Simple interaction: hover a vertex to highlight its incident edges ---
  const [hoverV, setHoverV] = useState<number | null>(null);

  const [autOrder, setAutOrder] = useState<number | null>(null);
  const [autGens, setAutGens] = useState<number | null>(null);
  const [autOrbits, setAutOrbits] = useState<any>(null);
  const [autLoading, setAutLoading] = useState(false);
  const [autErr, setAutErr] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState(0);

  // 用來避免 graph 沒變卻重算
  const graphKey = useMemo(() => {
    // order-independent key: edges already i<j; join should be stable
    return `${contact.n}|${contact.edges.map(([i, j]) => `${i}-${j}`).join(",")}`;
  }, [contact.n, contact.edges]);

  async function computeAut() {
    setAutLoading(true);
    setAutErr(null);
    try {
      const res = await fetch("/api/autgroup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: contact.n, edges: contact.edges }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "API error");

      setAutOrder(typeof data.order === "number" ? data.order : null);
      setAutGens(typeof data.num_generators === "number" ? data.num_generators : null);
      setAutOrbits(data.orbits ?? null);
    } catch (e: any) {
      setAutErr(e?.message ?? "Unknown error");
      setAutOrder(null);
      setAutGens(null);
      setAutOrbits(null);
    } finally {
      setAutLoading(false);
    }
  }

  // ✅（可選）當 graphKey 改變就自動算一次
  useEffect(() => {
    setAutOrder(null);
    setAutGens(null);
    setAutOrbits(null);
    setAutErr(null);
    // 你想自動就取消下一行註解：
    // computeAut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphKey]);

  useEffect(() => {
    const k = info.layers?.centers?.length ?? 0;
    if (k > 0 && selectedLayer >= k) setSelectedLayer(0);
  }, [info.layers?.centers?.length, selectedLayer]);

  const layers = info.layers; // { centers, edgesByLayer }
  // If n is big, drawing all edges may be visually dense; still okay up to a few hundred.
  const n = contact.n;
  const m = contact.edges.length;


  return (
    <div className="h-full w-full">
      <div className="grid h-full grid-cols-[1fr_340px] gap-4 p-4">
        {/* CENTER: main sphere */}
        <div className="rounded-lg border bg-white overflow-hidden">
          <SphericalGraphScene
            edgesByLayer={layers.edgesByLayer}
            selectedLayer={selectedLayer}
            hoverVertex={hoverV}
            onHoverVertex={setHoverV}
          />
        </div>

        {/* RIGHT: sidebar */}
        <div className="space-y-4">
          {/* summary card (原本左上 contact graph info) */}
          <div className="rounded-lg border bg-white p-3">
            <div className="text-lg font-semibold">Contact / Layered graph</div>
            <div className="text-sm text-gray-600">
              hover a vertex → show edges in the selected distance layer
            </div>

            <div className="mt-3 text-sm">
              n = <span className="font-semibold">{contact.n}</span>, m(contact) ={" "}
              <span className="font-semibold">{contact.edges.length}</span>
            </div>

            <div className="mt-1 text-sm">
              layers k = <span className="font-semibold">{layers.centers.length}</span>
            </div>

            <div className="mt-2 text-xs text-gray-700">
              selected layer:{" "}
              <span className="font-mono">{selectedLayer}</span>{" "}
              (ip ≈{" "}
              <span className="font-mono">
                {layers.centers[selectedLayer]?.toFixed(6)}
              </span>
              )
            </div>

            <div className="mt-1 text-xs text-gray-500">
              hover vertex: {hoverV === null ? "—" : hoverV}
            </div>
          </div>

          {/* layer selector card (原本右上 floating bar) */}
          <div className="rounded-lg border bg-white p-3">
            <div className="mb-2 text-sm font-medium">Distance layer</div>

            <div className="space-y-1 max-h-[420px] overflow-auto pr-1">
              {layers.centers.map((c, idx) => {
                const isActive = idx === selectedLayer;
                const edgeCount = layers.edgesByLayer[idx]?.length ?? 0;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedLayer(idx)}
                    className={[
                      "w-full rounded px-2 py-1 text-left text-xs font-mono",
                      isActive ? "bg-black text-white" : "bg-white hover:bg-gray-100",
                    ].join(" ")}
                  >
                    #{idx}  ip≈{c.toFixed(4)}  (|E|={edgeCount})
                  </button>
                );
              })}
            </div>

            <div className="mt-2 text-[11px] text-gray-600">
              Tip: larger ip = shorter distance.
            </div>
          </div>

          {/* 之後要加 Aut_layers / Aut_geom / orbits / stabilizer 就放這裡 */}
        </div>
      </div>
    </div>
  );
}
