// src/lib/design.ts
export type Vec = number[];

/**
 * Compute S_k = sum_{(x,y) in X^2} G_k^{(n)}(<x,y>) where G_k^{(n)}(1)=1.
 * Returns normalized values s_k = S_k / |X|^2 for k=1..Kmax.
 *
 * - n here means ambient dimension (points in R^n), i.e. sphere is S^{n-1}
 * - Uses normalized Gegenbauer polynomials for n != 2, and Chebyshev for n=2.
 */
export function computeDesignSums(points: Vec[], Kmax = 20) {
  const N = points.length;
  if (N === 0) return { dim: 0, N: 0, sk: [] as number[] };

  const dim = points[0].length;
  const M = N * N; // ordered pairs

  // Precompute all inner products <x_i, x_j> for i,j
  const ips = new Float64Array(M);
  let idx = 0;
  for (let i = 0; i < N; i++) {
    const xi = points[i];
    for (let j = 0; j < N; j++) {
      const xj = points[j];
      let s = 0;
      for (let d = 0; d < dim; d++) s += xi[d] * xj[d];
      // clamp to [-1,1] for numerical stability
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      ips[idx++] = s;
    }
  }

  // Special case: dim=2 => S^1, use cos(k arccos t) (Chebyshev T_k), normalized at 1.
  if (dim === 2) {
    const sk: number[] = [];
    for (let k = 1; k <= Kmax; k++) {
      let sum = 0;
      for (let m = 0; m < M; m++) {
        const t = ips[m];
        const val = Math.cos(k * Math.acos(t)); // T_k(t)
        sum += val;
      }
      sk.push(sum / (N * N));
    }
    return { dim, N, sk };
  }

  // General case dim>=3: Gegenbauer parameter lambda = (n-2)/2
  const lambda = (dim - 2) / 2;

  // C_0^λ(x)=1
  let Ckm2 = new Float64Array(M);
  Ckm2.fill(1.0);
  let Ckm2_1 = 1.0;

  // C_1^λ(x)=2λ x
  let Ckm1 = new Float64Array(M);
  for (let m = 0; m < M; m++) Ckm1[m] = 2 * lambda * ips[m];
  let Ckm1_1 = 2 * lambda * 1.0;

  const sk: number[] = [];

  // k=1
  {
    const denom = Ckm1_1 === 0 ? 1 : Ckm1_1;
    let sum = 0;
    for (let m = 0; m < M; m++) sum += Ckm1[m] / denom;
    sk.push(sum / (N * N));
  }

  for (let k = 2; k <= Kmax; k++) {
    // Recurrence:
    // C_k^λ(x)= (2 (k+λ-1)/k) x C_{k-1}^λ(x) - ((k+2λ-2)/k) C_{k-2}^λ(x)
    const a = (2 * (k + lambda - 1)) / k;
    const b = (k + 2 * lambda - 2) / k;

    const Ck = new Float64Array(M);
    for (let m = 0; m < M; m++) {
      Ck[m] = a * ips[m] * Ckm1[m] - b * Ckm2[m];
    }
    const Ck_1 = a * 1.0 * Ckm1_1 - b * Ckm2_1;

    // normalized G_k = C_k / C_k(1)
    const denom = Ck_1 === 0 ? 1 : Ck_1;
    let sum = 0;
    for (let m = 0; m < M; m++) sum += Ck[m] / denom;
    sk.push(sum / (N * N));

    // shift
    Ckm2 = Ckm1;
    Ckm2_1 = Ckm1_1;
    Ckm1 = Ck;
    Ckm1_1 = Ck_1;
  }

  return { dim, N, sk };
}

/**
 * Given s_k = S_k/|X|^2 (k=1..Kmax), estimate design strength:
 * t = max integer such that |s_k| <= tol for all k=1..t.
 * (We also clamp negative tiny values to 0 notionally since theory says s_k >= 0.)
 */
export function estimateDesignStrength(sk: number[], tol = 1e-6) {
  let t = 0;
  for (let k = 1; k <= sk.length; k++) {
    const v = sk[k - 1];
    if (Math.abs(v) <= tol) t = k;
    else break;
  }
  return t;
}
