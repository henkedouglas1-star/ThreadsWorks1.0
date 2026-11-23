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

function useColor(hex?: string, fallback = "#A16207") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function CapybaraModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  const furColor = useColor(config.appearance?.skinTone || "#A16207", "#A16207");
  const furMuzzle = useColor(config.appearance?.hairColor || "#78350F", "#78350F");
  const outfitColor = useColor(config.clothing?.color || "#F59E0B", "#F59E0B");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#451A03", "#451A03");
  const shoesColor = useColor(config.clothing?.shoesColor || "#FDE047", "#FDE047");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 1.2) * 0.01;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.6) * 0.02;
      headGroupRef.current.rotation.z = Math.cos(t * 0.5) * 0.008;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 1.0) * 0.03;
      rightArmRef.current.rotation.x = -Math.sin(t * 1.0) * 0.03;
    }
  });

  const expression = config.expression || "zen";
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
      {hasSparkles && <AuraSparkles count={18} color="#F59E0B" />}

      {/* ------------------------------------------------------------------ */}
      {/* 1. CAPYBARA FEET & BOOTS */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.17, 0.07, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.12, 0.26]} />
          <meshStandardMaterial color={shoesColor} roughness={0.5} />
        </mesh>
      </group>
      <group position={[0.17, 0.07, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.12, 0.26]} />
          <meshStandardMaterial color={shoesColor} roughness={0.5} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. LEGS & LOWER BODY */}
      {/* ------------------------------------------------------------------ */}
      <mesh castShadow position={[-0.17, 0.36, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.46, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0.17, 0.36, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.46, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.33, 0.3, 0.16, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. STOCKY BARREL TORSO & COZY OUTFIT */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0.92, 0]}>
        <mesh castShadow receiveShadow scale={[1.1, 1.0, 1.1]}>
          <cylinderGeometry args={[0.36, 0.33, 0.48, 24]} />
          <meshStandardMaterial color={outfitColor} roughness={0.75} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh castShadow position={[0, 1.18, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.12, 20]} />
        <meshStandardMaterial color={furColor} roughness={0.7} />
      </mesh>

      {/* Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.16} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.36} offsetY={0.88} />}

      {/* ------------------------------------------------------------------ */}
      {/* 4. CHILL CAPYBARA ARMS & PAWS */}
      {/* ------------------------------------------------------------------ */}
      <group ref={leftArmRef} position={[-0.38, 1.08, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[-0.03, -0.2, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.08, 0.075, 0.36, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[-0.06, -0.38, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={furMuzzle} roughness={0.8} />
        </mesh>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.08, -0.38, 0.08]} />}
      </group>

      <group ref={rightArmRef} position={[0.38, 1.08, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.03, -0.2, 0]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.08, 0.075, 0.36, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.06, -0.38, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={furMuzzle} roughness={0.8} />
        </mesh>
        {hasMic && <Prop3D type="mic" handPosition={[0.1, -0.36, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. CAPYBARA HEAD (SIGNATURE RECTANGULAR SNOUT & CALM EXPRESSION) */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.44, 0]}>
        {/* Main Head Base */}
        <mesh castShadow receiveShadow position={[0, 0, -0.04]} scale={[1.0, 0.95, 1.0]}>
          <sphereGeometry args={[0.26, 28, 28]} />
          <meshStandardMaterial color={furColor} roughness={0.7} />
        </mesh>

        {/* Signature Boxy Capybara Snout */}
        <group position={[0, -0.04, 0.16]}>
          <mesh castShadow scale={[1.2, 0.9, 1.4]}>
            <boxGeometry args={[0.24, 0.22, 0.2]} />
            <meshStandardMaterial color={furColor} roughness={0.7} />
          </mesh>

          {/* Darker Muzzle Front */}
          <mesh position={[0, -0.02, 0.15]}>
            <boxGeometry args={[0.22, 0.16, 0.08]} />
            <meshStandardMaterial color={furMuzzle} roughness={0.8} />
          </mesh>

          {/* Nostrils */}
          <mesh position={[-0.045, 0.02, 0.195]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshStandardMaterial color="#291407" />
          </mesh>
          <mesh position={[0.045, 0.02, 0.195]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshStandardMaterial color="#291407" />
          </mesh>

          {/* Calm Capybara Line Mouth */}
          <mesh position={[0, -0.05, 0.195]}>
            <boxGeometry args={[0.08, 0.008, 0.01]} />
            <meshStandardMaterial color="#291407" />
          </mesh>
        </group>

        {/* Small Rounded Ears Set Back */}
        <mesh position={[-0.22, 0.16, -0.06]} rotation={[0, 0, -0.4]}>
          <sphereGeometry args={[0.055, 12, 12]} scale={[1, 1, 0.5]} />
          <meshStandardMaterial color={furMuzzle} roughness={0.8} />
        </mesh>
        <mesh position={[0.22, 0.16, -0.06]} rotation={[0, 0, 0.4]}>
          <sphereGeometry args={[0.055, 12, 12]} scale={[1, 1, 0.5]} />
          <meshStandardMaterial color={furMuzzle} roughness={0.8} />
        </mesh>

        {/* Calm Peaceful Eyes */}
        <group position={[0, 0.06, 0.14]}>
          {expression === "surprised" ? (
            <>
              <mesh position={[-0.13, 0, 0]}>
                <sphereGeometry args={[0.028, 12, 12]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
              <mesh position={[0.13, 0, 0]}>
                <sphereGeometry args={[0.028, 12, 12]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
            </>
          ) : (
            // Chill peaceful horizontal slit eyes
            <>
              <mesh position={[-0.13, 0, 0]} rotation={[0, 0, 0.05]}>
                <boxGeometry args={[0.06, 0.014, 0.02]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
              <mesh position={[0.13, 0, 0]} rotation={[0, 0, -0.05]}>
                <boxGeometry args={[0.06, 0.014, 0.02]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
            </>
          )}
        </group>

        {/* Iconic Hot Spring Yuzu Orange on Head if no hat */}
        {hatStyle === "none" && !hasCrown && (
          <group position={[0, 0.28, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.065, 16, 16]} />
              <meshStandardMaterial color="#F59E0B" roughness={0.4} />
            </mesh>
            {/* Tiny green leaf */}
            <mesh position={[0.02, 0.06, 0]} rotation={[0, 0, 0.4]}>
              <boxGeometry args={[0.03, 0.01, 0.02]} />
              <meshStandardMaterial color="#10B981" />
            </mesh>
          </group>
        )}

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.18} headRadius={0.25} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.26} offsetY={0.05} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.27} offsetY={0.04} />}
      </group>
    </group>
  );
}
