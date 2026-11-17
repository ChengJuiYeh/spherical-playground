"use client";

import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls, useBounds } from "@react-three/drei";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { hullSupport } from "@/lib/hullSupport";
import { useSimStore } from "@/store/useSimStore";

function Cloud() {
  const points = useSimStore((s) => s.points);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    points.forEach((p, i) => {
      transform.position.set(...p);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(i, transform.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    mesh.current.computeBoundingBox();
  }, [points, transform]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, points.length]} frustumCulled={false}>
      <sphereGeometry args={[0.015, 16, 16]} />
      <meshStandardMaterial color="#ff3b3b" />
    </instancedMesh>
  );
}

function ConvergenceHull() {
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

// Frame the initial cloud once; subsequent camera control belongs to the user.
function InitialView() {
  const bounds = useBounds();
  useEffect(() => { bounds.refresh().clip().fit(); }, [bounds]);
  return null;
}

// Three full axes, each six units long, with a quiet charcoal-gray finish.
function NeutralAxes() {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-3, 0, 0), new THREE.Vector3(3, 0, 0),
    new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 3, 0),
    new THREE.Vector3(0, 0, -3), new THREE.Vector3(0, 0, 3),
  ]), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#555555" transparent opacity={0.45} depthWrite={false} />
    </lineSegments>
  );
}

export default function FreeSpaceScene() {
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 2, 2]} intensity={1.2} />
        <OrbitControls makeDefault enableDamping />
        <NeutralAxes />
        <Bounds margin={1.4}>
          <Cloud />
          <ConvergenceHull />
          <InitialView />
        </Bounds>
      </Canvas>
    </div>
  );
}