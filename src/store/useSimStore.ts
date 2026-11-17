// src/store/useSimStore.ts
"use client";

import { create } from "zustand";
import type { Domain, Potential, Vec3 } from "@/lib/sim";
import { energyAndMinDist, randomPointsOnSphere, stepProjectedGD, freeSpaceGradientSmall, randomPointsInSpace, projectPointsToSphere } from "@/lib/sim";

type HistoryPoint = { step: number; energy: number; minDist: number };

export type ComparisonRecord = {
  id: number;
  N: number;
  pot: Potential;
  domain: Domain;
  energy: number; // Actual potential sign, matching Status.
  trueEnergy: number | null;
  points: Vec3[];
  step: number;
};

export function comparisonKey(pot: Potential, domain: Domain): string {
  switch (pot.kind) {
    case "mixed": return JSON.stringify([domain, pot.kind, pot.s, pot.gamma]);
    case "riesz": return JSON.stringify([domain, pot.kind, pot.s]);
    case "power":
    case "pframe": return JSON.stringify([domain, pot.kind, pot.p]);
    case "lj": return JSON.stringify([domain, pot.kind, pot.alpha, pot.beta, pot.direction]);
    case "log": return JSON.stringify([domain, pot.kind]);
  }
}

export function comparisonMaximizes(pot: Potential): boolean {
  return pot.kind === "mixed" || pot.kind === "power" || (pot.kind === "lj" && pot.direction === "maximize");
}

export function comparisonValue(record: ComparisonRecord): number {
  return record.pot.kind === "mixed" ? record.trueEnergy! : record.energy;
}

export const COMPARISON_SESSION_KEY = "spherical-playground:comparison:v1";

function validRecord(value: unknown): value is ComparisonRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<ComparisonRecord>;
  const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  if (!Number.isSafeInteger(r.id) || !finite(r.id) || r.id < 1 ||
      !finite(r.N) || !Number.isInteger(r.N) || r.N < 2 || r.N > 10000 ||
      !finite(r.step) || !Number.isSafeInteger(r.step) || r.step < 0 || !finite(r.energy) ||
      (r.domain !== "sphere" && r.domain !== "space") ||
      !Array.isArray(r.points) || r.points.length !== r.N ||
      !r.points.every(p => Array.isArray(p) && p.length === 3 && p.every(finite))) return false;
  const pot = r.pot;
  if (!pot || (r.domain === "space" && pot.kind !== "lj")) return false;
  const positive = (x: unknown) => finite(x) && x > 0 && x <= 100;
  switch (pot.kind) {
    case "mixed": return positive(pot.s) && finite(pot.gamma) && pot.gamma >= 0 && pot.gamma <= 1
      && finite(pot.scale) && pot.scale >= 0 && pot.scale < 1 && finite(r.trueEnergy);
    case "riesz": return positive(pot.s) && r.trueEnergy === null;
    case "power":
    case "pframe": return positive(pot.p) && r.trueEnergy === null;
    case "log": return r.trueEnergy === null;
    case "lj": return finite(pot.alpha) && pot.alpha !== 0 && Math.abs(pot.alpha) <= 100
      && finite(pot.beta) && pot.beta !== 0 && Math.abs(pot.beta) <= 100
      && (pot.direction === "minimize" || pot.direction === "maximize") && r.trueEnergy === null;
    default: return false;
  }
}

export function comparisonBestByGroup(records: ComparisonRecord[]): Map<string, number> {
  const best = new Map<string, number>();
  for (const r of records) {
    const key = comparisonKey(r.pot, r.domain), value = comparisonValue(r), previous = best.get(key);
    best.set(key, previous === undefined ? value : comparisonMaximizes(r.pot)
      ? Math.max(previous, value) : Math.min(previous, value));
  }
  return best;
}

type SimState = {
  domain: Domain;
  setDomain: (domain: Domain) => void;
  loadSimplexExperiment: () => void;
  simulationError: string | null;
  trueEnergy: number | null;
  comparisonRecords: ComparisonRecord[];
  comparisonOpen: boolean;
  comparisonHydrated: boolean;
  comparisonStorageError: string | null;
  hydrateComparison: () => void;
  nextRecordId: number;
  setComparisonOpen: (open: boolean) => void;
  recordConfiguration: () => void;
  loadConfiguration: (id: number) => void;
  clearComparison: () => void;
  N: number;
  points: Vec3[];
  running: boolean;
  step: number;

  eta: number;
  stepsPerSecond: number;
  pot: Potential;

  energy: number;
  minDist: number;

  loadedHullPreview: boolean; // Display a loaded record without claiming convergence.
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
  const { E, minD, trueEnergy } = energyAndMinDist(points, pot);
  return { energy: E, minDist: minD, trueEnergy };
}

