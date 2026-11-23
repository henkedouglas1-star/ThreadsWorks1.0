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

function useColor(hex?: string, fallback = "#EA580C") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function FoxModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);

  const foxOrange = useColor(config.appearance?.skinTone || "#EA580C", "#EA580C");
  const whiteFur = useColor(config.appearance?.hairColor || "#FFFBEB", "#FFFBEB");
  const outfitColor = useColor(config.clothing?.color || "#1E293B", "#1E293B");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#334155", "#334155");
  const shoesColor = useColor(config.clothing?.shoesColor || "#EA580C", "#EA580C");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 1.6) * 0.014;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.8) * 0.03;
      headGroupRef.current.rotation.z = Math.cos(t * 0.6) * 0.012;
    }
    if (tailRef.current) {
      // Big fluffy bushy tail swaying
      tailRef.current.rotation.y = Math.sin(t * 1.8) * 0.3;
      tailRef.current.rotation.z = 0.2 + Math.cos(t * 1.4) * 0.12;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 1.2) * 0.04;
      rightArmRef.current.rotation.x = -Math.sin(t * 1.2) * 0.04;
    }
  });

  const expression = config.expression || "confident";
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
      {hasSparkles && <AuraSparkles count={18} color="#EA580C" />}

      {/* ------------------------------------------------------------------ */}
      {/* 1. FOX SNEAKERS / BOOTS */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.16, 0.08, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.13, 0.27]} />
          <meshStandardMaterial color={shoesColor} roughness={0.35} />
        </mesh>
      </group>
      <group position={[0.16, 0.08, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.13, 0.27]} />
          <meshStandardMaterial color={shoesColor} roughness={0.35} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. SLEEK FOX LEGS & LOWER BODY */}
      {/* ------------------------------------------------------------------ */}
      <mesh castShadow position={[-0.16, 0.42, 0]}>
        <cylinderGeometry args={[0.095, 0.08, 0.54, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0.16, 0.42, 0]}>
        <cylinderGeometry args={[0.095, 0.08, 0.54, 20]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.6} />
      </mesh>

      <mesh castShadow position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.27, 0.25, 0.16, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.6} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. BIG BUSHY FLUFFY FOX TAIL (Animated sway) */}
      {/* ------------------------------------------------------------------ */}
      <group ref={tailRef} position={[0, 0.68, -0.16]} rotation={[0.45, 0, 0]}>
        {/* Tail Base Segment */}
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.05, 0.32, 16]} />
          <meshStandardMaterial color={foxOrange} roughness={0.7} />
        </mesh>
        {/* Bushy Mid Bulge */}
        <group position={[0, 0.24, -0.08]} rotation={[-0.45, 0, 0]}>
          <mesh castShadow scale={[1.2, 1.4, 1.2]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <meshStandardMaterial color={foxOrange} roughness={0.7} />
          </mesh>
          {/* White Fluffy Tail Tip */}
          <group position={[0, 0.24, 0.04]} rotation={[-0.4, 0, 0]}>
            <mesh castShadow scale={[1.0, 1.3, 1.0]}>
              <coneGeometry args={[0.11, 0.24, 16]} />
              <meshStandardMaterial color={whiteFur} roughness={0.75} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 4. SLEEK TORSO & STRATEGIST OUTFIT */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0.98, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.26, 0.5, 24]} />
          <meshStandardMaterial color={outfitColor} roughness={0.5} />
        </mesh>

        {/* White Fox Chest Cravat / Fur Inset */}
        <mesh position={[0, 0.06, 0.15]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.12, 0.28, 3]} />
          <meshStandardMaterial color={whiteFur} roughness={0.8} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh castShadow position={[0, 1.26, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.12, 16]} />
        <meshStandardMaterial color={foxOrange} roughness={0.6} />
      </mesh>

      {/* Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.22} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.3} offsetY={0.92} />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. FOX ARMS & PAWS */}
      {/* ------------------------------------------------------------------ */}
      <group ref={leftArmRef} position={[-0.34, 1.16, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[-0.03, -0.22, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.075, 0.065, 0.4, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        {/* Dark Paws */}
        <mesh castShadow position={[-0.06, -0.44, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#1E293B" roughness={0.7} />
        </mesh>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.08, -0.44, 0.08]} />}
      </group>

      <group ref={rightArmRef} position={[0.34, 1.16, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.03, -0.22, 0]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.075, 0.065, 0.4, 16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.06, -0.44, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#1E293B" roughness={0.7} />
        </mesh>
        {hasMic && <Prop3D type="mic" handPosition={[0.1, -0.42, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 6. FOX HEAD, POINTED SNOUT, EARS & CLEVER EXPRESSIONS */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.54, 0]}>
        {/* Head Base */}
        <mesh castShadow receiveShadow scale={[1.0, 0.95, 1.0]}>
          <sphereGeometry args={[0.26, 32, 32]} />
          <meshStandardMaterial color={foxOrange} roughness={0.6} />
        </mesh>

        {/* White Cheeks */}
        <mesh position={[-0.2, -0.06, 0.06]} rotation={[0, -0.5, 0]}>
          <coneGeometry args={[0.1, 0.18, 4]} />
          <meshStandardMaterial color={whiteFur} roughness={0.7} />
        </mesh>
        <mesh position={[0.2, -0.06, 0.06]} rotation={[0, 0.5, 0]}>
          <coneGeometry args={[0.1, 0.18, 4]} />
          <meshStandardMaterial color={whiteFur} roughness={0.7} />
        </mesh>

        {/* Large Triangular Fox Ears with Dark Tips */}
        <group position={[-0.18, 0.26, 0]} rotation={[0, 0, -0.2]}>
          <mesh castShadow>
            <coneGeometry args={[0.11, 0.28, 16]} />
            <meshStandardMaterial color={foxOrange} roughness={0.6} />
          </mesh>
          {/* Dark Ear Tip */}
          <mesh position={[0, 0.08, 0]}>
            <coneGeometry args={[0.055, 0.12, 16]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
          {/* Inner White Ear Fluff */}
          <mesh position={[0, -0.02, 0.04]} rotation={[0.15, 0, 0]}>
            <coneGeometry args={[0.07, 0.18, 12]} />
            <meshStandardMaterial color={whiteFur} />
          </mesh>
        </group>

        <group position={[0.18, 0.26, 0]} rotation={[0, 0, 0.2]}>
          <mesh castShadow>
            <coneGeometry args={[0.11, 0.28, 16]} />
            <meshStandardMaterial color={foxOrange} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <coneGeometry args={[0.055, 0.12, 16]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
          <mesh position={[0, -0.02, 0.04]} rotation={[0.15, 0, 0]}>
            <coneGeometry args={[0.07, 0.18, 12]} />
            <meshStandardMaterial color={whiteFur} />
          </mesh>
        </group>

        {/* Sharp Fox Snout & Muzzle */}
        <group position={[0, -0.04, 0.18]} rotation={[0.12, 0, 0]}>
          {/* Upper Orange Snout */}
          <mesh castShadow position={[0, 0.02, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.11, 0.24, 16]} />
            <meshStandardMaterial color={foxOrange} roughness={0.6} />
          </mesh>
          {/* Lower White Snout */}
          <mesh position={[0, -0.04, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.09, 0.2, 16]} />
            <meshStandardMaterial color={whiteFur} roughness={0.7} />
          </mesh>
          {/* Black Fox Nose */}
          <mesh position={[0, 0.02, 0.21]}>
            <sphereGeometry args={[0.026, 12, 12]} />
            <meshStandardMaterial color="#0F172A" roughness={0.3} />
          </mesh>
        </group>

        {/* Clever Fox Eyes */}
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
            // Sharp clever almond-angled eyes
            <>
              <group position={[-0.09, 0, 0]} rotation={[0, 0, 0.1]}>
                <mesh scale={[1.2, 0.9, 0.4]}>
                  <sphereGeometry args={[0.04, 16, 16]} />
                  <meshStandardMaterial color="#FBBF24" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.015]} scale={[0.6, 1.0, 0.3]}>
                  <sphereGeometry args={[0.025, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.008, 0.008, 0.02]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>

              <group position={[0.09, 0, 0]} rotation={[0, 0, -0.1]}>
                <mesh scale={[1.2, 0.9, 0.4]}>
                  <sphereGeometry args={[0.04, 16, 16]} />
                  <meshStandardMaterial color="#FBBF24" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.015]} scale={[0.6, 1.0, 0.3]}>
                  <sphereGeometry args={[0.025, 16, 16]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.008, 0.008, 0.02]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </>
          )}
        </group>

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.2} headRadius={0.25} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.28} offsetY={0.03} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.26} offsetY={0.03} />}
      </group>
    </group>
  );
}
