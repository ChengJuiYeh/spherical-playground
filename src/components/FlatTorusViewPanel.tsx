"use client";

import { useMemo } from "react";
import type { Vec2 } from "../lib/torus_sim";
import { periodicCopies3x3 } from "../lib/torus_sim";

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

type Props = {
  tab: "torus" | "gram";
  points: Vec2[];
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
};

export default function FlatTorusViewPanel({
  tab,
  points,
  zoom,
  setZoom,
}: Props) {
  const W = 1000;
  const H = 1000;

  const baseWorldSize = 4.5;
  const worldW = baseWorldSize / zoom;
  const worldH = baseWorldSize / zoom;

  const center: Vec2 = [0.5, 0.5];

  const xMin = center[0] - worldW / 2;
  const xMax = center[0] + worldW / 2;
  const yMin = center[1] - worldH / 2;
  const yMax = center[1] + worldH / 2;

  const worldToScreen = (p: Vec2): Vec2 => {
    const x = ((p[0] - xMin) / (xMax - xMin)) * W;
    const y = H - ((p[1] - yMin) / (yMax - yMin)) * H;
    return [x, y];
  };

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => clamp(z * factor, 0.5, 3));
  }

  const copies = useMemo(() => periodicCopies3x3(points), [points]);

  const tiles = useMemo(() => {
    const out: Array<{ x: number; y: number; central: boolean }> = [];
    for (let j = -2; j <= 2; j++) {
      for (let i = -2; i <= 2; i++) {
        out.push({ x: i, y: j, central: i === 0 && j === 0 });
      }
    }
    return out;
  }, []);

  if (tab === "gram") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        Gram panel coming soon
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        onWheel={onWheel}
      >
        {tiles.map((tile) => {
          const a = worldToScreen([tile.x, tile.y + 1]);
          const b = worldToScreen([tile.x + 1, tile.y]);

          return (
            <rect
              key={`${tile.x}-${tile.y}`}
              x={a[0]}
              y={a[1]}
              width={b[0] - a[0]}
              height={b[1] - a[1]}
              fill={tile.central ? "rgba(14,165,233,0.04)" : "rgba(0,0,0,0.015)"}
              stroke="black"
              strokeWidth={tile.central ? 2 : 1}
              opacity={tile.central ? 0.8 : 0.15}
            />
          );
        })}

        {copies.map((obj) => {
          const [sx, sy] = worldToScreen(obj.point);

          return (
            <circle
              key={`${obj.baseIndex}-${obj.shift[0]}-${obj.shift[1]}`}
              cx={sx}
              cy={sy}
              r={obj.isCentral ? 7 : 5}
              fill={obj.isCentral ? "#0ea5e9" : "#0ea5e955"}
              stroke={obj.isCentral ? "black" : "none"}
            />
          );
        })}
      </svg>
    </div>
  );
}