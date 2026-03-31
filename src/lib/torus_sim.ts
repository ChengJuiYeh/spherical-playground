// src/lib/torus_sim.ts

export type Vec2 = [number, number];

export type TorusPotential =
  | { kind: "riesz"; s: number }
  | { kind: "log" }
  | { kind: "power"; p: number };

// A genuinely useful smoothing scale for the torus distance.
// Since the torus side length is 1, values like 0.005 ~ 0.02 are reasonable.
export const DEFAULT_TORUS_SOFTENING = 0.01;

// Clip very large gradients to avoid violent oscillation near collisions.
export const DEFAULT_TORUS_MAX_GRAD = 5.0;

// ---------------------------
// basic vector ops
// ---------------------------
const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec2, c: number): Vec2 => [a[0] * c, a[1] * c];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const norm = (a: Vec2) => Math.sqrt(dot(a, a));

// Wrap a real number into [0,1)
function wrapUnit(x: number): number {
  const y = x - Math.floor(x);
  return y >= 1 ? 0 : y;
}

// Wrap each coordinate into [0,1)
export function wrapPointToTorus(x: Vec2): Vec2 {
  return [wrapUnit(x[0]), wrapUnit(x[1])];
}

// Minimum-image convention:
// map delta to [-1/2, 1/2) coordinatewise.
export function wrapDelta(delta: Vec2): Vec2 {
  return [
    delta[0] - Math.round(delta[0]),
    delta[1] - Math.round(delta[1]),
  ];
}

// Geodesic displacement vector on flat torus
export function torusDisplacement(x: Vec2, y: Vec2): Vec2 {
  return wrapDelta(sub(x, y));
}

// Exact geodesic distance on flat torus
export function torusDistance(x: Vec2, y: Vec2): number {
  return norm(torusDisplacement(x, y));
}

// Smoothed / regularized distance:
// rho_eps(x,y) = sqrt(rho(x,y)^2 + eps^2)
export function torusDistanceRegularized(
  x: Vec2,
  y: Vec2,
  eps = DEFAULT_TORUS_SOFTENING
): number {
  const v = torusDisplacement(x, y);
  return Math.sqrt(dot(v, v) + eps * eps);
}

// 1D torus distance, useful for debugging / display if needed
export function circleDistance(a: number, b: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

// ---------------------------
// potential and derivative
// ---------------------------
function fAndFp(r: number, pot: TorusPotential) {
  const rr = Math.max(r, 1e-12);

  switch (pot.kind) {
    case "riesz": {
      const s = pot.s;
      const f = Math.pow(rr, -s);
      const fp = -s * Math.pow(rr, -s - 1);
      return { f, fp };
    }
    case "log": {
      const f = -Math.log(rr);
      const fp = -1 / rr;
      return { f, fp };
    }
    case "power": {
      const p = pot.p;
      // Same convention as the spherical page:
      // minimize -r^p, i.e. encourage points to spread apart.
      const f = -Math.pow(rr, p);
      const fp = -p * Math.pow(rr, p - 1);
      return { f, fp };
    }
  }
}

// ---------------------------
// random initialization
// ---------------------------
export function randomPointsOnFlatTorus(N: number): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < N; i++) {
    pts.push([Math.random(), Math.random()]);
  }
  return pts;
}

// Slightly nicer random init with tiny jitter away from exact collisions
export function randomPointsOnFlatTorusJittered(N: number, jitter = 1e-6): Vec2[] {
  const pts = randomPointsOnFlatTorus(N);
  return pts.map(([x, y]) =>
    wrapPointToTorus([
      x + jitter * (Math.random() - 0.5),
      y + jitter * (Math.random() - 0.5),
    ])
  );
}

// ---------------------------
// energy / min distance
// ---------------------------
export function energyAndMinDistOnFlatTorus(
  points: Vec2[],
  pot: TorusPotential,
  eps = DEFAULT_TORUS_SOFTENING
) {
  let E = 0;
  let minD = Infinity;
  const N = points.length;

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dExact = torusDistance(points[i], points[j]);
      if (dExact < minD) minD = dExact;

      const r = Math.sqrt(dExact * dExact + eps * eps);
      const { f } = fAndFp(r, pot);
      E += f;
    }
  }

  if (!isFinite(minD)) minD = 0;
  return { E, minD };
}

// ---------------------------
// gradient descent step
// ---------------------------
export function stepFlatTorusGD(
  points: Vec2[],
  pot: TorusPotential,
  eta: number,
  eps = DEFAULT_TORUS_SOFTENING,
  maxGrad = DEFAULT_TORUS_MAX_GRAD
): Vec2[] {
  const N = points.length;
  const grads: Vec2[] = Array.from({ length: N }, () => [0, 0]);

  for (let i = 0; i < N; i++) {
    let gi: Vec2 = [0, 0];
    const xi = points[i];

    for (let j = 0; j < N; j++) {
      if (i === j) continue;

      const xj = points[j];
      const vij = torusDisplacement(xi, xj); // minimum-image displacement
      const r2 = dot(vij, vij);
      const r = Math.sqrt(r2 + eps * eps);

      const { fp } = fAndFp(r, pot);

      // grad wrt xi of f(r) is fp(r) * vij / r
      const coeff = fp / r;
      gi = add(gi, mul(vij, coeff));
    }

    // Gradient clipping for stability near near-collisions
    const gnorm = norm(gi);
    if (gnorm > maxGrad) {
      gi = mul(gi, maxGrad / gnorm);
    }

    grads[i] = gi;
  }

  // Gradient descent in ambient R^2, then wrap back to [0,1)^2
  return points.map((xi, i) => wrapPointToTorus(sub(xi, mul(grads[i], eta))));
}

// ---------------------------
// helper for periodic copies in rendering
// ---------------------------
export function periodicCopies3x3(points: Vec2[]) {
  const shifts: Vec2[] = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0], [0,  0], [1,  0],
    [-1,  1], [0,  1], [1,  1],
  ];

  return shifts.flatMap((shift) =>
    points.map((p, idx) => ({
      baseIndex: idx,
      shift,
      point: add(p, shift),
      isCentral: shift[0] === 0 && shift[1] === 0,
    }))
  );
}

// ---------------------------
// optional utility: best pairwise segment
// for later drawing shortest geodesic edges
// ---------------------------
export function shortestPeriodicSegment(x: Vec2, y: Vec2) {
  const v = torusDisplacement(y, x); // y - x in min-image sense
  const yClosest: Vec2 = [x[0] + v[0], x[1] + v[1]];
  return { x, yClosest, displacement: v, length: norm(v) };
}