export const useSimStore = create<SimState>((set, get) => {
  const N0 = 24;
  const pot0: Potential = { kind: "riesz", s: 1 };
  const pts0 = randomPointsOnSphere(N0);
  const m0 = computeMetrics(pts0, pot0);

  const saveComparison = () => {
    if (typeof window === "undefined" || !get().comparisonHydrated) return;
    try {
      window.sessionStorage.setItem(COMPARISON_SESSION_KEY, JSON.stringify({
        version: 1, records: get().comparisonRecords, nextRecordId: get().nextRecordId,
      }));
      set({ comparisonStorageError: null });
    } catch {
      set({ comparisonStorageError: "Records remain available now, but could not be saved for page reload. Browser storage may be full or unavailable." });
    }
  };

  return {
    domain: "sphere",
    simulationError: null,
    N: N0,
    points: pts0,
    running: false,
    step: 0,

    eta: 0.01,
    stepsPerSecond: 60,
    pot: pot0,

    trueEnergy: m0.trueEnergy,
    comparisonRecords: [],
    comparisonOpen: false,
    comparisonHydrated: false,
    comparisonStorageError: null,
    nextRecordId: 1,
    energy: m0.energy,
    minDist: m0.minDist,

    nearConverged: false, loadedHullPreview: false,
    _convergeStreak: 0,

    history: [{ step: 0, energy: m0.energy, minDist: m0.minDist }],
    historyEvery: 5,
    historyMax: 300,

    randomize: () => {
      const { N, pot } = get();
      const pts = get().domain === "space" ? randomPointsInSpace(N) : randomPointsOnSphere(N);
      const m = computeMetrics(pts, pot);
      set({ 
        simulationError: null,
        nearConverged: false, loadedHullPreview: false,
        _convergeStreak: 0,
        points: pts, 
        step: 0, 
        running: false,
        trueEnergy: m.trueEnergy,
        energy: m.energy,
        minDist: m.minDist,
        history: [{ step: 0, energy: m.energy, minDist: m.minDist }],
      });
    },

    toggleRunning: () => set({ running: !get().running, loadedHullPreview: false }),

    singleStep: (k = 1) => {
      const { points, pot, eta, step, energy: prevE, _convergeStreak } = get();

      let pts = points;
      try {
        for (let t = 0; t < k; t++) pts = stepProjectedGD(pts, pot, eta, get().domain);
      } catch (error) {
        set({ running: false, nearConverged: false, loadedHullPreview: false, _convergeStreak: 0,
          simulationError: error instanceof Error ? error.message : String(error) });
        return;
      }

      const m = computeMetrics(pts, pot);
      const tol = 1e-6;
      const streakNeeded = 25;

      const relChange = Math.abs(m.energy - prevE) / Math.max(1, Math.abs(prevE));
      const gradientSmall = get().domain !== "space" || pot.kind !== "lj" || freeSpaceGradientSmall(pts, pot);
      const nextStreak = relChange < tol && gradientSmall ? _convergeStreak + 1 : 0;
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
        trueEnergy: m.trueEnergy,
        energy: m.energy,
        minDist: m.minDist,
        _convergeStreak: nextStreak,
        nearConverged, loadedHullPreview: false,
        history: nextHistory,
      });
    },

    setN: (n: number) => {
      if (!Number.isInteger(n) || n < 2 || n > 10000) return;
      const N = n;
      const { pot } = get();
      const pts = get().domain === "space" ? randomPointsInSpace(N) : randomPointsOnSphere(N);
      const m = computeMetrics(pts, pot);
      set({ 
        N, 
        simulationError: null,
        nearConverged: false, loadedHullPreview: false,
        _convergeStreak: 0,
        points: pts, 
        step: 0, 
        running: false,
        trueEnergy: m.trueEnergy,
        energy: m.energy,
        minDist: m.minDist,
        history: [{ step: 0, energy: m.energy, minDist: m.minDist }],
      });
    },

    setEta: (eta: number) => { if (Number.isFinite(eta) && eta > 0) set({ eta }); },

    setStepsPerSecond: (sps: number) => {
      if (Number.isInteger(sps) && sps >= 1 && sps <= 1000) set({ stepsPerSecond: sps });
    },

    setPotential: (pot: Potential) => {
      const { points: oldPoints, domain: oldDomain } = get();
      const domain = pot.kind === "lj" ? oldDomain : "sphere";
      const points = domain !== oldDomain ? projectPointsToSphere(oldPoints) : oldPoints;
      const m = computeMetrics(points, pot);
      set({
        pot, points, domain, eta: get().eta, running: false,
        simulationError: null,
        nearConverged: false, loadedHullPreview: false,
        _convergeStreak: 0,
        trueEnergy: m.trueEnergy,
        energy: m.energy,
        minDist: m.minDist,
        history: Number.isFinite(m.energy) ? [{ step: get().step, energy: m.energy, minDist: m.minDist }] : [],
      });
    },


    setDomain: (domain) => {
      const state = get();
      if (state.pot.kind !== "lj" || domain === state.domain) return;
      const points = domain === "sphere" ? projectPointsToSphere(state.points) : state.points;
      const m = computeMetrics(points, state.pot);
      set({ domain, points, eta: state.eta, running: false, step: 0, ...m,
        simulationError: null, nearConverged: false, loadedHullPreview: false, _convergeStreak: 0,
        history: Number.isFinite(m.energy) ? [{ step: 0, energy: m.energy, minDist: m.minDist }] : [] });
    },
    loadSimplexExperiment: () => {
      const pot: Potential = { kind: "lj", alpha: 6, beta: 2, direction: "minimize" };
      const points = randomPointsInSpace(40);
      const m = computeMetrics(points, pot);
      set({ domain: "space", pot, N: 40, points, eta: 0.5, running: false, step: 0, ...m,
        simulationError: null, nearConverged: false, loadedHullPreview: false, _convergeStreak: 0,
        history: [{ step: 0, energy: m.energy, minDist: m.minDist }] });
    },

    hydrateComparison: () => {
      if (get().comparisonHydrated || typeof window === "undefined") return;
      try {
        const raw = window.sessionStorage.getItem(COMPARISON_SESSION_KEY);
        if (!raw) { set({ comparisonHydrated: true }); return; }
        const data = JSON.parse(raw);
        if (data?.version !== 1 || !Array.isArray(data.records) || !data.records.every(validRecord)) {
          throw new Error("Invalid saved records");
        }
        const records: ComparisonRecord[] = data.records;
        if (new Set(records.map(r => r.id)).size !== records.length) throw new Error("Duplicate record ids");
        const nextRecordId = records.reduce((next, r) => Math.max(next, r.id + 1), 1);
        set({ comparisonRecords: records, nextRecordId, comparisonHydrated: true, comparisonStorageError: null });
      } catch {
        set({ comparisonHydrated: true, comparisonStorageError: "Saved records could not be restored. You can continue recording in this page." });
      }
    },
    setComparisonOpen: (open) => set({ comparisonOpen: open }),
    clearComparison: () => {
      get().hydrateComparison();
      const state = get();
      set({ comparisonRecords: state.comparisonRecords.filter(r => r.pot.kind !== state.pot.kind) });
      saveComparison();
    },
    recordConfiguration: () => {
      get().hydrateComparison();
      const state = get();
      const { pot } = state;
      const points = state.points.map((p): Vec3 => [...p]);
      const m = computeMetrics(points, pot);
      if (!Number.isFinite(m.energy) || (pot.kind === "mixed" && (m.trueEnergy === null || !Number.isFinite(m.trueEnergy)))) return;
      const record: ComparisonRecord = {
        id: state.nextRecordId, N: points.length, pot: { ...pot }, domain: state.domain,
        energy: pot.kind === "mixed" || pot.kind === "power" ? -m.energy : m.energy,
        trueEnergy: m.trueEnergy, points, step: state.step,
      };
      set({ comparisonRecords: [...state.comparisonRecords, record], nextRecordId: state.nextRecordId + 1 });
      saveComparison();
    },
    loadConfiguration: (id) => {
      get().hydrateComparison();
      const state = get();
      const record = state.comparisonRecords.find((r) => r.id === id);
      if (!record) return;
      const points = record.points.map((p): Vec3 => [...p]);
      const pot: Potential = { ...record.pot };
      const m = computeMetrics(points, pot);
      set({ points, N: points.length, pot, domain: record.domain, running: false, step: record.step,
        ...m, simulationError: null, nearConverged: false, loadedHullPreview: true, _convergeStreak: 0,
        history: [{ step: record.step, energy: m.energy, minDist: m.minDist }] });
    },

    resetStepCounter: () => set({ step: 0 }),
    clearHistory: () => {
      const { step, energy, minDist } = get();
      set({ history: Number.isFinite(energy) ? [{ step, energy, minDist }] : [] });
    },
  };
});