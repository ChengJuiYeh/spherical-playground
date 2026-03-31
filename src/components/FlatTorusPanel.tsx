"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TorusPotential, Vec2 } from "../lib/torus_sim";
import {
  DEFAULT_TORUS_SOFTENING,
  energyAndMinDistOnFlatTorus,
  randomPointsOnFlatTorus,
  stepFlatTorusGD,
} from "../lib/torus_sim";
import FlatTorusControlPanel from "./FlatTorusControlPanel";
import FlatTorusViewPanel from "./FlatTorusViewPanel";

export default function FlatTorusPanel() {
  const [tab, setTab] = useState<"torus" | "gram">("torus");

  const [N, setN] = useState(24);
  const [eta, setEta] = useState(0.0003);
  const [stepsPerSec, setStepsPerSec] = useState(30);
  const softening = 0.001;

  const [potKind, setPotKind] = useState<"riesz" | "log" | "power">("riesz");
  const [rieszS, setRieszS] = useState(1);
  const [powerP, setPowerP] = useState(2);

  const pot: TorusPotential = useMemo(() => {
    if (potKind === "riesz") return { kind: "riesz", s: rieszS };
    if (potKind === "power") return { kind: "power", p: powerP };
    return { kind: "log" };
  }, [potKind, rieszS, powerP]);

  const [points, setPoints] = useState<Vec2[]>(() => randomPointsOnFlatTorus(24));
  const [running, setRunning] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [zoom, setZoom] = useState(1.0);

  const [{ energy, minDist }, setStats] = useState(() => {
    const { E, minD } = energyAndMinDistOnFlatTorus(
      points,
      pot,
      DEFAULT_TORUS_SOFTENING
    );
    return { energy: E, minDist: minD };
  });

  useEffect(() => {
    const { E, minD } = energyAndMinDistOnFlatTorus(points, pot, softening);
    setStats({ energy: E, minDist: minD });
  }, [points, pot, softening]);

  useEffect(() => {
    setPoints(randomPointsOnFlatTorus(N));
    setStepCount(0);
  }, [N]);

  useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setPoints((prev) => stepFlatTorusGD(prev, pot, eta, softening));
      setStepCount((s) => s + 1);
    }, Math.max(10, Math.round(1000 / stepsPerSec)));

    return () => window.clearInterval(interval);
  }, [running, pot, eta, softening, stepsPerSec]);

  function randomInit() {
    setPoints(randomPointsOnFlatTorus(N));
    setStepCount(0);
  }

  function oneStep() {
    setPoints((prev) => stepFlatTorusGD(prev, pot, eta, softening));
    setStepCount((s) => s + 1);
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="grid h-full grid-cols-[360px_1fr]">
        {/* left column: fully independent */}
        <div className="h-full overflow-y-auto border-r">
          <FlatTorusControlPanel
            N={N}
            setN={setN}
            eta={eta}
            setEta={setEta}
            stepsPerSec={stepsPerSec}
            setStepsPerSec={setStepsPerSec}
            softening={softening}
            potKind={potKind}
            setPotKind={setPotKind}
            rieszS={rieszS}
            setRieszS={setRieszS}
            powerP={powerP}
            setPowerP={setPowerP}
            pot={pot}
            running={running}
            setRunning={setRunning}
            stepCount={stepCount}
            energy={energy}
            minDist={minDist}
            zoom={zoom}
            setZoom={setZoom}
            oneStep={oneStep}
            randomInit={randomInit}
          />
        </div>

        {/* right column: fully independent */}
        <div className="relative h-full overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto p-4 pb-10">
            <FlatTorusViewPanel
              tab={tab}
              points={points}
              pot={pot}
              softening={softening}
              zoom={zoom}
              setZoom={setZoom}
            />
          </div>

          <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
            <div className="pointer-events-auto rounded-full border bg-white/90 px-2 py-1 shadow-sm backdrop-blur">
              <div className="flex items-center gap-1">
                <button
                  className={`rounded-full px-3 py-1 text-sm ${
                    tab === "torus" ? "bg-black text-white" : "hover:bg-gray-100"
                  }`}
                  onClick={() => setTab("torus")}
                >
                  Torus
                </button>

                <button
                  className={`rounded-full px-3 py-1 text-sm ${
                    tab === "gram" ? "bg-black text-white" : "hover:bg-gray-100"
                  }`}
                  onClick={() => setTab("gram")}
                >
                  Gram
                </button>

                <div className="mx-1 h-5 w-px bg-gray-300" />

                <Link
                  href="/"
                  className="rounded-full px-3 py-1 text-sm hover:bg-gray-100"
                >
                  Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}