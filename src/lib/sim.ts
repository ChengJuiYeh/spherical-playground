// src/lib/sim.ts
export type Domain = "sphere" | "space";
export type Vec3 = [number, number, number];

export type LennardJonesPotential = { kind: "lj"; alpha: number; beta: number; direction: "minimize" | "maximize"; radius?: number };

export type Potential =
  | LennardJonesPotential
  | { kind: "riesz"; s: number }
  | { kind: "log" }
  | { kind: "mixed"; s: number; gamma: number; scale: number }
  | { kind: "power"; p: number }
  | { kind: "pframe"; p: number };

export const DEFAULT_RA_RADIUS = Math.sqrt(3 / 8);
// Missing radius means unit sphere for records created before radius controls existed.
export function sphereRadius(pot: Potential): number {
  return pot.kind === "lj" ? (pot.radius ?? 1) : 1;
}

/** Convert an unordered off-diagonal sum to the chosen ordered average. */
export function energyPairFactor(N: number, pot: Potential): number {
  if (N < 2) return 0;
  const maximize = pot.kind === "mixed" || pot.kind === "power"
    || (pot.kind === "lj" && pot.direction === "maximize");
  return 2 / (maximize ? N * N : N * (N - 1));
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, c: number): Vec3 => [a[0] * c, a[1] * c, a[2] * c];
const norm = (a: Vec3) => Math.sqrt(dot(a, a));
const normalize = (a: Vec3): Vec3 => {
  const n = norm(a);
  if (!isFinite(n) || n === 0) return [1, 0, 0];
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Scale the inner product in BOTH distance terms, matching MATLAB energy_grad.
 * UI restricts scale below 1; default also supports an existing hot-reload state.
 */
export const DEFAULT_MIXED_SCALE = 0.99;

export function mixedPotentialValueAndDerivative(
  t: number, s: number, gamma: number, scale = DEFAULT_MIXED_SCALE
) {
  if (!Number.isFinite(scale) || scale < 0 || scale >= 1) {
    throw new Error("Mixed potential scale must be finite and in [0, 1).");
  }
  const u = scale * Math.max(-1, Math.min(1, t));
  const chord = Math.sqrt(2 - 2 * u);
  const a = gamma * chord + (1 - gamma) * Math.acos(u);
  // Derivative of the NEGATIVE potential with respect to the unscaled t.
  const fp = s * Math.pow(a, s - 1) * scale
    * (gamma / chord + (1 - gamma) / Math.sqrt(1 - u * u));
  return { f: -Math.pow(a, s), fp };
}

export function mixedPotentialValue(
  t: number, s: number, gamma: number, scale = DEFAULT_MIXED_SCALE
): number {
  return mixedPotentialValueAndDerivative(t, s, gamma, scale).f;
}

/** Exact, unsoftened pair energy and radial derivative. */
export function lennardJonesValueAndDerivative(r: number, pot: LennardJonesPotential) {
  const { alpha, beta } = pot;
  if (![alpha, beta].every(Number.isFinite) || alpha === 0 || beta === 0) {
    throw new Error("Repulsive-attractive exponents must be finite and nonzero.");
  }
  if (alpha === beta) return { f: 0, fp: 0 };
  if (r === 0 && Math.min(alpha, beta) < 0) {
    return { f: alpha > beta ? Infinity : -Infinity, fp: NaN };
  }
  return {
    f: Math.pow(r, alpha) / alpha - Math.pow(r, beta) / beta,
    fp: Math.pow(r, alpha - 1) - Math.pow(r, beta - 1),
  };
}

/** Gradient of the signed normalized LJ objective, shared by steps and diagnostics. */
export function lennardJonesGradient(points: Vec3[], pot: LennardJonesPotential): Vec3[] {
  const N = points.length;
  const sign = pot.direction === "maximize" ? -1 : 1;
  if (N < 2 || pot.alpha === pot.beta) return points.map(() => [0, 0, 0]);
  const gradients: Vec3[] = points.map(() => [0, 0, 0]);
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const diff = sub(points[i], points[j]);
    const r = norm(diff);
    if (r === 0) {
      // Positive powers > 1 are differentiable at coincidence, with zero gradient.
      if (Math.min(pot.alpha, pot.beta) > 1) continue;
      throw new Error("Nondifferentiable collision: use Random init to separate points.");
    }
    const { fp } = lennardJonesValueAndDerivative(r, pot);
    const contribution = mul(diff, sign * energyPairFactor(N, pot) * fp / r);
    gradients[i] = add(gradients[i], contribution);
    gradients[j] = sub(gradients[j], contribution);
  }
  return gradients;
}

