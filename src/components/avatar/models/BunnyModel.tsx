import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CharacterAvatarConfig } from "../../../types";
import {
  Eyewear3D,
  Headphones3D,
  NeckJewelry3D,
  Bag3D,
  Prop3D,
  Hat3D,
  AuraSparkles,
} from "./SharedAccessories3D";

interface ModelProps {
  config: CharacterAvatarConfig;
}

function useColor(hex?: string, fallback = "#EC4899") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function BunnyModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const leftEarRef = useRef<THREE.Group>(null);
  const rightEarRef = useRef<THREE.Group>(null);

  const furColor = useColor(config.appearance?.skinTone || "#FDE2E4", "#FDE2E4");
  const glowColor = useColor(config.appearance?.hairColor || "#EC4899", "#EC4899");
  const outfitColor = useColor(config.clothing?.color || "#8B5CF6", "#8B5CF6");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#06B6D4", "#06B6D4");
  const shoesColor = useColor(config.clothing?.shoesColor || "#EC4899", "#EC4899");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 2.2) * 0.018;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 1.1) * 0.035;
      headGroupRef.current.rotation.z = Math.cos(t * 0.8) * 0.015;
    }
    if (leftEarRef.current && rightEarRef.current) {
      leftEarRef.current.rotation.z = -0.08 + Math.sin(t * 3.0) * 0.05;
      leftEarRef.current.rotation.x = Math.cos(t * 2.5) * 0.04;
      rightEarRef.current.rotation.z = 0.08 - Math.sin(t * 3.0) * 0.05;
      rightEarRef.current.rotation.x = -Math.cos(t * 2.5) * 0.04;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 1.5) * 0.05;
      rightArmRef.current.rotation.x = -Math.sin(t * 1.5) * 0.05;
    }
  });

  const expression = config.expression || "excited";
  const hatStyle = config.clothing?.hat || "none";
  const accessories = config.accessories || [];

  const hasGlasses = accessories.find((a) => ["glasses", "wayfarer", "sunglasses", "geek-chic"].includes(a)) as
    | "glasses"
    | "wayfarer"
    | "sunglasses"
    | "geek-chic"
    | undefined;
  const hasHeadphones = accessories.find((a) => ["headphones", "neon-headphones", "earbuds"].includes(a)) as
    | "headphones"
    | "neon-headphones"
    | "earbuds"
    | undefined;
  const hasNecklace = accessories.find((a) => ["gold-chain", "pearls"].includes(a)) as "gold-chain" | "pearls" | undefined;
  const hasBag = accessories.find((a) => ["backpack", "crossbody", "tote"].includes(a)) as "backpack" | "crossbody" | "tote" | undefined;
  const hasCoffee = accessories.includes("coffee");
  const hasMic = accessories.includes("mic");
  const hasLaptop = accessories.includes("laptop");
  const hasCrown = accessories.includes("crown") || hatStyle === "crown";
  const hasRocket = accessories.includes("rocket");
  const hasSparkles = accessories.includes("sparkles");

  return (
    <group ref={modelGroupRef} position={[0, 0, 0]}>
      {hasSparkles && <AuraSparkles count={18} color="#EC4899" />}

      {/* ------------------------------------------------------------------ */}
      {/* 1. BUNNY PLATFORM RUNNER KICKS */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.16, 0.09, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.15, 0.28]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} />
        </mesh>
        {/* Glow Trim Sole */}
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.17, 0.02, 0.29]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.6} />
        </mesh>
      </group>

      <group position={[0.16, 0.09, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.15, 0.28]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.17, 0.02, 0.29]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.6} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. LEGS & LOWER BODY */}
      {/* ------------------------------------------------------------------ */}
      <mesh castShadow position={[-0.16, 0.44, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.56, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0.16, 0.44, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.56, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.6} />
      </mesh>

      <mesh castShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.26, 0.24, 0.16, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.6} />
      </mesh>

      {/* Fluffy Bunny Puff Tail in Back */}
      <mesh castShadow position={[0, 0.7, -0.16]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.8} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. TORSO & CYBER OUTFIT */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 1.0, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.29, 0.25, 0.48, 24]} />
          <meshStandardMaterial color={outfitColor} roughness={0.5} />
        </mesh>
        {/* Glowing Cyber Accent lines */}
        <mesh position={[0, 0, 0.135]}>
          <planeGeometry args={[0.2, 0.32]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.35} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh castShadow position={[0, 1.28, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.12, 16]} />
        <meshStandardMaterial color={furColor} roughness={0.5} />
      </mesh>

      {/* Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.24} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.29} offsetY={0.94} />}

      {/* ------------------------------------------------------------------ */}
      {/* 4. ARMS & BUNNY PAWS */}
      {/* ------------------------------------------------------------------ */}
      <group ref={leftArmRef} position={[-0.32, 1.18, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[-0.03, -0.22, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.07, 0.06, 0.38, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        {/* White Paw */}
        <mesh castShadow position={[-0.06, -0.42, 0]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
        </mesh>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.08, -0.42, 0.08]} />}
      </group>

      <group ref={rightArmRef} position={[0.32, 1.18, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.03, -0.22, 0]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.07, 0.06, 0.38, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.06, -0.42, 0]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
        </mesh>
        {hasMic && <Prop3D type="mic" handPosition={[0.1, -0.4, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. BUNNY HEAD, LONG EARS & EXPRESSION */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.54, 0]}>
        {/* Round Head */}
        <mesh castShadow receiveShadow scale={[1.02, 0.96, 1.0]}>
          <sphereGeometry args={[0.26, 32, 32]} />
          <meshStandardMaterial color={furColor} roughness={0.55} />
        </mesh>

        {/* Long Upright Expressive Bunny Ears with Cyber Glow */}
        <group ref={leftEarRef} position={[-0.14, 0.24, 0]}>
          <mesh castShadow scale={[0.6, 1.8, 0.5]}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.55} />
          </mesh>
          {/* Inner Glowing Pink/Cyber Ear Strip */}
          <mesh position={[0, 0.02, 0.04]} scale={[0.35, 1.4, 0.3]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.6} />
          </mesh>
        </group>

        <group ref={rightEarRef} position={[0.14, 0.24, 0]}>
          <mesh castShadow scale={[0.6, 1.8, 0.5]}>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.02, 0.04]} scale={[0.35, 1.4, 0.3]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.6} />
          </mesh>
        </group>

        {/* Cute Bunny Muzzle & Nose */}
        <group position={[0, -0.06, 0.22]}>
          <mesh position={[-0.04, 0, 0]}>
            <sphereGeometry args={[0.045, 16, 16]} scale={[1, 0.8, 0.8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
          </mesh>
          <mesh position={[0.04, 0, 0]}>
            <sphereGeometry args={[0.045, 16, 16]} scale={[1, 0.8, 0.8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
          </mesh>
          {/* Tiny Pink Bunny Nose */}
          <mesh position={[0, 0.03, 0.03]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.018, 0.016, 3]} />
            <meshStandardMaterial color="#F43F5E" roughness={0.2} />
          </mesh>
        </group>

        {/* Sparkling Big Eyes */}
        <group position={[0, 0.04, 0.22]}>
          {expression === "zen" || expression === "laughing" ? (
            <>
              <mesh position={[-0.09, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.035, 0.007, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
              <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.035, 0.007, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
            </>
          ) : (
            <>
              <group position={[-0.09, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.042, 16, 16]} />
                  <meshStandardMaterial color="#EC4899" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.015]} scale={[0.7, 0.9, 0.3]}>
                  <sphereGeometry args={[0.025, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.01, 0.01, 0.022]}>
                  <sphereGeometry args={[0.009, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>

              <group position={[0.09, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.042, 16, 16]} />
                  <meshStandardMaterial color="#EC4899" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.015]} scale={[0.7, 0.9, 0.3]}>
                  <sphereGeometry args={[0.025, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.01, 0.01, 0.022]}>
                  <sphereGeometry args={[0.009, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </>
          )}

          {/* Cheeks Blush */}
          <mesh position={[-0.14, -0.06, -0.02]}>
            <circleGeometry args={[0.035, 16]} />
            <meshBasicMaterial color="#FDA4AF" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.14, -0.06, -0.02]}>
            <circleGeometry args={[0.035, 16]} />
            <meshBasicMaterial color="#FDA4AF" transparent opacity={0.6} />
          </mesh>
        </group>

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.18} headRadius={0.25} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.26} offsetY={0.03} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.27} offsetY={0.03} />}
      </group>
    </group>
  );
}
