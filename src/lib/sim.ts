// src/lib/sim.ts
export type Vec3 = [number, number, number];

export type Potential =
  | { kind: "riesz"; s: number }
  | { kind: "log" }
  | { kind: "power"; p: number }
  | { kind: "pframe"; p: number };

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

function fAndFp(r: number, pot: Potential) {
  const eps = 1e-8;
  const rr = Math.max(r, eps);

  switch (pot.kind) {
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
    case "pframe": {
      throw new Error("fAndFp is only for radial potentials (riesz/log/power), not pframe.");
    }
  }
}

export function randomPointsOnSphere(N: number): Vec3[] {
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

    pts.push(normalize([z1, z2, z3]));
  }
  return pts;
}

export function energyAndMinDist(points: Vec3[], pot: Potential) {
  let E = 0;
  let minD = Infinity;
  const N = points.length;

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const d = sub(points[i], points[j]);
      const r = norm(d);
      if (r < minD) minD = r;

      if (pot.kind === "pframe") {
        const t = dot(points[i], points[j]);               // ⟨xi,xj⟩
        const a = Math.abs(t);
        E += Math.pow(a, pot.p);                           // |⟨xi,xj⟩|^p
      } else {
        const { f } = fAndFp(r, pot);
        E += f;
      }
    }
  }
  return { E, minD };
}

export function stepProjectedGD(points: Vec3[], pot: Potential, eta: number): Vec3[] {
  const N = points.length;
  const grads: Vec3[] = Array.from({ length: N }, () => [0, 0, 0]);

  const epsT = 1e-12;

  for (let i = 0; i < N; i++) {
    let gi: Vec3 = [0, 0, 0];
    const xi = points[i];

    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const xj = points[j];

      if (pot.kind === "pframe") {
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
