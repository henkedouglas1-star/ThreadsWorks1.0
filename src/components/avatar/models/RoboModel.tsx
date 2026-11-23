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

function useColor(hex?: string, fallback = "#06B6D4") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function RoboModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);
  const antennaRef = useRef<THREE.Group>(null);

  // Colors
  const chassisColor = useColor(config.appearance?.skinTone || "#E2E8F0", "#E2E8F0");
  const glowColor = useColor(config.appearance?.hairColor || "#06B6D4", "#06B6D4");
  const outfitColor = useColor(config.clothing?.color || "#8B5CF6", "#8B5CF6");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#1E293B", "#1E293B");
  const shoesColor = useColor(config.clothing?.shoesColor || "#06B6D4", "#06B6D4");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 2) * 0.02;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.9) * 0.04;
      headGroupRef.current.position.y = 1.55 + Math.cos(t * 1.5) * 0.008;
    }
    if (antennaRef.current) {
      antennaRef.current.rotation.z = Math.sin(t * 4) * 0.08;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 1.4) * 0.06;
      rightArmRef.current.rotation.x = -Math.sin(t * 1.4) * 0.06;
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
      {hasSparkles && <AuraSparkles count={18} color="#06B6D4" />}

      {/* ------------------------------------------------------------------ */}
      {/* 1. ROBOT FEET / HOVER THRUSTERS */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.18, 0.08, 0]}>
        {/* Foot Base */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.12, 0.28]} />
          <meshStandardMaterial color={shoesColor} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Glowing Sole Trim */}
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.19, 0.02, 0.29]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.8} />
        </mesh>
      </group>

      <group position={[0.18, 0.08, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.12, 0.28]} />
          <meshStandardMaterial color={shoesColor} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.19, 0.02, 0.29]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. ROBOT LEGS & PELVIS */}
      {/* ------------------------------------------------------------------ */}
      {/* Left Leg (Segmented Cylinders) */}
      <group position={[-0.18, 0.44, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.54, 16]} />
          <meshStandardMaterial color={bottomsColor} metalness={0.8} roughness={0.25} />
        </mesh>
        {/* Knee Joint Collar */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
          <meshStandardMaterial color={chassisColor} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Right Leg */}
      <group position={[0.18, 0.44, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.54, 16]} />
          <meshStandardMaterial color={bottomsColor} metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
          <meshStandardMaterial color={chassisColor} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Pelvis Chassis Block */}
      <mesh castShadow position={[0, 0.72, 0]}>
        <boxGeometry args={[0.42, 0.16, 0.26]} />
        <meshStandardMaterial color={bottomsColor} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. ROBOT TORSO & POWER CORE */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 1.02, 0]}>
        {/* Main Chest Chassis / Armor */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.48, 0.32]} />
          <meshStandardMaterial color={outfitColor} metalness={0.6} roughness={0.35} />
        </mesh>

        {/* Chest Plate Inset */}
        <mesh position={[0, 0.02, 0.165]}>
          <planeGeometry args={[0.34, 0.32]} />
          <meshStandardMaterial color="#0F172A" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Glowing Power Arc Reactor */}
        <mesh position={[0, 0.02, 0.17]}>
          <circleGeometry args={[0.08, 24]} />
          <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0, 0.02, 0.171]}>
          <ringGeometry args={[0.06, 0.075, 24]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.8} />
        </mesh>

        {/* Back Thruster Exhausts */}
        <mesh position={[-0.12, 0.08, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.06, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
        <mesh position={[0.12, 0.08, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.06, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      </group>

      {/* Robot Neck Joint */}
      <mesh castShadow position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.12, 16]} />
        <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Neck Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.26} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.34} offsetY={0.95} />}

      {/* ------------------------------------------------------------------ */}
      {/* 4. ROBOT ARMS & PINCERS */}
      {/* ------------------------------------------------------------------ */}
      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.34, 1.2, 0]}>
        {/* Shoulder Sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={chassisColor} metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Arm Segment */}
        <mesh castShadow position={[-0.03, -0.22, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.055, 0.055, 0.36, 16]} />
          <meshStandardMaterial color={outfitColor} metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Pincer Hand */}
        <group position={[-0.06, -0.44, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.06, 16]} />
            <meshStandardMaterial color={chassisColor} metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Pincer Claws */}
          <mesh position={[-0.03, -0.06, 0]}>
            <boxGeometry args={[0.015, 0.08, 0.04]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0.03, -0.06, 0]}>
            <boxGeometry args={[0.015, 0.08, 0.04]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.5} />
          </mesh>
        </group>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.08, -0.44, 0.08]} />}
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.34, 1.2, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={chassisColor} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh castShadow position={[0.03, -0.22, 0]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.055, 0.055, 0.36, 16]} />
          <meshStandardMaterial color={outfitColor} metalness={0.7} roughness={0.3} />
        </mesh>
        <group position={[0.06, -0.44, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.06, 16]} />
            <meshStandardMaterial color={chassisColor} metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[-0.03, -0.06, 0]}>
            <boxGeometry args={[0.015, 0.08, 0.04]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0.03, -0.06, 0]}>
            <boxGeometry args={[0.015, 0.08, 0.04]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={0.5} />
          </mesh>
        </group>
        {hasMic && <Prop3D type="mic" handPosition={[0.1, -0.42, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. ROBOT HEAD & GLOWING SCREEN VISOR */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.55, 0]}>
        {/* Chamfered Box Robot Head Chassis */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.38, 0.36]} />
          <meshStandardMaterial color={chassisColor} metalness={0.8} roughness={0.25} />
        </mesh>

        {/* Side Audio Bolts */}
        <mesh position={[-0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshStandardMaterial color="#0F172A" metalness={0.9} />
        </mesh>
        <mesh position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshStandardMaterial color="#0F172A" metalness={0.9} />
        </mesh>

        {/* Glossy Black Visor Screen */}
        <mesh position={[0, 0, 0.185]}>
          <planeGeometry args={[0.38, 0.26]} />
          <meshStandardMaterial color="#030712" roughness={0.1} metalness={0.9} />
        </mesh>

        {/* Glowing Digital Eyes & Visor Expressions */}
        <group position={[0, 0.02, 0.19]}>
          {expression === "happy" || expression === "excited" || expression === "celebrating" ? (
            // Happy ^ ^ Glowing Visor Eyes
            <>
              <mesh position={[-0.09, 0, 0]} rotation={[0, 0, 0]}>
                <torusGeometry args={[0.04, 0.01, 8, 16, Math.PI]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.5} />
              </mesh>
              <mesh position={[0.09, 0, 0]} rotation={[0, 0, 0]}>
                <torusGeometry args={[0.04, 0.01, 8, 16, Math.PI]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.5} />
              </mesh>
            </>
          ) : expression === "surprised" ? (
            // Surprised O O Visor Eyes
            <>
              <mesh position={[-0.09, 0, 0]}>
                <ringGeometry args={[0.03, 0.045, 20]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.5} />
              </mesh>
              <mesh position={[0.09, 0, 0]}>
                <ringGeometry args={[0.03, 0.045, 20]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.5} />
              </mesh>
            </>
          ) : expression === "confident" ? (
            // Cool Sunglasses Visor Bar
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.26, 0.05, 0.01]} />
              <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.6} />
            </mesh>
          ) : expression === "zen" || expression === "laughing" ? (
            // Horizontal Clean Beams
            <>
              <mesh position={[-0.09, 0, 0]}>
                <boxGeometry args={[0.07, 0.015, 0.01]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.5} />
              </mesh>
              <mesh position={[0.09, 0, 0]}>
                <boxGeometry args={[0.07, 0.015, 0.01]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.5} />
              </mesh>
            </>
          ) : (
            // Classic Bright LED Circles
            <>
              <mesh position={[-0.09, 0, 0]}>
                <circleGeometry args={[0.038, 20]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.4} />
              </mesh>
              <mesh position={[0.09, 0, 0]}>
                <circleGeometry args={[0.038, 20]} />
                <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.4} />
              </mesh>
            </>
          )}

          {/* Digital Smile on Visor */}
          <mesh position={[0, -0.065, 0]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.03, 0.008, 8, 16, Math.PI]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.2} />
          </mesh>
        </group>

        {/* Head Antenna / Sensor Mast */}
        <group ref={antennaRef} position={[0, 0.22, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.16, 12]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
          {/* Glowing Orb Tip */}
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial color={glowColor} emissive={glowColor} emissiveIntensity={1.6} />
          </mesh>
        </group>

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.22} headRadius={0.24} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.2} offsetY={0.02} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.25} offsetY={0.02} />}
      </group>
    </group>
  );
}
