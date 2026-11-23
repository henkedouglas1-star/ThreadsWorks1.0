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

function useColor(hex?: string, fallback = "#8B5CF6") {
  return useMemo(() => {
    try {
      return new THREE.Color(hex || fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }, [hex, fallback]);
}

export function HumanModel({ config }: ModelProps) {
  const modelGroupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const headGroupRef = useRef<THREE.Group>(null);

  const skinColor = useColor(config.appearance?.skinTone, "#FDDFB8");
  const hairColor = useColor(config.appearance?.hairColor, "#231B15");
  const outfitColor = useColor(config.clothing?.color, "#8B5CF6");
  const outfitAccent = useColor(config.clothing?.accentColor, "#FFFFFF");
  const bottomsColor = useColor(config.clothing?.bottomsColor, "#2563EB");
  const shoesColor = useColor(config.clothing?.shoesColor, "#FFFFFF");
  const hatColor = useColor(config.clothing?.hatColor, "#1E293B");

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (modelGroupRef.current) {
      modelGroupRef.current.position.y = Math.sin(t * 1.5) * 0.015;
    }
    if (headGroupRef.current) {
      headGroupRef.current.rotation.y = Math.sin(t * 0.8) * 0.03;
      headGroupRef.current.rotation.z = Math.cos(t * 0.6) * 0.01;
    }
    if (leftArmRef.current && rightArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(t * 1.2) * 0.04;
      rightArmRef.current.rotation.x = -Math.sin(t * 1.2) * 0.04;
    }
  });

  const isHoodie = config.clothing?.style === "hoodie" || config.clothing?.style === "zip-hoodie";
  const isBlazer = config.clothing?.style === "blazer";
  const isDenim = config.clothing?.style === "denim" || config.clothing?.style === "bomber" || config.clothing?.style === "biker";
  const isSweater = config.clothing?.style === "sweater" || config.clothing?.style === "cardigan" || config.clothing?.style === "dress";
  const isPolo = config.clothing?.style === "polo";

  const faceShape = config.appearance?.faceShape || "oval";
  const headScaleY = faceShape === "round" ? 0.95 : faceShape === "square" ? 0.92 : 1.0;
  const headScaleX = faceShape === "round" ? 1.05 : faceShape === "heart" ? 1.02 : 0.98;

  const hairStyle = config.appearance?.hairStyle || "swoop";
  const hatStyle = config.clothing?.hat || "none";
  const expression = config.expression || "happy";

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
      {hasSparkles && <AuraSparkles count={18} color="#C084FC" />}

      {/* Feet / Shoes */}
      <group position={[-0.18, 0.08, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.14, 0.3]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} metalness={0.1} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.17, 0.04, 0.32]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.02, 0.12]}>
          <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} />
        </mesh>
      </group>

      <group position={[0.18, 0.08, 0.04]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.16, 0.14, 0.3]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} metalness={0.1} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.17, 0.04, 0.32]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.02, 0.12]}>
          <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
          <meshStandardMaterial color={shoesColor} roughness={0.3} />
        </mesh>
      </group>

      {/* Legs & Hips */}
      <mesh castShadow receiveShadow position={[-0.18, 0.44, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.58, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.65} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.18, 0.44, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.58, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.65} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.3, 0.28, 0.16, 24]} />
        <meshStandardMaterial color={bottomsColor} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.31, 0.31, 0.04, 24]} />
        <meshStandardMaterial color="#1E293B" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Torso */}
      <group position={[0, 1.02, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.33, 0.29, 0.52, 28]} />
          <meshStandardMaterial
            color={outfitColor}
            roughness={isDenim ? 0.4 : isSweater ? 0.85 : 0.5}
            metalness={isDenim ? 0.2 : 0.05}
          />
        </mesh>

        {isHoodie && (
          <group position={[0, -0.08, 0.16]}>
            <mesh castShadow>
              <boxGeometry args={[0.34, 0.16, 0.05]} />
              <meshStandardMaterial color={outfitColor} roughness={0.6} />
            </mesh>
            <mesh position={[-0.07, 0.18, 0.04]}>
              <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
              <meshStandardMaterial color={outfitAccent} />
            </mesh>
            <mesh position={[0.07, 0.18, 0.04]}>
              <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
              <meshStandardMaterial color={outfitAccent} />
            </mesh>
            <mesh position={[0, 0.38, -0.26]} rotation={[Math.PI / 3, 0, 0]}>
              <torusGeometry args={[0.18, 0.07, 12, 24, Math.PI]} />
              <meshStandardMaterial color={outfitColor} roughness={0.6} />
            </mesh>
          </group>
        )}

        {isBlazer && (
          <group position={[0, 0.02, 0.16]}>
            <mesh position={[0, 0.08, -0.01]}>
              <planeGeometry args={[0.18, 0.26]} />
              <meshStandardMaterial color={outfitAccent} />
            </mesh>
            <mesh position={[-0.1, 0.05, 0.01]} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[0.1, 0.32, 0.02]} />
              <meshStandardMaterial color={outfitColor} roughness={0.4} />
            </mesh>
            <mesh position={[0.1, 0.05, 0.01]} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[0.1, 0.32, 0.02]} />
              <meshStandardMaterial color={outfitColor} roughness={0.4} />
            </mesh>
          </group>
        )}

        {isPolo && (
          <group position={[0, 0.22, 0.16]}>
            <mesh rotation={[0.4, 0, 0]}>
              <boxGeometry args={[0.26, 0.08, 0.04]} />
              <meshStandardMaterial color={outfitAccent} />
            </mesh>
          </group>
        )}
      </group>

      {/* Neck */}
      <mesh castShadow position={[0, 1.33, 0]}>
        <cylinderGeometry args={[0.11, 0.13, 0.14, 20]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Neck Accessories */}
      {hasNecklace && <NeckJewelry3D type={hasNecklace} offsetY={1.28} />}
      {hasBag && <Bag3D type={hasBag} bodyWidth={0.32} offsetY={0.95} />}

      {/* Arms */}
      <group ref={leftArmRef} position={[-0.38, 1.22, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={outfitColor} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[-0.04, -0.24, 0]} rotation={[0, 0, 0.12]}>
          <cylinderGeometry args={[0.09, 0.075, 0.44, 16]} />
          <meshStandardMaterial color={outfitColor} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[-0.08, -0.5, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {hasCoffee && <Prop3D type="coffee" handPosition={[-0.1, -0.48, 0.08]} />}
      </group>

      <group ref={rightArmRef} position={[0.38, 1.22, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color={outfitColor} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0.04, -0.24, 0]} rotation={[0, 0, -0.12]}>
          <cylinderGeometry args={[0.09, 0.075, 0.44, 16]} />
          <meshStandardMaterial color={outfitColor} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0.08, -0.5, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {hasMic && <Prop3D type="mic" handPosition={[0.12, -0.46, 0.08]} />}
      </group>

      {hasLaptop && <Prop3D type="laptop" />}
      {hasRocket && <Prop3D type="rocket" />}

      {/* Head */}
      <group ref={headGroupRef} position={[0, 1.58, 0]}>
        <mesh castShadow receiveShadow scale={[headScaleX, headScaleY, 1.0]}>
          <sphereGeometry args={[0.26, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.45} />
        </mesh>

        {/* Ears */}
        <mesh position={[-0.27, 0, 0]} scale={[0.6, 1, 0.8]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.45} />
        </mesh>
        <mesh position={[0.27, 0, 0]} scale={[0.6, 1, 0.8]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.45} />
        </mesh>

        {/* Eyes & Expression */}
        <group position={[0, 0.02, 0.22]}>
          {/* Eyes */}
          {expression === "zen" || expression === "laughing" ? (
            // Smiling curved closed eyes
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
          ) : expression === "winking" ? (
            <>
              {/* Left open */}
              <group position={[-0.09, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.042, 16, 16]} />
                  <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.02]} scale={[1, 1, 0.3]}>
                  <sphereGeometry args={[0.025, 16, 16]} />
                  <meshStandardMaterial color="#1E1B4B" roughness={0.1} />
                </mesh>
                <mesh position={[0.008, 0.008, 0.026]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
              {/* Right wink */}
              <mesh position={[0.09, 0, 0]} rotation={[0, 0, Math.PI]}>
                <torusGeometry args={[0.035, 0.007, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#1E1B4B" />
              </mesh>
            </>
          ) : (
            // Open expressive eyes
            <>
              <group position={[-0.09, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.042, 16, 16]} />
                  <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.02]} scale={[1, 1, 0.3]}>
                  <sphereGeometry args={[0.025, 16, 16]} />
                  <meshStandardMaterial color="#1E1B4B" roughness={0.1} />
                </mesh>
                <mesh position={[0.008, 0.008, 0.026]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
              <group position={[0.09, 0, 0]}>
                <mesh scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[0.042, 16, 16]} />
                  <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
                </mesh>
                <mesh position={[0, 0, 0.02]} scale={[1, 1, 0.3]}>
                  <sphereGeometry args={[0.025, 16, 16]} />
                  <meshStandardMaterial color="#1E1B4B" roughness={0.1} />
                </mesh>
                <mesh position={[0.008, 0.008, 0.026]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </>
          )}

          {/* Eyebrows */}
          <mesh
            position={[-0.09, 0.065, 0.01]}
            rotation={[0, 0, expression === "curious" ? 0.25 : expression === "surprised" ? 0.15 : 0.08]}
          >
            <boxGeometry args={[0.08, 0.016, 0.015]} />
            <meshStandardMaterial color={hairColor} roughness={0.8} />
          </mesh>
          <mesh
            position={[0.09, 0.065, 0.01]}
            rotation={[0, 0, expression === "curious" ? -0.05 : expression === "surprised" ? -0.15 : -0.08]}
          >
            <boxGeometry args={[0.08, 0.016, 0.015]} />
            <meshStandardMaterial color={hairColor} roughness={0.8} />
          </mesh>

          {/* Nose */}
          <mesh position={[0, -0.02, 0.04]} scale={[0.8, 1, 1.2]}>
            <sphereGeometry args={[0.02, 12, 12]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>

          {/* Mouth */}
          {expression === "surprised" ? (
            <mesh position={[0, -0.075, 0.02]}>
              <torusGeometry args={[0.025, 0.008, 8, 16]} />
              <meshStandardMaterial color="#BE185D" roughness={0.3} />
            </mesh>
          ) : expression === "excited" || expression === "laughing" || expression === "celebrating" ? (
            <mesh position={[0, -0.075, 0.02]} rotation={[Math.PI, 0, 0]}>
              <cylinderGeometry args={[0.045, 0.02, 0.04, 16, 1, false, 0, Math.PI]} />
              <meshStandardMaterial color="#BE185D" roughness={0.3} />
            </mesh>
          ) : (
            <mesh position={[0, -0.075, 0.02]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.035, 0.008, 8, 16, Math.PI]} />
              <meshStandardMaterial color="#BE185D" roughness={0.3} />
            </mesh>
          )}

          {/* Cheeks */}
          <mesh position={[-0.13, -0.04, -0.02]}>
            <circleGeometry args={[0.035, 16]} />
            <meshBasicMaterial color="#FDA4AF" transparent opacity={0.4} />
          </mesh>
          <mesh position={[0.13, -0.04, -0.02]}>
            <circleGeometry args={[0.035, 16]} />
            <meshBasicMaterial color="#FDA4AF" transparent opacity={0.4} />
          </mesh>
        </group>

        {/* Hairstyles */}
        {hairStyle !== "bald" && (
          <group name="hair-group">
            {hairStyle === "swoop" && (
              <group position={[0, 0.12, 0]}>
                <mesh castShadow scale={[1.02, 0.95, 1.05]}>
                  <sphereGeometry args={[0.27, 24, 24]} />
                  <meshStandardMaterial color={hairColor} roughness={0.7} />
                </mesh>
                <mesh castShadow position={[0.06, 0.06, 0.18]} rotation={[0.2, 0.4, -0.3]}>
                  <cylinderGeometry args={[0.16, 0.22, 0.16, 16]} />
                  <meshStandardMaterial color={hairColor} roughness={0.7} />
                </mesh>
              </group>
            )}

            {(hairStyle === "buzz" || hairStyle === "crew") && (
              <mesh castShadow position={[0, 0.14, 0]} scale={[1.01, 0.85, 1.02]}>
                <sphereGeometry args={[0.265, 24, 24]} />
                <meshStandardMaterial color={hairColor} roughness={0.8} />
              </mesh>
            )}

            {(hairStyle === "curly" || hairStyle === "afro") && (
              <group position={[0, 0.12, 0]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.3, 24, 24]} />
                  <meshStandardMaterial color={hairColor} roughness={0.9} />
                </mesh>
                {[-0.15, -0.05, 0.05, 0.15].map((x, i) => (
                  <mesh key={i} castShadow position={[x, 0.14, 0.12]}>
                    <sphereGeometry args={[0.08, 12, 12]} />
                    <meshStandardMaterial color={hairColor} roughness={0.9} />
                  </mesh>
                ))}
              </group>
            )}

            {(hairStyle === "long" || hairStyle === "straight-long") && (
              <group position={[0, 0.08, 0]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.275, 24, 24]} />
                  <meshStandardMaterial color={hairColor} roughness={0.6} />
                </mesh>
                <mesh castShadow position={[0, -0.22, -0.08]}>
                  <boxGeometry args={[0.5, 0.48, 0.22]} />
                  <meshStandardMaterial color={hairColor} roughness={0.6} />
                </mesh>
              </group>
            )}

            {(hairStyle === "bun" || hairStyle === "ponytail") && (
              <group position={[0, 0.1, 0]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.27, 24, 24]} />
                  <meshStandardMaterial color={hairColor} roughness={0.7} />
                </mesh>
                <mesh castShadow position={[0, 0.26, -0.08]}>
                  <sphereGeometry args={[0.13, 20, 20]} />
                  <meshStandardMaterial color={hairColor} roughness={0.7} />
                </mesh>
              </group>
            )}

            {(hairStyle === "bob" || hairStyle === "spiky" || hairStyle === "braids") && (
              <group position={[0, 0.1, 0]}>
                <mesh castShadow>
                  <sphereGeometry args={[0.28, 24, 24]} />
                  <meshStandardMaterial color={hairColor} roughness={0.7} />
                </mesh>
                {/* Side fall */}
                <mesh position={[-0.26, -0.1, 0]} castShadow>
                  <cylinderGeometry args={[0.06, 0.08, 0.3, 12]} />
                  <meshStandardMaterial color={hairColor} roughness={0.7} />
                </mesh>
                <mesh position={[0.26, -0.1, 0]} castShadow>
                  <cylinderGeometry args={[0.06, 0.08, 0.3, 12]} />
                  <meshStandardMaterial color={hairColor} roughness={0.7} />
                </mesh>
              </group>
            )}
          </group>
        )}

        {/* Headwear & Attachments */}
        {hatStyle !== "none" && <Hat3D type={hatStyle} color={hatColor} offsetY={0.16} headRadius={0.26} />}
        {hasCrown && <Prop3D type="crown" scale={1} />}
        {hasGlasses && <Eyewear3D type={hasGlasses} offsetZ={0.26} offsetY={0.02} />}
        {hasHeadphones && <Headphones3D type={hasHeadphones} headWidth={0.28} offsetY={0.02} />}
      </group>
    </group>
  );
}
