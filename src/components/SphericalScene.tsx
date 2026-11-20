// src/components/SphericalScene.tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { InstancedMesh } from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { hullSupport } from "@/lib/hullSupport";
import { sphereRadius } from "@/lib/sim";
import { useSimStore } from "../store/useSimStore";

function SceneContents() {
  const points = useSimStore((s) => s.points);
  const radius = useSimStore((s) => sphereRadius(s.pot));


  // ---- Instanced points (red) ----
  const instRef = useRef<InstancedMesh>(null);
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;

    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = points[i];
      tempObj.position.set(x, y, z);
      tempObj.updateMatrix();
      inst.setMatrixAt(i, tempObj.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [points, tempObj]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 2, 2]} intensity={1.2} />

      {/* Controls */}
      <OrbitControls enableDamping />

      {/* unit sphere */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial wireframe transparent opacity={0.18} />
      </mesh>

      <SphericalHull />

      {/* instanced red points */}
      <instancedMesh ref={instRef} args={[undefined, undefined, points.length]}>
        <sphereGeometry args={[0.01 * radius, 16, 16]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0.35} />
      </instancedMesh>
    </>
  );
}

function SphericalHull() {
  const points = useSimStore((s) => s.points);
  const visible = useSimStore((s) => s.nearConverged || s.loadedHullPreview);
  const geometry = useMemo(() => {
    if (!visible) return null;
    const support = hullSupport(points);
    const vertices = support.points.map(p => new THREE.Vector3(...p));
    if (support.dimension <= 0) return null; // The existing particle marks the point hull.
    if (support.dimension === 1) {
      return { faces: null, edges: new THREE.BufferGeometry().setFromPoints(vertices) };
    }
    if (support.dimension === 2) {
      const triangles: THREE.Vector3[] = [];
      const boundary: THREE.Vector3[] = [];
      for (let i = 1; i < vertices.length - 1; i++) triangles.push(vertices[0], vertices[i], vertices[i+1]);
      for (let i = 0; i < vertices.length; i++) boundary.push(vertices[i], vertices[(i+1)%vertices.length]);
      const faces = new THREE.BufferGeometry().setFromPoints(triangles);
      faces.computeVertexNormals();
      return { faces, edges: new THREE.BufferGeometry().setFromPoints(boundary) };
    }
    let faces: THREE.BufferGeometry | null = null;
    try {
      faces = new ConvexGeometry(vertices);
      return { faces, edges: new THREE.EdgesGeometry(faces) };
    } catch {
      faces?.dispose();
      return null; // Keep the particles visible even if geometry is numerically degenerate.
    }
  }, [visible, points]);
  useEffect(() => () => {
    geometry?.faces?.dispose();
    geometry?.edges.dispose();
  }, [geometry]);
  if (!geometry) return null;
  return (
    <group>
      {geometry.faces && (
        <mesh geometry={geometry.faces}>
          <meshStandardMaterial color="#55d6ff" transparent opacity={0.14}
            roughness={0.25} metalness={0.1} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      <lineSegments geometry={geometry.edges}>
        <lineBasicMaterial color="black" transparent opacity={0.85} />
      </lineSegments>
    </group>
  );
}

export default function SphericalScene() {
  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
        <SceneContents />
      </Canvas>
    </div>
  );
}
