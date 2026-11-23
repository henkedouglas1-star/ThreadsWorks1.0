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

function useColor(hex?: string, fallback = "#F59E0B") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function CatModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);
  const leftEarRef = useRef<THREE.Group>(null);
  const rightEarRef = useRef<THREE.Group>(null);

  const furColor = useColor(config.appearance?.skinTone || "#F59E0B", "#F59E0B");
  const furAccent = useColor(config.appearance?.hairColor || "#FFFBEB", "#FFFBEB");
  const outfitColor = useColor(config.clothing?.color || "#8B5CF6", "#8B5CF6");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#3B82F6", "#3B82F6");
  const shoesColor = useColor(config.clothing?.shoesColor || "#FFFFFF", "#FFFFFF");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 1.8) * 0.015;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.9) * 0.035;
      headGroupRef.current.rotation.z = Math.cos(t * 0.7) * 0.015;
    }
    if (tailRef.current) {
      // Natural feline tail sine wave sway
      tailRef.current.rotation.y = Math.sin(t * 2.2) * 0.35;
      tailRef.current.rotation.z = 0.2 + Math.cos(t * 1.8) * 0.15;
    }
    if (leftEarRef.current && rightEarRef.current) {
      leftEarRef.current.rotation.z = -0.15 + Math.sin(t * 1.5) * 0.04;
      rightEarRef.current.rotation.z = 0.15 - Math.sin(t * 1.5) * 0.04;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 1.3) * 0.05;
      rightArmRef.current.rotation.x = -Math.sin(t * 1.3) * 0.05;
    }
  });

  const expression = config.expression || "happy";
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
      {/* 1. CAT PAW SNEAKERS / FEET */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.16, 0.08, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.13, 0.26]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        {/* Cute Cat Paw Print on Toe */}
        <mesh position={[0, 0.02, 0.1]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
      </group>

      <group position={[0.16, 0.08, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.13, 0.26]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.1]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. LEGS & PELVIS */}
      {/* ------------------------------------------------------------------ */}
      <mesh castShadow position={[-0.16, 0.42, 0]}>
        <cylinderGeometry args={[0.1, 0.085, 0.54, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.65} />
      </mesh>
      <mesh castShadow position={[0.16, 0.42, 0]}>
        <cylinderGeometry args={[0.1, 0.085, 0.54, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.65} />
      </mesh>

      <mesh castShadow position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.28, 0.26, 0.16, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.65} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. FELINE TAIL (Animated sway) */}
      {/* ------------------------------------------------------------------ */}
      <group ref={tailRef} position={[0, 0.65, -0.16]} rotation={[0.4, 0, 0]}>
        {/* Tail Base */}
        <mesh castShadow>
          <cylinderGeometry args={[0.045, 0.05, 0.35, 16]} />
          <meshStandardMaterial color={furColor} roughness={0.7} />
        </mesh>
        {/* Tail Mid Curve */}
        <group position={[0, 0.24, -0.06]} rotation={[-0.6, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.045, 0.3, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.7} />
          </mesh>
          {/* Fluffy Tail Tip */}
          <group position={[0, 0.2, 0.06]} rotation={[-0.7, 0, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color={furAccent} roughness={0.8} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 4. CAT TORSO & OUTFIT */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0.98, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.31, 0.27, 0.48, 24]} />
          <meshStandardMaterial color={outfitColor} roughness={0.6} />
        </mesh>

        {/* Cozy Fur Chest Patch / Inset */}
        <mesh position={[0, 0.02, 0.15]}>
          <planeGeometry args={[0.22, 0.3]} />
          <meshStandardMaterial color={furAccent} roughness={0.8} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh castShadow position={[0, 1.26, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.12, 16]} />
        <meshStandardMaterial color={furColor} roughness={0.6} />
      </mesh>

      {/* Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.22} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.3} offsetY={0.92} />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. ARMS & CAT PAWS */}
      {/* ------------------------------------------------------------------ */}
      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.34, 1.15, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[-0.03, -0.22, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.08, 0.07, 0.4, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        {/* Cat Paw with Cute Pads */}
        <group position={[-0.06, -0.44, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.7} />
          </mesh>
          {/* Paw Pad Accent */}
          <mesh position={[0, -0.02, 0.05]} rotation={[0.3, 0, 0]}>
            <circleGeometry args={[0.03, 12]} />
            <meshBasicMaterial color="#FDA4AF" />
          </mesh>
        </group>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.08, -0.44, 0.08]} />}
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.34, 1.15, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.03, -0.22, 0]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.08, 0.07, 0.4, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <group position={[0.06, -0.44, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.02, 0.05]} rotation={[0.3, 0, 0]}>
            <circleGeometry args={[0.03, 12]} />
            <meshBasicMaterial color="#FDA4AF" />
          </mesh>
        </group>
        {hasMic && <Prop3D type="mic" handPosition={[0.1, -0.42, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 6. CAT HEAD, EARS, WHISKERS & EXPRESSION */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.52, 0]}>
        {/* Cute Round Cat Head */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.27, 32, 32]} scale={[1.05, 0.95, 1.0]} />
          <meshStandardMaterial color={furColor} roughness={0.65} />
        </mesh>

        {/* Fur Cheeks */}
        <mesh position={[-0.24, -0.05, 0.04]} rotation={[0, -0.4, 0]}>
          <coneGeometry args={[0.09, 0.16, 4]} />
          <meshStandardMaterial color={furAccent} roughness={0.7} />
        </mesh>
        <mesh position={[0.24, -0.05, 0.04]} rotation={[0, 0.4, 0]}>
          <coneGeometry args={[0.09, 0.16, 4]} />
          <meshStandardMaterial color={furAccent} roughness={0.7} />
        </mesh>

        {/* Pointed Cat Ears */}
        <group ref={leftEarRef} position={[-0.18, 0.24, 0]} rotation={[0, 0, -0.15]}>
          <mesh castShadow>
            <coneGeometry args={[0.1, 0.22, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.6} />
          </mesh>
          {/* Inner Pink Ear */}
          <mesh position={[0, 0.01, 0.04]} rotation={[0.15, 0, 0]}>
            <coneGeometry args={[0.065, 0.16, 12]} />
            <meshStandardMaterial color="#FDA4AF" roughness={0.5} />
          </mesh>
        </group>

        <group ref={rightEarRef} position={[0.18, 0.24, 0]} rotation={[0, 0, 0.15]}>
          <mesh castShadow>
            <coneGeometry args={[0.1, 0.22, 16]} />
            <meshStandardMaterial color={furColor} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.01, 0.04]} rotation={[0.15, 0, 0]}>
            <coneGeometry args={[0.065, 0.16, 12]} />
            <meshStandardMaterial color="#FDA4AF" roughness={0.5} />
          </mesh>
        </group>

        {/* Cat Snout & Muzzle */}
        <group position={[0, -0.05, 0.22]}>
          {/* Snout Puffs */}
          <mesh position={[-0.045, 0, 0]}>
            <sphereGeometry args={[0.055, 16, 16]} scale={[1, 0.8, 0.8]} />
            <meshStandardMaterial color={furAccent} roughness={0.7} />
          </mesh>
          <mesh position={[0.045, 0, 0]}>
            <sphereGeometry args={[0.055, 16, 16]} scale={[1, 0.8, 0.8]} />
            <meshStandardMaterial color={furAccent} roughness={0.7} />
          </mesh>

          {/* Cute Cat Triangle Nose */}
          <mesh position={[0, 0.04, 0.04]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.022, 0.02, 3]} />
            <meshStandardMaterial color="#F43F5E" roughness={0.3} />
          </mesh>

          {/* Cat Whiskers (3 left, 3 right) */}
          <group position={[-0.1, 0, 0]} rotation={[0, 0, 0.1]}>
            <mesh position={[-0.06, 0.02, 0]}>
              <boxGeometry args={[0.12, 0.006, 0.006]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[-0.06, -0.01, 0]}>
              <boxGeometry args={[0.12, 0.006, 0.006]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          </group>

          <group position={[0.1, 0, 0]} rotation={[0, 0, -0.1]}>
            <mesh position={[0.06, 0.02, 0]}>
              <boxGeometry args={[0.12, 0.006, 0.006]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0.06, -0.01, 0]}>
              <boxGeometry args={[0.12, 0.006, 0.006]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          </group>
        </group>

        {/* Feline Eyes */}
        <group position={[0, 0.04, 0.22]}>
          {expression === "zen" || expression === "laughing" ? (
            <>
              <mesh position={[-0.09, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.035, 0.008, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
              <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.035, 0.008, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
            </>
          ) : (
            <>
              {/* Big Sparkling Cat Eyes */}
              <group position={[-0.09, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.045, 16, 16]} />
                  <meshStandardMaterial color="#10B981" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.018]} scale={[0.5, 1.1, 0.3]}>
                  <sphereGeometry args={[0.03, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" roughness={0.1} />
                </mesh>
                <mesh position={[0.01, 0.01, 0.025]}>
                  <sphereGeometry args={[0.009, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>

              <group position={[0.09, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.045, 16, 16]} />
                  <meshStandardMaterial color="#10B981" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.018]} scale={[0.5, 1.1, 0.3]}>
                  <sphereGeometry args={[0.03, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" roughness={0.1} />
                </mesh>
                <mesh position={[0.01, 0.01, 0.025]}>
                  <sphereGeometry args={[0.009, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </>
          )}

          {/* Cheeks Blush */}
          <mesh position={[-0.14, -0.06, -0.02]}>
            <circleGeometry args={[0.035, 16]} />
            <meshBasicMaterial color="#FDA4AF" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0.14, -0.06, -0.02]}>
            <circleGeometry args={[0.035, 16]} />
            <meshBasicMaterial color="#FDA4AF" transparent opacity={0.5} />
          </mesh>
        </group>

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.18} headRadius={0.25} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.27} offsetY={0.03} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.27} offsetY={0.03} />}
      </group>
    </group>
  );
}
