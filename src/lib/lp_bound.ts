// src/lib/lp_bound.ts
import type { Potential } from "./sim";

let glpkInstance: any = null;

async function getGLPK() {
  if (glpkInstance) return glpkInstance;

  const mod: any = await import("glpk.js");
  const GLPKFactory = mod?.default ?? mod?.GLPK ?? mod;

  if (typeof GLPKFactory !== "function") {
    console.log("glpk.js module keys:", Object.keys(mod ?? {}));
    console.log("glpk.js module:", mod);
    throw new Error("glpk.js import failed: no GLPK factory function found.");
  }

  glpkInstance = await GLPKFactory({
    locateFile: (f: string) => `https://unpkg.com/glpk.js@0.20.0/dist/${f}`,
  });

  console.log("GLPK initialized once.");
  return glpkInstance;
}

/** Legendre polynomials P_0..P_d at t (S^2 case). P_k(1)=1. */
export function legendreValues(t: number, d: number): number[] {
  const P = new Array(d + 1).fill(0);
  P[0] = 1;
  if (d >= 1) P[1] = t;

  for (let k = 2; k <= d; k++) {
    P[k] = ((2 * k - 1) * t * P[k - 1] - (k - 1) * P[k - 2]) / k;
  }
  return P;
}

/** Convert current potential to a function f(t) on t=<x,y> in [-1,1). */
export function potentialToInnerProductFunction(pot: Potential) {
  const eps = 1e-12;

  // chordal distance r = ||x-y|| = sqrt(2-2t) on S^2
  const rFromT = (t: number) => Math.sqrt(Math.max(2 - 2 * t, eps));

  switch (pot.kind) {
    case "riesz": {
      const s = pot.s;
      return (t: number) => Math.pow(Math.max(2 - 2 * t, eps), -s / 2);
    }
    case "log": {
      // f(r) = -log r, so f(t)= -log sqrt(2-2t) = -0.5 log(2-2t)
      return (t: number) => -0.5 * Math.log(Math.max(2 - 2 * t, eps));
    }
    case "power": {
      // In sim.ts we minimize -r^p (to maximize r^p). Bound should use the same minimized potential.
      const p = pot.p;
      return (t: number) => -Math.pow(rFromT(t), p);
    }
    case "pframe": {
      const p = pot.p;
      return (t: number) => Math.pow(Math.abs(t), p);
    }
  }
}

export type LPSolution = {
  status: string;
  // coefficients h_0..h_d for h(t)=sum h_k P_k(t)
  h: number[];
  h0: number;
  h0p: number;
  h0m: number;
  boundValue: number; // N^2 h0 - N h(1)
  maxViolation: number; // max_t (h(t)-f(t)) on check grid
  activeTs: number[]; // constraint points used (for plotting markers)
};

/**
 * Solve LP for given f, N, degree d, and a set of constraint points ts.
 * Variables:
 *  x0p >=0, x0m>=0, xk>=0 for k=1..d
 *  h0 = x0p - x0m, hk = xk.
 * Constraints for each t:
 *   (x0p - x0m)*P0 + sum_{k=1}^d xk Pk(t) <= f(t).
 * Objective maximize: N^2 h0 - N h(1) = (N^2-N)h0 - N sum_{k=1}^d hk
 *   = (N^2-N)x0p - (N^2-N)x0m - N sum_{k=1}^d xk
 */
export async function solveEnergyLP_GLKP({
  pot,
  N,
  d,
  ts,
  msgLevel = 0,
}: {
  pot: Potential;
  N: number;
  d: number;
  ts: number[];
  msgLevel?: number;
}): Promise<{ ok: boolean; sol?: LPSolution; err?: string }> {
  try {
    const glpk = await getGLPK();

    const f = potentialToInnerProductFunction(pot);

    // ---- variable names ----
    const varNames: string[] = ["h0p", "h0m"];
    for (let k = 1; k <= d; k++) varNames.push(`h${k}`);

    // ---- objective coefficients ----
    const a0 = N * N - N; // (N^2 - N)
    const objVars = [
      { name: "h0p", coef: a0 },
      { name: "h0m", coef: -a0 },
      ...Array.from({ length: d }, (_, i) => ({ name: `h${i + 1}`, coef: -N })),
    ];

    // ---- bounds: all variables >= 0 ----
    const bounds = varNames.map((name) => ({
      name,
      type: glpk.GLP_LO,
      lb: 0,
      ub: 0,
    }));

    // ---- constraints: h(t_i) <= f(t_i) ----
    const subjectTo = ts.map((t, idx) => {
      const P = legendreValues(t, d);
      const vars: Array<{ name: string; coef: number }> = [
        { name: "h0p", coef: 1 },
        { name: "h0m", coef: -1 },
      ];
      for (let k = 1; k <= d; k++) vars.push({ name: `h${k}`, coef: P[k] });

      const rhs = f(t);

      return {
        name: `c${idx}`,
        vars,
        bnds: { type: glpk.GLP_UP, ub: rhs, lb: 0 }, // row <= rhs
      };
    });

    const model = {
      name: "energy_lp",
      objective: {
        direction: glpk.GLP_MAX,
        name: "obj",
        vars: objVars,
      },
      subjectTo,
      bounds,
    };

    // ---- solve ----
    const result: any = await glpk.solve(model, { msgLevel });

    console.log("typeof result:", typeof result);
    console.log("result keys:", result && Object.keys(result));
    console.log("result:", result);

    // ---- normalize return schema ----
    const core: any = result?.result ?? result?.res ?? result;
    console.log("core keys:", core && Object.keys(core));
    console.log("GLPK solve raw:", result);
    console.log("GLPK core:", core);

    const glpStatus = core?.status;
    const glpZ = core?.z;
    const glpVars = core?.vars;

    console.log("GLPK status:", glpStatus);
    console.log("GLPK obj z:", glpZ);
    console.log("GLPK vars:", glpVars);

    if (glpStatus === undefined || glpVars === undefined) {
      throw new Error("GLPK returned no status/vars (solve failed or schema mismatch).");
    }

    // ---- recover coefficients ----
    const h0p = Number(glpVars["h0p"] ?? 0);
    const h0m = Number(glpVars["h0m"] ?? 0);
    const h0 = h0p - h0m;

    const h: number[] = new Array(d + 1).fill(0);
    h[0] = h0;
    for (let k = 1; k <= d; k++) h[k] = Number(glpVars[`h${k}`] ?? 0);

    // bound value: N^2 h0 - N h(1),  h(1)=sum h_k
    const h1 = h.reduce((acc, v) => acc + v, 0);
    const boundValueOrdered = N * N * h0 - N * h1; // ordered pairs: sum_{x≠y}
    const boundValue = 0.5 * boundValueOrdered; // unordered pairs: sum_{i<j}

    const sol: LPSolution = {
      status: String(glpStatus),
      h,
      h0,
      h0p,
      h0m,
      boundValue,
      maxViolation: NaN,
      activeTs: ts,
    };

    return { ok: true, sol };
  } catch (e: any) {
    return { ok: false, err: e?.message ?? String(e) };
  }
}

