"use client";

// ───────────────────────────────────────────────────────────────────
// THE ROOM — real-3D (R3F). Camera lives at the center; turning yaws it to
// face a wall, approaching dollies it toward the faced wall. Each wall has
// distinct threshold geometry (screen / cabinets / podium+greeter / door).
// Atmosphere = fog + emissive glow + bloom. Floor = the compass medallion.
// ───────────────────────────────────────────────────────────────────

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Suspense } from "react";
import * as THREE from "three";
import { WALLS, R, H, EYE, N, type Phase } from "./walls";

const FWD = new THREE.Vector3();

function dollyDist(phase: Phase, isDesk: boolean) {
  if (phase === "room") return 0;
  if (phase === "through") return isDesk ? 2.2 : 3.6;
  return isDesk ? 1.8 : 2.8; // approach / open
}

// drive the camera from face (yaw) + phase (dolly), frame-rate independent
function CameraRig({ face, phase }: { face: number; phase: Phase }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const targetYaw = -face * (Math.PI / 2);
    camera.rotation.order = "YXZ";
    camera.rotation.y = THREE.MathUtils.damp(camera.rotation.y, targetYaw, 5, dt);
    camera.rotation.x = THREE.MathUtils.damp(camera.rotation.x, 0, 5, dt);

    const cur = ((face % N) + N) % N;
    const isDesk = WALLS[cur].id === "desk";
    const dist = dollyDist(phase, isDesk);
    FWD.set(-Math.sin(targetYaw), 0, -Math.cos(targetYaw));
    camera.position.x = THREE.MathUtils.damp(camera.position.x, FWD.x * dist, 5, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, FWD.z * dist, 5, dt);
    camera.position.y = EYE;
  });
  return null;
}

function Floor() {
  const tex = useTexture("/room/floor.webp");
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[R * 2, R * 2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

// the distinct "threshold" each wall presents (stand-in geometry; art later)
function Threshold({ id, accent }: { id: string; accent: string }) {
  if (id === "shimmer") {
    // a screen / TV
    return (
      <group position={[0, 0, 0.06]}>
        <mesh>
          <planeGeometry args={[5.2, 3]} />
          <meshStandardMaterial color="#08080f" emissive={accent} emissiveIntensity={0.5} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[4.7, 2.6]} />
          <meshStandardMaterial color="#05050a" emissive={accent} emissiveIntensity={0.18} />
        </mesh>
      </group>
    );
  }
  if (id === "arcade") {
    // a row of cabinets receding feel — small glowing screens
    const cols = [-2.2, -1.1, 0, 1.1, 2.2];
    return (
      <group position={[0, -0.6, 0.06]}>
        {cols.map((x, i) => (
          <group key={i} position={[x, 0, 0]}>
            <mesh>
              <planeGeometry args={[0.8, 2.4]} />
              <meshStandardMaterial color="#0c0c16" emissive={accent} emissiveIntensity={0.12} />
            </mesh>
            <mesh position={[0, 0.55, 0.01]}>
              <planeGeometry args={[0.55, 0.5]} />
              <meshStandardMaterial color="#0c0c16" emissive={["#8b5cf6", "#00cccc", "#d4a843", "#4ade80", "#f87171"][i]} emissiveIntensity={0.7} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (id === "magii") {
    // a glowing doorway, floor-anchored
    return (
      <group position={[0, -0.5, 0.06]}>
        <mesh>
          <planeGeometry args={[2.6, 4]} />
          <meshStandardMaterial color="#1a0f06" emissive={accent} emissiveIntensity={0.45} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[2.1, 3.5]} />
          <meshStandardMaterial color="#0a0602" emissive={accent} emissiveIntensity={0.2} />
        </mesh>
      </group>
    );
  }
  // desk: a podium + a glowing greeter behind it
  return (
    <group position={[0, 0, 1.0]}>
      {/* podium */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.8, 1.2, 0.6]} />
        <meshStandardMaterial color="#0e1820" emissive={accent} emissiveIntensity={0.15} />
      </mesh>
      {/* greeter: body + head */}
      <mesh position={[0, 1.5, -0.5]}>
        <cylinderGeometry args={[0.35, 0.55, 1.3, 16]} />
        <meshStandardMaterial color="#16202a" emissive={accent} emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 2.35, -0.5]}>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshStandardMaterial color="#1b2630" emissive={accent} emissiveIntensity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Room() {
  return (
    <group>
      <Suspense fallback={null}>
        <Floor />
      </Suspense>

      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]}>
        <planeGeometry args={[R * 2, R * 2]} />
        <meshStandardMaterial color="#0a0a12" side={THREE.DoubleSide} />
      </mesh>

      {/* walls + their thresholds */}
      {WALLS.map((w) => (
        <group key={w.id} position={w.pos} rotation={w.rot}>
          <mesh>
            <planeGeometry args={[R * 2, H]} />
            <meshStandardMaterial color="#0b0b14" emissive={w.accent} emissiveIntensity={0.05} side={THREE.DoubleSide} />
          </mesh>
          {/* glowing baseboard seam (where wall meets floor) */}
          <mesh position={[0, -H / 2 + 0.04, 0.05]}>
            <planeGeometry args={[R * 2, 0.06]} />
            <meshStandardMaterial color="#000" emissive={w.accent} emissiveIntensity={0.9} toneMapped={false} />
          </mesh>
          <Threshold id={w.id} accent={w.accent} />
        </group>
      ))}
    </group>
  );
}

export default function RoomScene({ face, phase }: { face: number; phase: Phase }) {
  return (
    <Canvas camera={{ position: [0, EYE, 0], fov: 75, near: 0.1, far: 100 }} dpr={[1, 2]}>
      <color attach="background" args={["#06060a"]} />
      <fog attach="fog" args={["#06060a", 5, 22]} />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, H - 0.6, 0]} intensity={9} distance={26} color="#fff6e0" />
      <pointLight position={[0, 2, -R + 0.7]} intensity={4} distance={11} color="#8b5cf6" />
      <pointLight position={[R - 0.7, 2, 0]} intensity={4} distance={11} color="#d4a843" />
      <pointLight position={[0, 2, R - 0.7]} intensity={4} distance={11} color="#00cccc" />
      <pointLight position={[-R + 0.7, 2, 0]} intensity={4} distance={11} color="#e0792f" />

      <Suspense fallback={null}>
        <Room />
      </Suspense>

      <CameraRig face={face} phase={phase} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.7} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  );
}