export function freeSpaceGradientSmall(points: Vec3[], pot: LennardJonesPotential): boolean {
  try {
    const gradient = lennardJonesGradient(points, pot);
    return gradient.every(g => Number.isFinite(Math.hypot(...g)) && Math.hypot(...g) <= 1e-5);
  } catch { return false; }
}

/** Signed normalized objective; displayed energy itself never changes sign. */
function stepLennardJones(points: Vec3[], pot: LennardJonesPotential, eta: number, domain: Domain): Vec3[] {
  const N = points.length;
  if (N < 2 || eta <= 0 || pot.alpha === pot.beta) return points;
  const sign = pot.direction === "maximize" ? -1 : 1;
  const initial = sign * energyAndMinDist(points, pot).E;
  if (!Number.isFinite(initial)) throw new Error("Non-finite energy (collision or divergent positions): use Random init before continuing.");
  const gradients = lennardJonesGradient(points, pot);
  const radius = sphereRadius(pot);
  const tangent = domain === "space" ? gradients : gradients.map((g, i) => sub(g, mul(points[i], dot(g, points[i]) / (radius * radius))));
  const largest = Math.max(...tangent.map(g => Math.hypot(...g)));
  if (!Number.isFinite(largest)) throw new Error("Gradient overflow near collision: use Random init.");
  if (largest === 0) return points;
  // Limit the largest tangent displacement, then use Armijo backtracking.
  // This avoids huge jumps for negative exponents without softening the potential.
  const directions = tangent.map(g => mul(g, 1 / largest));
  const slope = tangent.reduce((sum, g, i) => sum + dot(g, directions[i]), 0);
  let length = Math.min(0.1, eta * largest);
  for (let attempt = 0; attempt < 40; attempt++, length *= 0.5) {
    const next = points.map((x, i) => {
      const y = sub(x, mul(directions[i], length));
      return domain === "space" ? y : mul(normalize(y), radius);
    });
    const value = sign * energyAndMinDist(next, pot).E;
    if (Number.isFinite(value) && value < initial && value <= initial - 1e-4 * length * slope) return next;
  }
  return points;
}

function fAndFp(r: number, pot: Potential) {
  const eps = 1e-8;
  const rr = Math.max(r, eps);

  switch (pot.kind) {
    case "lj": return lennardJonesValueAndDerivative(r, pot);
    case "riesz": {
      const s = pot.s;
      const f = Math.pow(rr, -s);
      const fp = -s * Math.pow(rr, -s - 1);
      return { f, fp };
    }
    case "log": {
      return { f: -Math.log(rr), fp: -1 / rr };
    }
    case "power": {
      const p = pot.p;
      // For p>0, minimizing r^p collapses points; we instead minimize -r^p
      const f = -Math.pow(rr, p);
      const fp = -p * Math.pow(rr, p - 1);
      return { f, fp };
    }
    case "mixed":
    case "pframe": {
      throw new Error("fAndFp is only for radial potentials (riesz/log/power), not pframe.");
    }
  }
}

export function randomPointsOnSphere(N: number, radius = 1): Vec3[] {
  // Normal sampling then normalize (Marsaglia-ish, good enough)
  const pts: Vec3[] = [];
  for (let i = 0; i < N; i++) {
    // Box-Muller for normals
    const u1 = Math.random();
    const u2 = Math.random();
    const u3 = Math.random();
    const u4 = Math.random();

    const r1 = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12)));
    const r2 = Math.sqrt(-2 * Math.log(Math.max(u3, 1e-12)));
    const z1 = r1 * Math.cos(2 * Math.PI * u2);
    const z2 = r1 * Math.sin(2 * Math.PI * u2);
    const z3 = r2 * Math.cos(2 * Math.PI * u4);

    pts.push(mul(normalize([z1, z2, z3]), radius));
  }
  return pts;
}

