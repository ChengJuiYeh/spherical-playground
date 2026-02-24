// src/components/SphericalGraphScene.tsx
"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { useSimStore } from "@/store/useSimStore";

export default function SphericalGraphScene({
  edgesByLayer,
  selectedLayer,
  onHoverVertex,
  hoverVertex,
}: {
  edgesByLayer: Array<Array<[number, number]>>;
  selectedLayer: number;
  hoverVertex: number | null;
  onHoverVertex: (i: number | null) => void;
}) {
  const points = useSimStore((s) => s.points);

  const layerEdges = edgesByLayer[selectedLayer] ?? [];

  const positions = useMemo(() => {
    if (hoverVertex === null) return null;
    const verts: number[] = [];
    for (const [i, j] of layerEdges) {
      if (i !== hoverVertex && j !== hoverVertex) continue;
      const a = points[i];
      const b = points[j];
      verts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    if (verts.length === 0) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geom;
  }, [hoverVertex, layerEdges, points]);

  const lineColor = useMemo(() => {
    const k = edgesByLayer.length;
    const t = k <= 1 ? 0 : selectedLayer / (k - 1);
    const c = new THREE.Color().setHSL(0.58 - 0.58 * t, 0.9, 0.5); // sky->red-ish
    return c;
  }, [edgesByLayer.length, selectedLayer]);

  const hoveredEdges = useMemo(() => {
    if (hoverVertex === null) return [];
    const out: Array<[Vec3, Vec3]> = [];
    for (const [i, j] of layerEdges) {
      if (i !== hoverVertex && j !== hoverVertex) continue;
      out.push([points[i], points[j]]);
    }
    return out;
  }, [hoverVertex, layerEdges, points]);

  return (
    <Canvas camera={{ position: [0, 0, 3.0], fov: 45 }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 2, 2]} intensity={0.7} />

      {/* wire sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial wireframe transparent opacity={0.7} />
      </mesh>

      {/* points */}
      {points.map((p, i) => (
        <mesh
          key={i}
          position={[p[0], p[1], p[2]]}
          onPointerOver={(e) => { e.stopPropagation(); onHoverVertex(i); }}
          onPointerOut={(e) => { e.stopPropagation(); onHoverVertex(null); }}
        >
          <sphereGeometry args={[0.01, 16, 16]} />
          <meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0.35} />
        </mesh>
      ))}

      {/* highlighted edges for selected layer + hovered vertex */}
      {hoverVertex !== null && hoveredEdges.length > 0 && (
        <>
          {hoveredEdges.map(([a, b], idx) => (
            <Line
              key={idx}
              points={[
                new THREE.Vector3(a[0], a[1], a[2]),
                new THREE.Vector3(b[0], b[1], b[2]),
              ]}
              color={lineColor}
              lineWidth={3}
              transparent
              opacity={0.95}
            />
          ))}
        </>
      )}

      <OrbitControls enableDamping />
    </Canvas>
  );
}
