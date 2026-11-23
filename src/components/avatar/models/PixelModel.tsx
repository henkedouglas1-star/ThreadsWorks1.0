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

export function PixelModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  const skinTone = useColor(config.appearance?.skinTone || "#D1E8FF", "#D1E8FF");
  const pixelHair = useColor(config.appearance?.hairColor || "#8B5CF6", "#8B5CF6");
  const outfitColor = useColor(config.clothing?.color || "#3B82F6", "#3B82F6");
  const bottomsColor = useColor(config.clothing?.bottomsColor || "#1E293B", "#1E293B");
  const shoesColor = useColor(config.clothing?.shoesColor || "#06B6D4", "#06B6D4");
  const hatColor = useColor(config.clothing?.hatColor || "#1E293B", "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    // Stepped pixelated bobbing
    const steppedT = Math.floor(t * 8) / 8;
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(steppedT * 3) * 0.015;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(steppedT * 1.5) * 0.04;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(steppedT * 2) * 0.08;
      rightArmRef.current.rotation.x = -Math.sin(steppedT * 2) * 0.08;
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
      {/* 1. VOXEL PIXEL SHOES */}
      {/* ------------------------------------------------------------------ */}
      <group position={[-0.17, 0.08, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.14, 0.28]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.19, 0.04, 0.29]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>

      <group position={[0.17, 0.08, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.18, 0.14, 0.28]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.19, 0.04, 0.29]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* 2. VOXEL BLOCK LEGS & PELVIS */}
      {/* ------------------------------------------------------------------ */}
      <mesh castShadow position={[-0.17, 0.42, 0]}>
        <boxGeometry args={[0.16, 0.54, 0.18]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.17, 0.42, 0]}>
        <boxGeometry args={[0.16, 0.54, 0.18]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.5} />
      </mesh>

      <mesh castShadow position={[0, 0.7, 0]}>
        <boxGeometry args={[0.48, 0.16, 0.26]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.5} />
      </mesh>

      {/* ------------------------------------------------------------------ */}
      {/* 3. VOXEL TORSO */}
      {/* ------------------------------------------------------------------ */}
      <group position={[0, 1.02, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.52, 0.48, 0.3]} />
          <meshStandardMaterial color={outfitColor} roughness={0.4} />
        </mesh>
        {/* Pixel Pattern Accents */}
        <mesh position={[0, 0.04, 0.155]}>
          <planeGeometry args={[0.24, 0.24]} />
          <meshStandardMaterial color="#FBBF24" emissive="#FBBF24" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Pixel Neck */}
      <mesh castShadow position={[0, 1.3, 0]}>
        <boxGeometry args={[0.16, 0.12, 0.16]} />
        <meshStandardMaterial color={skinTone} />
      </mesh>

      {/* Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.24} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.34} offsetY={0.92} />}

      {/* ------------------------------------------------------------------ */}
      {/* 4. BLOCKY VOXEL ARMS & HANDS */}
      {/* ------------------------------------------------------------------ */}
      <group ref={leftArmRef} position={[-0.35, 1.18, 0]}>
        <mesh castShadow position={[-0.04, -0.2, 0]}>
          <boxGeometry args={[0.14, 0.42, 0.16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        {/* Voxel Hand */}
        <mesh castShadow position={[-0.04, -0.46, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.14]} />
          <meshStandardMaterial color={skinTone} />
        </mesh>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.06, -0.44, 0.08]} />}
      </group>

      <group ref={rightArmRef} position={[0.35, 1.18, 0]}>
        <mesh castShadow position={[0.04, -0.2, 0]}>
          <boxGeometry args={[0.14, 0.42, 0.16]} />
          <meshStandardMaterial color={outfitColor} />
        </mesh>
        <mesh castShadow position={[0.04, -0.46, 0]}>
          <boxGeometry args={[0.12, 0.12, 0.14]} />
          <meshStandardMaterial color={skinTone} />
        </mesh>
        {hasMic && <Prop3D type="mic" handPosition={[0.06, -0.42, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* ------------------------------------------------------------------ */}
      {/* 5. 8-BIT VOXEL HEAD & PIXEL EYES */}
      {/* ------------------------------------------------------------------ */}
      <group ref={headGroupRef} position={[0, 1.56, 0]}>
        {/* Cube Voxel Head */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.44, 0.42, 0.4]} />
          <meshStandardMaterial color={skinTone} roughness={0.3} />
        </mesh>

        {/* Pixel Hair Blocks */}
        <group position={[0, 0.18, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.46, 0.16, 0.42]} />
            <meshStandardMaterial color={pixelHair} roughness={0.4} />
          </mesh>
          {/* Front Pixel Fringe */}
          <mesh castShadow position={[0, -0.1, 0.2]}>
            <boxGeometry args={[0.38, 0.08, 0.06]} />
            <meshStandardMaterial color={pixelHair} roughness={0.4} />
          </mesh>
        </group>

        {/* 8-Bit Pixel Eyes & Expression */}
        <group position={[0, 0.02, 0.205]}>
          {expression === "zen" || expression === "laughing" ? (
            <>
              <mesh position={[-0.1, 0, 0]}>
                <boxGeometry args={[0.08, 0.02, 0.01]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
              <mesh position={[0.1, 0, 0]}>
                <boxGeometry args={[0.08, 0.02, 0.01]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
            </>
          ) : expression === "surprised" ? (
            <>
              <mesh position={[-0.1, 0, 0]}>
                <boxGeometry args={[0.07, 0.07, 0.01]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
              <mesh position={[0.1, 0, 0]}>
                <boxGeometry args={[0.07, 0.07, 0.01]} />
                <meshStandardMaterial color="#0F172A" />
              </mesh>
            </>
          ) : (
            // 8-bit Pixel Eyes with Pixel Glint
            <>
              {/* Left Eye */}
              <group position={[-0.1, 0, 0]}>
                <mesh>
                  <boxGeometry args={[0.07, 0.07, 0.01]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.02, 0.02, 0.005]}>
                  <boxGeometry args={[0.025, 0.025, 0.01]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>

              {/* Right Eye */}
              <group position={[0.1, 0, 0]}>
                <mesh>
                  <boxGeometry args={[0.07, 0.07, 0.01]} />
                  <meshStandardMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0.02, 0.02, 0.005]}>
                  <boxGeometry args={[0.025, 0.025, 0.01]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </>
          )}

          {/* Pixel Smile */}
          <group position={[0, -0.09, 0]}>
            <mesh position={[-0.03, 0, 0]}>
              <boxGeometry args={[0.03, 0.02, 0.01]} />
              <meshStandardMaterial color="#EF4444" />
            </mesh>
            <mesh position={[0, -0.02, 0]}>
              <boxGeometry args={[0.03, 0.02, 0.01]} />
              <meshStandardMaterial color="#EF4444" />
            </mesh>
            <mesh position={[0.03, 0, 0]}>
              <boxGeometry args={[0.03, 0.02, 0.01]} />
              <meshStandardMaterial color="#EF4444" />
            </mesh>
          </group>
        </group>

        {/* Headwear & Accessories */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.22} headRadius={0.24} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.22} offsetY={0.02} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.25} offsetY={0.02} />}
      </group>
    </group>
  );
}