export function energyAndMinDist(points: Vec3[], pot: Potential) {
  let E = 0;
  let trueSum = 0;
  let minD = Infinity;
  const N = points.length;

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const d = sub(points[i], points[j]);
      const r = norm(d);
      if (r < minD) minD = r;

      if (pot.kind === "mixed") {
        const ip = Math.max(-1, Math.min(1, dot(points[i], points[j])));
        E += mixedPotentialValue(ip, pot.s, pot.gamma, pot.scale);
        // Original positive potential: alpha is deliberately absent.
        const distance = pot.gamma * r + (1 - pot.gamma) * Math.acos(ip);
        trueSum += Math.pow(distance, pot.s);
      } else if (pot.kind === "pframe") {
        const t = dot(points[i], points[j]);               // ⟨xi,xj⟩
        const a = Math.abs(t);
        E += Math.pow(a, pot.p);                           // |⟨xi,xj⟩|^p
      } else {
        const { f } = fAndFp(r, pot);
        E += f;
      }
    }
  }
  // Ordered off-diagonal average: N(N-1) for minimization, N² for maximization.
  E *= energyPairFactor(N, pot);
  const trueEnergy = pot.kind === "mixed" ? (N > 0 ? 2 * trueSum / (N * N) : 0) : null;
  return { E, minD, trueEnergy };
}

// Non-LJ GD retains the unnormalized gradient to preserve animation speed.
// Relative to reported energy, its effective step is eta / energyPairFactor(N, pot).
// LJ uses the normalized gradient consistently with its Armijo line search.
export function stepProjectedGD(points: Vec3[], pot: Potential, eta: number, domain: Domain = "sphere"): Vec3[] {
  if (pot.kind === "lj") return stepLennardJones(points, pot, eta, domain);
  if (domain !== "sphere") throw new Error("Free space is available only for Repulsive-attractive.");
  const N = points.length;
  const grads: Vec3[] = Array.from({ length: N }, () => [0, 0, 0]);

  const epsT = 1e-12;

  for (let i = 0; i < N; i++) {
    let gi: Vec3 = [0, 0, 0];
    const xi = points[i];

    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const xj = points[j];

      if (pot.kind === "mixed") {
        const t = Math.max(-1, Math.min(1, dot(xi, xj)));
        const { fp } = mixedPotentialValueAndDerivative(t, pot.s, pot.gamma, pot.scale);
        // Smooth, finite coefficient even at t = +/-1. The tangent contribution
        // tends continuously to zero at coincidence/antipodes; no cutoff needed.
        const tangent = sub(xj, mul(xi, t));
        gi = add(gi, mul(tangent, fp));
      } else if (pot.kind === "pframe") {
        // f(t)=|t|^p, t=<xi,xj>
        const t = dot(xi, xj);
        const a = Math.max(Math.abs(t), epsT);
        const sgn = t >= 0 ? 1 : -1; // if t=0, doesn't matter (a uses eps)
        const coeff = pot.p * Math.pow(a, pot.p - 1) * sgn;
        // ∇_{xi} f = coeff * xj
        gi = add(gi, mul(xj, coeff));
      } else {
        // radial potentials: f(r), r=||xi-xj||
        const dij = sub(xi, xj);
        const r = norm(dij);
        const { fp } = fAndFp(r, pot);
        const contrib = mul(dij, fp / Math.max(r, 1e-8));
        gi = add(gi, contrib);
      }
    }
    grads[i] = gi;
  }

  // Project to tangent, step, retract
  const next = points.map((xi, i) => {
    const gi = grads[i];
    const proj = sub(gi, mul(xi, dot(gi, xi)));
    const yi = sub(xi, mul(proj, eta));
    return normalize(yi);
  });

  return next;
}

export function projectPointsToSphere(points: Vec3[], radius = 1): Vec3[] {
  return points.map(p => mul(normalize(p), radius));
}

export function spatialMetrics(points: Vec3[]) {
  const center: Vec3 = [0, 0, 0];
  if (!points.length) return { center, minRadius: 0, maxRadius: 0, rmsRadius: 0 };
  for (const p of points) for (let k = 0; k < 3; k++) center[k] += p[k] / points.length;
  const radii = points.map(p => norm(sub(p, center)));
  return { center, minRadius: Math.min(...radii), maxRadius: Math.max(...radii),
    rmsRadius: Math.sqrt(radii.reduce((sum, v) => sum + v * v, 0) / points.length) };
}

export function randomPointsInSpace(N: number): Vec3[] {
  // Uniform ball, then translation to centroid zero; no radial normalization.
  const cloud = randomPointsOnSphere(N).map(p => mul(p, 1.5 * Math.cbrt(Math.random())));
  const { center } = spatialMetrics(cloud);
  return cloud.map(p => sub(p, center));
}