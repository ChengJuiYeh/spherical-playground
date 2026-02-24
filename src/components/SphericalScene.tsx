// src/components/SphericalScene.tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { InstancedMesh } from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { useSimStore } from "../store/useSimStore";

function SceneContents() {
  const points = useSimStore((s) => s.points);
  const step = useSimStore((s) => s.step);
  const nearConverged = useSimStore((s) => s.nearConverged);

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

  // ---- Convex hull (only rebuild occasionally, and only near convergence) ----
  // 這個 roundStep 讓 hull 不會每一步都重建（重建幾何比較貴）
  const roundStep = Math.floor(step / 10);

  const hullGeometry = useMemo(() => {
    if (!nearConverged) return null;
    if (points.length < 4) return null;

    // ConvexGeometry expects Vector3[]
    const verts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    try {
      return new ConvexGeometry(verts);
    } catch {
      return null;
    }
  }, [nearConverged, roundStep, points]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 2, 2]} intensity={1.2} />

      {/* Controls */}
      <OrbitControls enableDamping />

      {/* unit sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial wireframe transparent opacity={0.18} />
      </mesh>

      {/* convex hull overlay */}
      {hullGeometry && (
        <group>
          {/* hull faces */}
          <mesh geometry={hullGeometry}>
            <meshStandardMaterial
              color="#55d6ff"
              transparent
              opacity={0.14}
              roughness={0.25}
              metalness={0.1}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* hull edges */}
          <lineSegments geometry={new THREE.EdgesGeometry(hullGeometry)}>
            <lineBasicMaterial color="black" transparent opacity={0.85} />
          </lineSegments>
        </group>
      )}

      {/* instanced red points */}
      <instancedMesh ref={instRef} args={[undefined, undefined, points.length]}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshStandardMaterial color="#ff3b3b" emissive="#ff3b3b" emissiveIntensity={0.35} />
      </instancedMesh>
    </>
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
