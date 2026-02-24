// src/store/useSimStore.ts
"use client";

import { create } from "zustand";
import type { Potential, Vec3 } from "@/lib/sim";
import { energyAndMinDist, randomPointsOnSphere, stepProjectedGD } from "@/lib/sim";

type HistoryPoint = { step: number; energy: number; minDist: number };

type SimState = {
  N: number;
  points: Vec3[];
  running: boolean;
  step: number;

  eta: number;
  stepsPerSecond: number;
  pot: Potential;

  energy: number;
  minDist: number;

  nearConverged: boolean;
  _convergeStreak: number; // internal counter

  history: HistoryPoint[];
  historyEvery: number;   // 每幾步記一次
  historyMax: number;     // 最多保留幾筆

  // actions
  randomize: () => void;
  toggleRunning: () => void;
  singleStep: (k?: number) => void;
  setN: (n: number) => void;
  setEta: (eta: number) => void;
  setStepsPerSecond: (sps: number) => void;
  setPotential: (pot: Potential) => void;
  resetStepCounter: () => void;
  clearHistory: () => void;
};

function computeMetrics(points: Vec3[], pot: Potential) {
  const { E, minD } = energyAndMinDist(points, pot);
  return { energy: E, minDist: minD };
}

export const useSimStore = create<SimState>((set, get) => {
  const N0 = 24;
  const pot0: Potential = { kind: "riesz", s: 1 };
  const pts0 = randomPointsOnSphere(N0);
  const m0 = computeMetrics(pts0, pot0);

  return {
    N: N0,
    points: pts0,
    running: false,
    step: 0,

    eta: 0.01,
    stepsPerSecond: 60,
    pot: pot0,

    energy: m0.energy,
    minDist: m0.minDist,

    nearConverged: false,
    _convergeStreak: 0,

    history: [{ step: 0, energy: m0.energy, minDist: m0.minDist }],
    historyEvery: 5,
    historyMax: 300,

    randomize: () => {
      const { N, pot } = get();
      const pts = randomPointsOnSphere(N);
      const m = computeMetrics(pts, pot);
      set({ 
        points: pts, 
        step: 0, 
        running: false,
        energy: m.energy,
        minDist: m.minDist,
        history: [{ step: 0, energy: m.energy, minDist: m.minDist }],
      });
    },

    toggleRunning: () => set({ running: !get().running }),

    singleStep: (k = 1) => {
      const { points, pot, eta, step, energy: prevE, _convergeStreak } = get();

      let pts = points;
      for (let t = 0; t < k; t++) {
        pts = stepProjectedGD(pts, pot, eta);
      }

      const m = computeMetrics(pts, pot);
      const tol = 1e-6;
      const streakNeeded = 25;

      const relChange = Math.abs(m.energy - prevE) / Math.max(1, Math.abs(prevE));
      const nextStreak = relChange < tol ? _convergeStreak + 1 : 0;
      const nearConverged = nextStreak >= streakNeeded;

      const nextStep = step + k;

      let nextHistory = get().history;
      const { historyEvery, historyMax } = get();

      if (nextStep % historyEvery === 0) {
        nextHistory = [...nextHistory, { step: nextStep, energy: m.energy, minDist: m.minDist }];
        if (nextHistory.length > historyMax) {
          nextHistory = nextHistory.slice(nextHistory.length - historyMax);
        }
      }

      set({
        points: pts,
        step: step + k,
        energy: m.energy,
        minDist: m.minDist,
        _convergeStreak: nextStreak,
        nearConverged,
        history: nextHistory,
      });
    },

    setN: (n: number) => {
      const N = Math.max(2, Math.min(200, Math.floor(n)));
      const { pot } = get();
      const pts = randomPointsOnSphere(N);
      const m = computeMetrics(pts, pot);
      set({ 
        N, 
        points: pts, 
        step: 0, 
        running: false,
        energy: m.energy,
        minDist: m.minDist,
        history: [{ step: 0, energy: m.energy, minDist: m.minDist }],
      });
    },

    setEta: (eta: number) => set({ eta }),

    setStepsPerSecond: (sps: number) => set({ stepsPerSecond: sps }),

    setPotential: (pot: Potential) => {
      const { points } = get();
      const m = computeMetrics(points, pot);
      set({
        pot,
        energy: m.energy,
        minDist: m.minDist,
        history: [{ step: get().step, energy: m.energy, minDist: m.minDist }],
      });
    },


    resetStepCounter: () => set({ step: 0 }),
    clearHistory: () => {
      const { step, energy, minDist } = get();
      set({ history: [{ step, energy, minDist }] });
    },
  };
});
