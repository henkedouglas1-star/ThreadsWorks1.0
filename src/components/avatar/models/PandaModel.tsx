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

function useColor(hex?: string, fallback = "#F8FAFC") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function PandaModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  const whiteFur = useColor(config.appearance?.skinTone || "#F8FAFC", "#F8FAFC");
  const darkFur = useColor(config.appearance?.hairColor || "#1E293B", "#1E293B");
  const outfitColor = useColor(config.clothing?.color || "#10B981", "#10B981");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#1E293B", "#1E293B");
  const shoesColor = useColor(config.clothing?.shoesColor || "#FFFFFF", "#FFFFFF");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 1.4) * 0.012;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.7) * 0.025;
      headGroupRef.current.rotation.z = Math.cos(t * 0.5) * 0.01;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 1.1) * 0.04;
      rightArmRef.current.rotation.x = -Math.sin(t * 1.1) * 0.04;
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
      {hasSparkles && <AuraSparkles count={18} color="#10B981" />}

      {/* ------------------------------------------------------------------ */}
      {/* 1. PANDA FEET / SNEAKERS */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.19, 0.08, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.14, 0.28]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.1]}>
          <cylinderGeometry args={[0.08, 0.08, 0.08, 16]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
      </group>

      <group position={[0.19, 0.08, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.14, 0.28]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.02, 0.1]}>
          <cylinderGeometry args={[0.08, 0.08, 0.08, 16]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. STURDY PANDA LEGS & PELVIS */}
      {/* ------------------------------------------------------------------ */}
      <mesh castShadow position={[-0.19, 0.4, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.52, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0.19, 0.4, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.52, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.32, 0.3, 0.16, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>

      {/* Little Panda Tail */}
      <mesh castShadow position={[0, 0.68, -0.22]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={darkFur} roughness={0.8} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. COZY ROUND PANDA BELLY & OUTFIT */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0.98, 0]}>
        <mesh castShadow receiveShadow scale={[1.08, 1.0, 1.05]}>
          <cylinderGeometry args={[0.35, 0.32, 0.5, 24]} />
          <meshStandardMaterial color={outfitColor} roughness={0.65} />
        </mesh>
        {/* Soft White Fur Belly Panel */}
        <mesh position={[0, -0.02, 0.18]}>
          <sphereGeometry args={[0.2, 16, 16]} scale={[1, 1.2, 0.4]} />
          <meshStandardMaterial color={whiteFur} roughness={0.8} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh castShadow position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.12, 16]} />
        <meshStandardMaterial color={darkFur} roughness={0.7} />
      </mesh>

      {/* Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.22} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.36} offsetY={0.92} />}

      {/* ------------------------------------------------------------------ */}
      {/* 4. PANDA ARMS & PAWS */}
      {/* ------------------------------------------------------------------ */}
      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.38, 1.15, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={darkFur} />
        </mesh>
        <mesh castShadow position={[-0.04, -0.22, 0]} rotation={[0, 0, 0.12]}>
          <cylinderGeometry args={[0.095, 0.085, 0.38, 16]} />
          <meshStandardMaterial color={darkFur} />
        </mesh>
        {/* Paws */}
        <mesh castShadow position={[-0.08, -0.42, 0]}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial color={darkFur} roughness={0.8} />
        </mesh>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.1, -0.42, 0.08]} />}
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.38, 1.15, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color={darkFur} />
        </mesh>
        <mesh castShadow position={[0.04, -0.22, 0]} rotation={[0, 0, -0.12]}>
          <cylinderGeometry args={[0.095, 0.085, 0.38, 16]} />
          <meshStandardMaterial color={darkFur} />
        </mesh>
        <mesh castShadow position={[0.08, -0.42, 0]}>
          <sphereGeometry args={[0.085, 16, 16]} />
          <meshStandardMaterial color={darkFur} roughness={0.8} />
        </mesh>
        {hasMic && <Prop3D type="mic" handPosition={[0.12, -0.4, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. PANDA HEAD, ROUND EARS, EYE PATCHES & EXPRESSIONS */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.52, 0]}>
        {/* Fluffy Round White Panda Head */}
        <mesh castShadow receiveShadow scale={[1.06, 0.98, 1.02]}>
          <sphereGeometry args={[0.29, 32, 32]} />
          <meshStandardMaterial color={whiteFur} roughness={0.7} />
        </mesh>

        {/* Round Black Panda Ears */}
        <group position={[-0.22, 0.22, 0]} rotation={[0, 0, -0.3]}>
          <mesh castShadow>
            <sphereGeometry args={[0.095, 16, 16]} scale={[1, 1, 0.6]} />
            <meshStandardMaterial color={darkFur} roughness={0.8} />
          </mesh>
        </group>
        <group position={[0.22, 0.22, 0]} rotation={[0, 0, 0.3]}>
          <mesh castShadow>
            <sphereGeometry args={[0.095, 16, 16]} scale={[1, 1, 0.6]} />
            <meshStandardMaterial color={darkFur} roughness={0.8} />
          </mesh>
        </group>

        {/* Signature Panda Dark Eye Patches */}
        <group position={[-0.1, 0.04, 0.22]} rotation={[0, 0, 0.3]}>
          <mesh scale={[1.2, 1.6, 0.4]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color={darkFur} roughness={0.9} />
          </mesh>
        </group>
        <group position={[0.1, 0.04, 0.22]} rotation={[0, 0, -0.3]}>
          <mesh scale={[1.2, 1.6, 0.4]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color={darkFur} roughness={0.9} />
          </mesh>
        </group>

        {/* Panda Eyes inside Patches */}
        <group position={[0, 0.04, 0.25]}>
          {expression === "zen" || expression === "laughing" ? (
            <>
              <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.028, 0.007, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#FFFFFF" />
              </mesh>
              <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.028, 0.007, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#FFFFFF" />
              </mesh>
            </>
          ) : (
            <>
              <group position={[-0.1, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.035, 16, 16]} />
                  <meshStandardMaterial color="#FFFFFF" />
                </mesh>
                <mesh position={[0, 0, 0.015]} scale={[1, 1, 0.3]}>
                  <sphereGeometry args={[0.022, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.008, 0.008, 0.022]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
              <group position={[0.1, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.035, 16, 16]} />
                  <meshStandardMaterial color="#FFFFFF" />
                </mesh>
                <mesh position={[0, 0, 0.015]} scale={[1, 1, 0.3]}>
                  <sphereGeometry args={[0.022, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.008, 0.008, 0.022]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </>
          )}
        </group>

        {/* Panda Snout, Nose & Smile */}
        <group position={[0, -0.06, 0.24]}>
          {/* Muzzle Bump */}
          <mesh scale={[1.2, 0.9, 0.8]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color={whiteFur} roughness={0.7} />
          </mesh>
          {/* Black Nose */}
          <mesh position={[0, 0.03, 0.06]}>
            <sphereGeometry args={[0.032, 16, 16]} scale={[1.3, 0.8, 0.8]} />
            <meshStandardMaterial color="#0F172A" roughness={0.3} />
          </mesh>
          {/* Panda Smile */}
          <mesh position={[0, -0.03, 0.06]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.03, 0.006, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
        </group>

        {/* Cheeks Blush */}
        <mesh position={[-0.16, -0.06, 0.18]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color="#FDA4AF" transparent opacity={0.4} />
        </mesh>
        <mesh position={[0.16, -0.06, 0.18]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color="#FDA4AF" transparent opacity={0.4} />
        </mesh>

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.18} headRadius={0.27} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.28} offsetY={0.03} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.29} offsetY={0.03} />}
      </group>
    </group>
  );
}
