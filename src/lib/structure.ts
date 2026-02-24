// src/lib/structure.ts
export type Vec3 = [number, number, number];

export type Graph = {
  n: number;
  edges: Array<[number, number]>; // i<j
  adj: number[][];
  degrees: number[];
};

export type LayerSummary = {
  centers: number[];      // inner product centers, ascending
  counts: number[];       // number of pairs in each layer
  k: number;              // number of layers
  tol: number;
};

export type LayeredEdges = {
  centers: number[];
  edgesByLayer: Array<Array<[number, number]>>;
};

export type StructureSummary = {
  n: number;
  tol: number;
  layer: LayerSummary;
  layers: LayeredEdges;
  contact: Graph;
};


export function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function gramMatrix(points: Vec3[]) {
  const n = points.length;
  const G: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const v = dot(points[i], points[j]);
      G[i][j] = v;
      G[j][i] = v;
    }
  }
  return G;
}

export function pairwiseInnerProducts(points: Vec3[]) {
  const n = points.length;
  const pairs: Array<{ i: number; j: number; v: number }> = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairs.push({ i, j, v: dot(points[i], points[j]) });
    }
  }
  return pairs;
}

/**
 * 1D "gap clustering" for sorted values:
 * start new cluster whenever gap > tol.
 */
export function cluster1D(values: number[], tol: number) {
  if (values.length === 0) return { centers: [] as number[], counts: [] as number[], labels: [] as number[] };

  // keep original indices
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);

  const labels = Array(values.length).fill(0);
  const centers: number[] = [];
  const counts: number[] = [];

  let curStart = 0;
  let curSum = idx[0].v;
  let curCount = 1;
  let curLabel = 0;

  const flush = () => {
    centers.push(curSum / curCount);
    counts.push(curCount);
  };

  for (let t = 1; t < idx.length; t++) {
    const gap = idx[t].v - idx[t - 1].v;
    if (gap > tol) {
      // finish current cluster
      flush();
      curLabel++;
      curStart = t;
      curSum = idx[t].v;
      curCount = 1;
    } else {
      curSum += idx[t].v;
      curCount++;
    }
  }
  flush();

  // assign labels back
  // walk again to label
  let cluster = 0;
  let lastBreak = 0;
  for (let t = 1; t < idx.length; t++) {
    const gap = idx[t].v - idx[t - 1].v;
    if (gap > tol) {
      // label segment [lastBreak, t)
      for (let u = lastBreak; u < t; u++) labels[idx[u].i] = cluster;
      cluster++;
      lastBreak = t;
    }
  }
  for (let u = lastBreak; u < idx.length; u++) labels[idx[u].i] = cluster;

  return { centers, counts, labels };
}

export function buildGraph(n: number, edges: Array<[number, number]>): Graph {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [i, j] of edges) {
    adj[i].push(j);
    adj[j].push(i);
  }
  const degrees = adj.map((nbrs) => nbrs.length);
  return { n, edges, adj, degrees };
}

export function degreeSummary(deg: number[]) {
  const sorted = [...deg].sort((a, b) => a - b);
  const freq = new Map<number, number>();
  for (const d of sorted) freq.set(d, (freq.get(d) ?? 0) + 1);
  return { sorted, freq };
}

export type LayeredEdges = {
  centers: number[];              // inner product centers, sorted descending if you want
  edgesByLayer: Array<Array<[number, number]>>;
};

export function buildEdgesByLayerFromCenters(
  points: Vec3[],
  centers: number[],
  tol: number
): LayeredEdges {
  const n = points.length;
  const edgesByLayer: Array<Array<[number, number]>> = centers.map(() => []);

  function dot(a: Vec3, b: Vec3) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  }

  function nearestCenterIndex(x: number) {
    let best = 0;
    let bestDist = Infinity;
    for (let k = 0; k < centers.length; k++) {
      const d = Math.abs(x - centers[k]);
      if (d < bestDist) { bestDist = d; best = k; }
    }
    // optional: if bestDist > tol, you can push into a special "unclassified" bin
    return best;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i+1; j < n; j++) {
      const ip = dot(points[i], points[j]);
      const k = nearestCenterIndex(ip);
      edgesByLayer[k].push([i, j]);
    }
  }

  return { centers, edgesByLayer };
}

/**
 * Main summary: k-distance layers from inner products, then contact graph = max inner product layer.
 * tol is in inner-product space ([-1,1]).
 */
export function analyzeStructure(points: Vec3[], tol = 2e-3): StructureSummary {
  const n = points.length;
  const pairs = pairwiseInnerProducts(points); // i<j
  const vals = pairs.map((p) => p.v);

  const { centers, counts, labels } = cluster1D(vals, tol);
  const k = centers.length;

  const layered = buildEdgesByLayerFromCenters(points, centers, tol);

  // contact layer = largest inner product center (closest chordal distance)
  let contactLabel = 0;
  if (k > 1) {
    let best = centers[0];
    for (let t = 1; t < k; t++) {
      if (centers[t] > best) {
        best = centers[t];
        contactLabel = t;
      }
    }
  }

  const contactEdges: Array<[number, number]> = [];
  for (let t = 0; t < pairs.length; t++) {
    if (labels[t] === contactLabel) {
      contactEdges.push([pairs[t].i, pairs[t].j]);
    }
  }

  // const layers = buildEdgesByLayerFromCenters(points, centers, tol);

  return {
    n,
    tol,
    layer: { centers, counts, k, tol },
    layers: layered,
    contact: buildGraph(n, contactEdges),
  };
}