/** Evaluate h(t)=sum_{k=0}^d h_k P_k(t) */
export function evalH(t: number, h: number[]): number {
  const d = h.length - 1;
  const P = legendreValues(t, d);
  let s = 0;
  for (let k = 0; k <= d; k++) s += h[k] * P[k];
  return s;
}

export function uniformGrid(m: number, tMax = 1 - 1e-6): number[] {
  const a = -1;
  const b = Math.min(tMax, 1 - 1e-12);
  const out: number[] = [];
  for (let i = 0; i < m; i++) out.push(a + (b - a) * (i / (m - 1)));

  // 強制加入 0（p-frame 最重要）
  out.push(0);

  // 去重 + 排序（避免太靠近）
  const uniq = Array.from(new Set(out.map((x) => Number(x.toFixed(12))))).sort((x, y) => x - y);
  return uniq;
}

export type CuttingPlaneResult = {
  sol: LPSolution;
  history: Array<{ iter: number; boundValue: number; maxViolation: number; newT?: number }>;
};

/**
 * Cutting-plane loop:
 * - start with an initial constraint grid
 * - solve LP
 * - scan a dense grid to find max violation of h(t) <= f(t)
 * - add the worst t if violation > tol, repeat
 */
export async function cuttingPlaneLP({
  pot,
  N,
  d,
  initM = 200,
  checkM = 2000,
  tol = 1e-6,
  maxIter = 25,
  tMax,
}: {
  pot: Potential;
  N: number;
  d: number;
  initM?: number;
  checkM?: number;
  tol?: number;
  maxIter?: number;
  tMax?: number;
}): Promise<{ ok: boolean; res?: CuttingPlaneResult; err?: string }> {
  const f = potentialToInnerProductFunction(pot);

  const TMAX = tMax ?? (pot.kind === "riesz" ? 0.95 : 1 - 1e-6);

  const ts: number[] = uniformGrid(initM, TMAX);
  const checkGrid = uniformGrid(checkM, TMAX);

  const hist: Array<{ iter: number; boundValue: number; maxViolation: number; newT?: number }> = [];

  for (let iter = 0; iter <= maxIter; iter++) {
    const lp = await solveEnergyLP_GLKP({ pot, N, d, ts, msgLevel: 0 });
    if (!lp.ok || !lp.sol) return { ok: false, err: lp.err ?? "LP failed" };
    const sol = lp.sol;

    // scan for violation
    let maxV = -Infinity;
    let argT = checkGrid[0];

    for (const t of checkGrid) {
      const ht = evalH(t, sol.h);
      const ft = f(t);
      const viol = ht - ft; // should be <= 0
      if (viol > maxV) {
        maxV = viol;
        argT = t;
      }
    }

    sol.maxViolation = maxV;

    hist.push({
      iter,
      boundValue: sol.boundValue,
      maxViolation: maxV,
      newT: maxV > tol ? argT : undefined,
    });

    if (maxV <= tol) {
      sol.activeTs = ts;
      return { ok: true, res: { sol, history: hist } };
    }

    // add the worst point if not already present (within tiny tolerance)
    const exists = ts.some((u) => Math.abs(u - argT) < 5e-6);
    if (!exists) ts.push(argT);
  }

  // final
  const lp = await solveEnergyLP_GLKP({ pot, N, d, ts, msgLevel: 0 });
  if (!lp.ok || !lp.sol) return { ok: false, err: lp.err ?? "LP failed" };
  lp.sol.activeTs = ts;

  return { ok: true, res: { sol: lp.sol, history: hist } };
}

export async function debugOnce() {
  const pot: Potential = { kind: "pframe", p: 2 };
  const N = 12;
  const d = 2;
  const ts = [-1, -0.5, 0, 0.5, 0.9]; // 少數幾個點就夠測

  const lp = await solveEnergyLP_GLKP({ pot, N, d, ts, msgLevel: 1 });
  console.log("debugOnce lp:", lp);
}