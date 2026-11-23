import React, { useRef, useMemo, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { CharacterAvatarConfig } from "../../types";
import {
  RotateCcw,
  Sparkles,
  Play,
  Pause,
} from "lucide-react";
import {
  HumanModel,
  RoboModel,
  CatModel,
  PandaModel,
  CapybaraModel,
  FoxModel,
  BunnyModel,
  OwlModel,
  PixelModel,
} from "./models";

interface CharacterFiberCanvasProps {
  config: CharacterAvatarConfig;
  className?: string;
  autoRotate?: boolean;
  interactive?: boolean;
  showControls?: boolean;
  height?: string | number;
}

// =============================================================================
// 3D SHOWROOM PEDESTAL COMPONENT
// =============================================================================
function ShowroomPedestal({ backdrop }: { backdrop?: string }) {
  const rimColor = useMemo(() => {
    switch (backdrop) {
      case "gradient-sunset":
        return "#F59E0B";
      case "gradient-cyber":
        return "#06B6D4";
      case "gradient-emerald":
        return "#10B981";
      case "studio-dark":
        return "#6366F1";
      case "gradient-purple":
      default:
        return "#8B5CF6";
    }
  }, [backdrop]);

  return (
    <group position={[0, -0.05, 0]}>
      {/* Main Base Cylinder */}
      <mesh receiveShadow position={[0, -0.06, 0]}>
        <cylinderGeometry args={[1.35, 1.45, 0.12, 48]} />
        <meshStandardMaterial
          color="#1E293B"
          roughness={0.4}
          metalness={0.2}
        />
      </mesh>

      {/* Glossy Top Inset Disc */}
      <mesh receiveShadow position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.32, 48]} />
        <meshStandardMaterial
          color="#0F172A"
          roughness={0.25}
          metalness={0.5}
        />
      </mesh>

      {/* Glowing Neon Ring Rim */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.28, 1.34, 48]} />
        <meshStandardMaterial
          color={rimColor}
          emissive={rimColor}
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Outer Ground Contact Shadow Disc */}
      <mesh position={[0, -0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.85, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

// =============================================================================
// DYNAMIC 3D CHARACTER DISPATCHER (All 9+ Archetypes)
// =============================================================================
function DynamicCharacter3D({ config }: { config: CharacterAvatarConfig }) {
  const base = config.baseCharacter || "human-creator";

  switch (base) {
    case "robo-buddy":
      return <RoboModel config={config} />;
    case "cosmic-cat":
    case "cat":
      return <CatModel config={config} />;
    case "zen-panda":
    case "panda":
      return <PandaModel config={config} />;
    case "capybara-craft":
    case "capybara":
      return <CapybaraModel config={config} />;
    case "fox-strategist":
    case "fox":
      return <FoxModel config={config} />;
    case "cyber-bunny":
    case "bunny":
      return <BunnyModel config={config} />;
    case "owl-scholar":
    case "owl":
      return <OwlModel config={config} />;
    case "minimal-pixel":
    case "pixel-pioneer":
    case "pixel":
      return <PixelModel config={config} />;
    case "human-creator":
    default:
      return <HumanModel config={config} />;
  }
}

// =============================================================================
// MAIN FIBER CANVAS COMPONENT WITH ORBITCONTROLS
// =============================================================================
export default function CharacterFiberCanvas({
  config,
  className = "",
  autoRotate = false,
  interactive = true,
  showControls = true,
  height = "440px",
}: CharacterFiberCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [isRotating, setIsRotating] = useState(autoRotate);

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(0, 0.95, 0);
    }
  };

  const setViewAngle = (preset: "front" | "portrait" | "profile") => {
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    if (preset === "front") {
      controls.object.position.set(0, 1.05, 3.6);
      controls.target.set(0, 0.92, 0);
    } else if (preset === "portrait") {
      controls.object.position.set(0, 1.58, 1.8);
      controls.target.set(0, 1.58, 0);
    } else if (preset === "profile") {
      controls.object.position.set(3.4, 1.05, 0);
      controls.target.set(0, 0.92, 0);
    }
    controls.update();
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl select-none ${className}`}
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* REACT THREE FIBER CANVAS WITH ORBITCONTROLS */}
      {/* ------------------------------------------------------------------ */}
      <Canvas
        shadows
        camera={{ position: [0, 1.05, 3.6], fov: 36 }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        {/* Studio Three-Point Lighting */}
        <ambientLight intensity={0.9} />
        
        {/* Key Directional Light */}
        <directionalLight
          position={[3.5, 5, 4]}
          intensity={1.5}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.001}
        />

        {/* Cool Fill Light */}
        <directionalLight position={[-3.5, 3, 2]} intensity={0.8} color="#E0F2FE" />

        {/* Rim / Halo Backlight */}
        <directionalLight position={[0, 4.5, -3.5]} intensity={0.9} color="#C084FC" />

        {/* Ground Warm Bounce */}
        <directionalLight position={[0, -2, 2]} intensity={0.3} color="#FFE4E6" />

        {/* 3D Scene Objects */}
        <Suspense fallback={null}>
          <ShowroomPedestal backdrop={config.backdrop} />
          <DynamicCharacter3D config={config} />
        </Suspense>

        {/* OrbitControls for smooth 360-degree rotation */}
        <OrbitControls
          ref={controlsRef}
          enabled={interactive}
          enableRotate={true}
          enableZoom={true}
          enablePan={false}
          autoRotate={isRotating}
          autoRotateSpeed={1.8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2 + 0.08}
          minDistance={1.5}
          maxDistance={5.5}
          dampingFactor={0.06}
          target={[0, 0.92, 0]}
        />
      </Canvas>

      {/* ------------------------------------------------------------------ */}
      {/* INTERACTIVE CONTROLS HUD & CAMERA PRESETS OVERLAY */}
      {/* ------------------------------------------------------------------ */}
      {showControls && (
        <div className="absolute inset-x-3 top-3 flex items-center justify-between pointer-events-none">
          {/* Top Left: 360° Interaction Hint Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-bg-app/90 backdrop-blur-md border border-border-primary text-[11px] font-semibold text-text-primary shadow-xs pointer-events-auto">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>360° 3D Showroom</span>
          </div>

          {/* Top Right: Camera Presets & Auto-Rotate Controls */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {/* Auto-Rotate Toggle Button */}
            <button
              type="button"
              onClick={() => setIsRotating((prev) => !prev)}
              title={isRotating ? "Pause 360° Spin" : "Auto-Rotate 360°"}
              className={`p-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-xs ${
                isRotating
                  ? "bg-purple-600 text-white border-purple-500 shadow-purple-500/20"
                  : "bg-bg-app/90 hover:bg-bg-card border-border-primary text-text-muted hover:text-text-primary"
              }`}
            >
              {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="text-[10px] hidden sm:inline">{isRotating ? "Spinning" : "Spin"}</span>
            </button>

            {/* Reset Camera Button */}
            <button
              type="button"
              onClick={resetCamera}
              title="Reset 3D Camera Angle"
              className="p-1.5 rounded-xl bg-bg-app/90 hover:bg-bg-card border border-border-primary text-text-muted hover:text-text-primary text-xs transition cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Camera Angle Preset Shortcuts */}
      {showControls && (
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between pointer-events-none">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-bg-app/90 backdrop-blur-md border border-border-primary shadow-xs pointer-events-auto">
            <button
              type="button"
              onClick={() => setViewAngle("front")}
              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-bg-card transition cursor-pointer"
            >
              Full Body
            </button>
            <button
              type="button"
              onClick={() => setViewAngle("portrait")}
              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-bg-card transition cursor-pointer"
            >
              Portrait
            </button>
            <button
              type="button"
              onClick={() => setViewAngle("profile")}
              className="px-2 py-0.5 rounded-lg text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-bg-card transition cursor-pointer"
            >
              Profile
            </button>
          </div>

          <div className="text-[10px] font-mono text-text-muted/80 bg-bg-app/80 backdrop-blur-xs px-2 py-0.5 rounded-lg border border-border-primary/50 pointer-events-auto">
            OrbitControls • Drag to Rotate
          </div>
        </div>
      )}
    </div>
  );
}
