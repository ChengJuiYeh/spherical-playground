// src/components/EnergyChart.tsx
"use client";

type HistoryPoint = { step: number; energy: number; minDist: number };

function buildPolyline(
  values: number[],
  width: number,
  height: number,
  pad: number
) {
  const vMin = Math.min(...values);
  let vMax = Math.max(...values);
  if (vMax - vMin < 1e-12) vMax = vMin + 1;

  const xScale = (i: number) => pad + (i * (width - 2 * pad)) / (values.length - 1);
  const yScale = (v: number) => pad + ((vMax - v) * (height - 2 * pad)) / (vMax - vMin);

  const pointsStr = values
    .map((v, i) => `${xScale(i).toFixed(2)},${yScale(v).toFixed(2)}`)
    .join(" ");

  return { pointsStr, vMin, vMax, xScale, yScale };
}

export default function EnergyChart({
  history,
  onClear,
  width = 320,
  height = 130,
}: {
  history: HistoryPoint[];
  onClear: () => void;
  width?: number;
  height?: number;
}) {
  if (!history || history.length < 2) {
    return (
      <div className="w-full">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-medium">Energy & minDist vs step</div>
          <button
            className="rounded border px-2 py-1 text-xs"
            onClick={onClear}
          >
            Clear history
          </button>
        </div>
        <div className="text-xs text-gray-500">Not enough data yet.</div>
      </div>
    );
  }

  const pad = 10;
  const w = width;
  const h = height;

  const energies = history.map((p) => p.energy);
  const dists = history.map((p) => p.minDist);

  const E = buildPolyline(energies, w, h, pad);
  const D = buildPolyline(dists, w, h, pad);

  const last = history[history.length - 1];

  return (
    <div className="w-full">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-medium">Energy & minDist vs step</div>
        <button
          className="rounded border px-2 py-1 text-xs"
          onClick={onClear}
        >
          Clear history
        </button>
      </div>

      <div className="mb-1 flex justify-between text-[11px] text-gray-600">
        <span>E={last.energy.toFixed(4)}</span>
        <span>d_min={last.minDist.toFixed(4)}</span>
        <span>step {last.step}</span>
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full rounded border bg-white"
        preserveAspectRatio="none"
      >
        {/* axes */}
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="black" strokeOpacity="0.12" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="black" strokeOpacity="0.12" />

        {/* Energy curve (black) */}
        <polyline
          fill="none"
          stroke="black"
          strokeOpacity="0.75"
          strokeWidth="1.6"
          points={E.pointsStr}
        />

        {/* minDist curve (teal/blue) */}
        <polyline
          fill="none"
          stroke="#0ea5e9"
          strokeOpacity="0.85"
          strokeWidth="1.6"
          points={D.pointsStr}
        />

        {/* last markers */}
        <circle
          cx={E.xScale(energies.length - 1)}
          cy={E.yScale(last.energy)}
          r="2.2"
          fill="black"
          fillOpacity="0.75"
        />
        <circle
          cx={D.xScale(dists.length - 1)}
          cy={D.yScale(last.minDist)}
          r="2.2"
          fill="#0ea5e9"
          fillOpacity="0.85"
        />
      </svg>

      <div className="mt-1 grid grid-cols-2 gap-x-2 text-[11px] text-gray-600">
        <div>
          E range: [{E.vMin.toFixed(3)}, {E.vMax.toFixed(3)}]
        </div>
        <div className="text-right">
          d range: [{D.vMin.toFixed(3)}, {D.vMax.toFixed(3)}]
        </div>
      </div>

      <div className="mt-1 flex gap-3 text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[2px] w-4 bg-black opacity-70" />
          Energy
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-[2px] w-4" style={{ background: "#0ea5e9", opacity: 0.85 }} />
          minDist
        </span>
      </div>
    </div>
  );
}
