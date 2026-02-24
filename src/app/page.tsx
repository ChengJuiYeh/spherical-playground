// src/app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import ControlPanel from "@/components/ControlPanel";
import SphericalScene from "@/components/SphericalScene";
import { useSimStore } from "@/store/useSimStore";
import EnergyChart from "@/components/EnergyChart";
import StructurePanel from "@/components/StructurePanel";

import GramMatrixPanel from "@/components/GramMatrixPanel";
import ContactGraphPanel from "@/components/ContactGraphPanel";

export default function Home() {
  const running = useSimStore((s) => s.running);
  const stepsPerSecond = useSimStore((s) => s.stepsPerSecond);
  const singleStep = useSimStore((s) => s.singleStep);
  const history = useSimStore((s) => s.history);
  const clearHistory = useSimStore((s) => s.clearHistory);
  const nearConverged = useSimStore((s) => s.nearConverged);

  const [tab, setTab] = useState<"sphere" | "gram" | "graph">("sphere");
  const points = useSimStore((s) => s.points);

  // requestAnimationFrame loop
  const lastRef = useRef<number | null>(null);
  const accRef = useRef<number>(0);

  useEffect(() => {
    let rafId = 0;

    const tick = (t: number) => {
      if (lastRef.current === null) lastRef.current = t;
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;

      if (running) {
        accRef.current += dt * stepsPerSecond;

        // do integer number of steps accumulated
        const k = Math.floor(accRef.current);
        if (k > 0) {
          // cap per frame to avoid huge jumps if tab was inactive
          const kk = Math.min(k, 10);
          singleStep(kk);
          accRef.current -= kk;
        }
      } else {
        accRef.current = 0;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [running, stepsPerSecond, singleStep]);

  return (
    <div className="h-screen w-screen">
      <div className="grid h-full grid-cols-1 md:grid-cols-[360px_1fr]">
        <div className="border-r">
          <ControlPanel />
        </div>
        <div className="relative h-[60vh] md:h-full">
          {/* Main tab content */}
          <div className="absolute inset-0">
            {tab === "sphere" && <SphericalScene />}
            {tab === "gram" && <GramMatrixPanel points={points} tol={2e-3} />}
            {tab === "graph" && <ContactGraphPanel points={points} tol={2e-3} />}
          </div>

          {/* Energy chart overlay: only show on sphere tab (recommended) */}
          {tab === "sphere" && (
            <div className="pointer-events-none absolute right-4 top-4 w-[280px] max-w-[calc(100%-2rem)] rounded-lg border bg-white/85 p-2 shadow-sm backdrop-blur">
              <div className="pointer-events-auto">
                <EnergyChart history={history} onClear={clearHistory} width={260} height={95} />
              </div>
            </div>
          )}

          {/* Floating bottom tab bar */}
          <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="pointer-events-auto rounded-full border bg-white/90 px-2 py-1 shadow-sm backdrop-blur">
              <div className="flex gap-1">
                <button
                  className={`rounded-full px-3 py-1 text-sm ${
                    tab === "sphere" ? "bg-black text-white" : "hover:bg-gray-100"
                  }`}
                  onClick={() => setTab("sphere")}
                >
                  Sphere
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-sm ${
                    tab === "gram" ? "bg-black text-white" : "hover:bg-gray-100"
                  }`}
                  onClick={() => setTab("gram")}
                >
                  Gram
                </button>
                <button
                  className={`rounded-full px-3 py-1 text-sm ${
                    tab === "graph" ? "bg-black text-white" : "hover:bg-gray-100"
                  }`}
                  onClick={() => setTab("graph")}
                >
                  Graph
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
