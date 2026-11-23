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

function useColor(hex?: string, fallback = "#3B82F6") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function OwlModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftWingRef = useRef<THREE.Group>(null);
  const rightWingRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  const featherColor = useColor(config.appearance?.skinTone || "#6366F1", "#6366F1");
  const discColor = useColor(config.appearance?.hairColor || "#FEF3C7", "#FEF3C7");
  const outfitColor = useColor(config.clothing?.color || "#1E293B", "#1E293B");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#312E81", "#312E81");
  const shoesColor = useColor(config.clothing?.shoesColor || "#F59E0B", "#F59E0B");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 1.5) * 0.012;
    }
    if (headGroupRef.current) {
      // Owl head rotating slightly more inquisitively
      headGroupRef.current.rotation.y = Math.sin(t * 0.7) * 0.05;
      headGroupRef.current.rotation.z = Math.cos(t * 0.5) * 0.02;
    }
    if (leftWingRef.current && rightWingRef.current) {
      leftWingRef.current.rotation.z = -0.15 + Math.sin(t * 1.2) * 0.04;
      rightWingRef.current.rotation.z = 0.15 - Math.sin(t * 1.2) * 0.04;
    }
  });

  const expression = config.expression || "curious";
  const hatStyle = config.clothing?.hat || "beret";
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
      {hasSparkles && <AuraSparkles count={18} color="#6366F1" />}

      {/* ------------------------------------------------------------------ */}
      {/* 1. OWL TALONS / SCHOLAR SHOES */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.16, 0.08, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.12, 0.26]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        {/* Talon claws */}
        {[-0.04, 0, 0.04].map((x, i) => (
          <mesh key={i} position={[x, -0.02, 0.14]} rotation={[0.4, 0, 0]}>
            <coneGeometry args={[0.015, 0.06, 8]} />
            <meshStandardMaterial color="#78350F" />
          </mesh>
        ))}
      </group>

      <group position={[0.16, 0.08, 0.03]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.12, 0.26]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        {[-0.04, 0, 0.04].map((x, i) => (
          <mesh key={i} position={[x, -0.02, 0.14]} rotation={[0.4, 0, 0]}>
            <coneGeometry args={[0.015, 0.06, 8]} />
            <meshStandardMaterial color="#78350F" />
          </mesh>
        ))}
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. LEGS & LOWER BODY */}
      {/* ------------------------------------------------------------------ */}
      <mesh castShadow position={[-0.16, 0.38, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.48, 16]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0.16, 0.38, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.48, 16]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 0.64, 0]}>
        <cylinderGeometry args={[0.3, 0.26, 0.16, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.7} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. PLUMP ACADEMIC OWL TORSO & OUTFIT */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 0.96, 0]}>
        <mesh castShadow receiveShadow scale={[1.05, 1.0, 1.05]}>
          <cylinderGeometry args={[0.34, 0.3, 0.52, 24]} />
          <meshStandardMaterial color={outfitColor} roughness={0.6} />
        </mesh>
        {/* Soft Feathered Breast Pattern */}
        <mesh position={[0, 0, 0.17]}>
          <planeGeometry args={[0.24, 0.32]} />
          <meshStandardMaterial color={discColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh castShadow position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.14, 0.16, 0.12, 16]} />
        <meshStandardMaterial color={featherColor} roughness={0.6} />
      </mesh>

      {/* Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.2} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.34} offsetY={0.9} />}

      {/* ------------------------------------------------------------------ */}
      {/* 4. OWL WINGS / ARMS */}
      {/* ------------------------------------------------------------------ */}
      <group ref={leftWingRef} position={[-0.34, 1.15, 0]}>
        {/* Wing Body */}
        <mesh castShadow scale={[0.4, 1.4, 0.9]} rotation={[0, 0, 0.1]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={featherColor} roughness={0.65} />
        </mesh>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.08, -0.25, 0.1]} />}
      </group>

      <group ref={rightWingRef} position={[0.34, 1.15, 0]}>
        <mesh castShadow scale={[0.4, 1.4, 0.9]} rotation={[0, 0, -0.1]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color={featherColor} roughness={0.65} />
        </mesh>
        {hasMic && <Prop3D type="mic" handPosition={[0.08, -0.22, 0.1]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. OWL SCHOLAR HEAD, FACIAL DISC, FEATHERED TUFTS & BEAK */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.54, 0]}>
        {/* Round Owl Head */}
        <mesh castShadow receiveShadow scale={[1.08, 0.96, 1.0]}>
          <sphereGeometry args={[0.28, 32, 32]} />
          <meshStandardMaterial color={featherColor} roughness={0.6} />
        </mesh>

        {/* Scholar Feathered Ear Tufts / Horns */}
        <group position={[-0.18, 0.24, 0]} rotation={[0, 0, -0.4]}>
          <mesh castShadow>
            <coneGeometry args={[0.08, 0.2, 16]} />
            <meshStandardMaterial color={featherColor} roughness={0.7} />
          </mesh>
        </group>
        <group position={[0.18, 0.24, 0]} rotation={[0, 0, 0.4]}>
          <mesh castShadow>
            <coneGeometry args={[0.08, 0.2, 16]} />
            <meshStandardMaterial color={featherColor} roughness={0.7} />
          </mesh>
        </group>

        {/* Heart-shaped / Dual-circle Facial Disc */}
        <group position={[0, 0.02, 0.2]}>
          <mesh position={[-0.1, 0.02, 0]}>
            <circleGeometry args={[0.12, 24]} />
            <meshStandardMaterial color={discColor} roughness={0.8} />
          </mesh>
          <mesh position={[0.1, 0.02, 0]}>
            <circleGeometry args={[0.12, 24]} />
            <meshStandardMaterial color={discColor} roughness={0.8} />
          </mesh>
        </group>

        {/* Big Concentric Scholar Owl Eyes */}
        <group position={[0, 0.04, 0.24]}>
          {expression === "zen" || expression === "laughing" ? (
            <>
              <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.04, 0.008, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
              <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.04, 0.008, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
            </>
          ) : (
            <>
              {/* Left Eye */}
              <group position={[-0.1, 0, 0]}>
                {/* Gold Outer Iris */}
                <mesh>
                  <circleGeometry args={[0.065, 24]} />
                  <meshStandardMaterial color="#F59E0B" roughness={0.1} />
                </mesh>
                {/* Large Dark Pupil */}
                <mesh position={[0, 0, 0.005]}>
                  <circleGeometry args={[0.042, 24]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                {/* Sparkle Glint */}
                <mesh position={[0.015, 0.015, 0.01]}>
                  <sphereGeometry args={[0.01, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>

              {/* Right Eye */}
              <group position={[0.1, 0, 0]}>
                <mesh>
                  <circleGeometry args={[0.065, 24]} />
                  <meshStandardMaterial color="#F59E0B" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.005]}>
                  <circleGeometry args={[0.042, 24]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.015, 0.015, 0.01]}>
                  <sphereGeometry args={[0.01, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </>
          )}
        </group>

        {/* Curved Owl Beak */}
        <group position={[0, -0.04, 0.26]} rotation={[0.4, 0, 0]}>
          <mesh castShadow rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.035, 0.1, 16]} />
            <meshStandardMaterial color="#D97706" roughness={0.3} />
          </mesh>
        </group>

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.18} headRadius={0.27} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.28} offsetY={0.04} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.29} offsetY={0.04} />}
      </group>
    </group>
  );
}
