"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ConnectedBlocks() {
  const count = 60;
  const maxDistance = 3.5;
  
  // Create random blocks
  const blocks = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 10
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      ),
      rotation: new THREE.Vector3(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      )
    }));
  }, []);

  const linesRef = useRef<THREE.LineSegments>(null);
  const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

  const linesGeometry = useMemo(() => new THREE.BufferGeometry(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const positions: number[] = [];
    
    // Update blocks
    for (let i = 0; i < count; i++) {
      const b = blocks[i];
      b.position.add(b.velocity);
      b.rotation.add(b.rotationSpeed);

      // Bounce off walls softly
      if (b.position.x > 10 || b.position.x < -10) b.velocity.x *= -1;
      if (b.position.y > 7.5 || b.position.y < -7.5) b.velocity.y *= -1;
      if (b.position.z > 5 || b.position.z < -5) b.velocity.z *= -1;

      // Update instance matrix
      if (instancedMeshRef.current) {
        dummy.position.copy(b.position);
        dummy.rotation.set(b.rotation.x, b.rotation.y, b.rotation.z);
        dummy.updateMatrix();
        instancedMeshRef.current.setMatrixAt(i, dummy.matrix);
      }

      // Check connections
      for (let j = i + 1; j < count; j++) {
        const b2 = blocks[j];
        const dist = b.position.distanceTo(b2.position);
        if (dist < maxDistance) {
          positions.push(
            b.position.x, b.position.y, b.position.z,
            b2.position.x, b2.position.y, b2.position.z
          );
        }
      }
    }

    if (instancedMeshRef.current) {
      instancedMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (linesRef.current) {
      linesRef.current.geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
      );
    }
  });

  return (
    <group>
      <instancedMesh ref={instancedMeshRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshPhysicalMaterial 
          color="#000000" // Black blocks
          metalness={0.7} 
          roughness={0.3} 
          clearcoat={1}
          clearcoatRoughness={0.2}
          emissive="#111111" // Extremely subtle lift from pure black
          emissiveIntensity={0.2}
        />
      </instancedMesh>
      <lineSegments ref={linesRef} geometry={linesGeometry}>
        {/* Dark subtle lines */}
        <lineBasicMaterial color="#333333" transparent opacity={0.6} /> 
      </lineSegments>
    </group>
  );
}

export default function HeroBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none" style={{ height: "100%", width: "100%" }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
        <ambientLight intensity={0.4} />
        {/* Lights placed to catch the edges of the black blocks */}
        <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
        <directionalLight position={[-10, -10, -5]} intensity={1.5} color="#a855f7" />
        
        {/* Adds a slow rotation to the entire network for a cinematic feel */}
        <group rotation={[0.2, 0.2, 0]}>
          <ConnectedBlocks />
        </group>
      </Canvas>
    </div>
  );
}
