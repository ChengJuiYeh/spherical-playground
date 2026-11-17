import type { Vec3 } from "./sim";

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
const dot = (a: Vec3, b: Vec3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const length = (a: Vec3) => Math.hypot(...a);
const unit = (a: Vec3): Vec3 => { const n = length(a); return [a[0]/n,a[1]/n,a[2]/n]; };

/** Visualization-only representatives. Never mutates the simulated points.
 * Tolerance is 1e-4 of the bounding-box diagonal (with a roundoff floor).
 * Rank 2 returns the planar polygon boundary; rank 1 returns its endpoints.
 */
export function hullSupport(input: Vec3[]): { dimension: number; points: Vec3[]; tolerance: number } {
  if (!input.length || input.some(p => p.some(x => !Number.isFinite(x)))) return { dimension: -1, points: [], tolerance: 0 };
  const span = [0,1,2].map(k => Math.max(...input.map(p=>p[k]))-Math.min(...input.map(p=>p[k])));
  const scale = Math.hypot(...span);
  const magnitude = Math.max(1, ...input.flat().map(Math.abs));
  const tolerance = Math.max(scale * 1e-4, magnitude * Number.EPSILON * 64);
  const points: Vec3[] = [];
  for (const p of input) if (!points.some(q => length(sub(p,q)) <= tolerance)) points.push([...p]);
  const a = points[0];
  if (points.length === 1) return { dimension: 0, points, tolerance };
  const b = points.reduce((best,p)=>length(sub(p,a))>length(sub(best,a))?p:best,a);
  const u = unit(sub(b,a));
  const c = points.reduce((best,p)=>length(cross(sub(p,a),u))>length(cross(sub(best,a),u))?p:best,a);
  if (length(cross(sub(c,a),u)) <= tolerance) {
    const sorted = [...points].sort((p,q)=>dot(sub(p,a),u)-dot(sub(q,a),u));
    return { dimension: 1, points: [sorted[0], sorted[sorted.length-1]], tolerance };
  }
  const normal = unit(cross(u,sub(c,a)));
  if (points.some(p=>Math.abs(dot(sub(p,a),normal))>tolerance)) return { dimension: 3, points, tolerance };
  const v = cross(normal,u);
  const projected = points.map(p=>({x:dot(sub(p,a),u), y:dot(sub(p,a),v)})).sort((p,q)=>p.x-q.x||p.y-q.y);
  type Point2 = typeof projected[number];
  const turn = (p: Point2,q: Point2,r: Point2)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const half = (list: Point2[]) => {
    const out: Point2[]=[];
    for(const p of list){ while(out.length>=2 && turn(out[out.length-2],out[out.length-1],p)<=0) out.pop(); out.push(p); }
    return out.slice(0,-1);
  };
  const boundary = [...half(projected),...half([...projected].reverse())];
  return { dimension: 2, tolerance, points: boundary.map(p=>[a[0]+u[0]*p.x+v[0]*p.y,a[1]+u[1]*p.x+v[1]*p.y,a[2]+u[2]*p.x+v[2]*p.y]) };
}
