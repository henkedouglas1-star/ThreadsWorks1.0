import React, { useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface AccessoryProps {
  accessories: string[];
  scale?: number;
  position?: [number, number, number];
}

// -----------------------------------------------------------------------------
// 3D FLOATING AURA SPARKLES PARTICLES
// -----------------------------------------------------------------------------
export function AuraSparkles({ count = 16, color = "#C084FC" }: { count?: number; color?: string }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 2.2,
      y: 0.4 + Math.random() * 1.5,
      z: (Math.random() - 0.5) * 2.2,
      size: 0.02 + Math.random() * 0.035,
      speed: 0.8 + Math.random() * 1.2,
      offset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  const groupRef = React.useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      if (child && p) {
        child.position.y = p.y + Math.sin(t * p.speed + p.offset) * 0.12;
        child.rotation.y = t * 1.5 + p.offset;
        child.rotation.z = t * 1.2;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <octahedronGeometry args={[p.size, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

// -----------------------------------------------------------------------------
// 3D EYEWEAR (GLASSES, SUNGLASSES, WAYFARER, GEEK-CHIC)
// -----------------------------------------------------------------------------
export function Eyewear3D({
  type,
  scale = 1,
  offsetZ = 0.26,
  offsetY = 0,
  frameColor = "#1E293B",
}: {
  type: "glasses" | "wayfarer" | "sunglasses" | "geek-chic";
  scale?: number;
  offsetZ?: number;
  offsetY?: number;
  frameColor?: string;
}) {
  const isTinted = type === "sunglasses" || type === "wayfarer";
  const isSquare = type === "geek-chic" || type === "wayfarer";

  return (
    <group position={[0, offsetY, offsetZ]} scale={[scale, scale, scale]}>
      {/* Left Frame */}
      <group position={[-0.09, 0, 0]}>
        {isSquare ? (
          <mesh>
            <boxGeometry args={[0.09, 0.08, 0.015]} />
            <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.7} />
          </mesh>
        ) : (
          <mesh>
            <ringGeometry args={[0.042, 0.054, 24]} />
            <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
          </mesh>
        )}

        {/* Lens */}
        <mesh position={[0, 0, -0.002]}>
          {isSquare ? <planeGeometry args={[0.076, 0.066]} /> : <circleGeometry args={[0.043, 24]} />}
          <meshStandardMaterial
            color={isTinted ? "#0F172A" : "#60A5FA"}
            transparent
            opacity={isTinted ? 0.85 : 0.25}
            roughness={0.1}
            metalness={isTinted ? 0.3 : 0.1}
          />
        </mesh>
      </group>

      {/* Right Frame */}
      <group position={[0.09, 0, 0]}>
        {isSquare ? (
          <mesh>
            <boxGeometry args={[0.09, 0.08, 0.015]} />
            <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.7} />
          </mesh>
        ) : (
          <mesh>
            <ringGeometry args={[0.042, 0.054, 24]} />
            <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
          </mesh>
        )}

        {/* Lens */}
        <mesh position={[0, 0, -0.002]}>
          {isSquare ? <planeGeometry args={[0.076, 0.066]} /> : <circleGeometry args={[0.043, 24]} />}
          <meshStandardMaterial
            color={isTinted ? "#0F172A" : "#60A5FA"}
            transparent
            opacity={isTinted ? 0.85 : 0.25}
            roughness={0.1}
            metalness={isTinted ? 0.3 : 0.1}
          />
        </mesh>
      </group>

      {/* Center Nose Bridge */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.055, 0.012, 0.012]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Side Temples (Going back towards ears) */}
      <mesh position={[-0.14, 0, -0.1]} rotation={[0, -0.15, 0]}>
        <boxGeometry args={[0.01, 0.01, 0.22]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[0.14, 0, -0.1]} rotation={[0, 0.15, 0]}>
        <boxGeometry args={[0.01, 0.01, 0.22]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}

// -----------------------------------------------------------------------------
// 3D HEADPHONES & AUDIO
// -----------------------------------------------------------------------------
export function Headphones3D({
  type = "headphones",
  scale = 1,
  offsetY = 0.04,
  headWidth = 0.28,
  primaryColor = "#8B5CF6",
}: {
  type?: "headphones" | "neon-headphones" | "earbuds";
  scale?: number;
  offsetY?: number;
  headWidth?: number;
  primaryColor?: string;
}) {
  const isNeon = type === "neon-headphones";

  if (type === "earbuds") {
    return (
      <group position={[0, offsetY, 0]} scale={[scale, scale, scale]}>
        <mesh position={[-headWidth - 0.01, -0.02, 0.05]}>
          <cylinderGeometry args={[0.018, 0.014, 0.035, 12]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.4} />
        </mesh>
        <mesh position={[headWidth + 0.01, -0.02, 0.05]}>
          <cylinderGeometry args={[0.018, 0.014, 0.035, 12]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.4} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, offsetY, 0]} scale={[scale, scale, scale]}>
      {/* Left Ear Cushion */}
      <group position={[-headWidth - 0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 24]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={isNeon ? primaryColor : "#000000"}
            emissiveIntensity={isNeon ? 0.6 : 0}
            metalness={0.6}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, -0.03, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.02, 20]} />
          <meshStandardMaterial color="#0F172A" roughness={0.9} />
        </mesh>
      </group>

      {/* Right Ear Cushion */}
      <group position={[headWidth + 0.03, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 24]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={isNeon ? primaryColor : "#000000"}
            emissiveIntensity={isNeon ? 0.6 : 0}
            metalness={0.6}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.02, 20]} />
          <meshStandardMaterial color="#0F172A" roughness={0.9} />
        </mesh>
      </group>

      {/* Overhead Band */}
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[headWidth + 0.03, 0.022, 12, 32, Math.PI]} />
        <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Neon Light Strip on Band if Neon */}
      {isNeon && (
        <mesh position={[0, 0.22, 0.005]}>
          <torusGeometry args={[headWidth + 0.035, 0.008, 8, 32, Math.PI]} />
          <meshStandardMaterial color={primaryColor} emissive={primaryColor} emissiveIntensity={0.9} />
        </mesh>
      )}
    </group>
  );
}

// -----------------------------------------------------------------------------
// 3D JEWELRY (GOLD CHAIN, PEARLS)
// -----------------------------------------------------------------------------
export function NeckJewelry3D({
  type,
  scale = 1,
  offsetY = 1.28,
  offsetZ = 0.08,
}: {
  type: "gold-chain" | "pearls";
  scale?: number;
  offsetY?: number;
  offsetZ?: number;
}) {
  const isGold = type === "gold-chain";

  return (
    <group position={[0, offsetY, offsetZ]} scale={[scale, scale, scale]} rotation={[0.4, 0, 0]}>
      {isGold ? (
        <mesh rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.18, 0.016, 12, 28, Math.PI]} />
          <meshStandardMaterial color="#FBBF24" metalness={0.95} roughness={0.15} />
        </mesh>
      ) : (
        <group>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = Math.PI + (i / 11) * Math.PI;
            const r = 0.18;
            return (
              <mesh key={i} position={[Math.cos(angle) * r, Math.sin(angle) * r * 0.8, 0]}>
                <sphereGeometry args={[0.02, 12, 12]} />
                <meshStandardMaterial color="#F8FAFC" roughness={0.1} metalness={0.3} />
              </mesh>
            );
          })}
        </group>
      )}
    </group>
  );
}

// -----------------------------------------------------------------------------
// 3D BAGS (BACKPACK, CROSSBODY, TOTE)
// -----------------------------------------------------------------------------
export function Bag3D({
  type,
  scale = 1,
  bodyWidth = 0.32,
  offsetY = 0.95,
}: {
  type: "backpack" | "crossbody" | "tote";
  scale?: number;
  bodyWidth?: number;
  offsetY?: number;
}) {
  if (type === "backpack") {
    return (
      <group position={[0, offsetY, -0.22]} scale={[scale, scale, scale]}>
        {/* Main Pack */}
        <mesh castShadow>
          <boxGeometry args={[bodyWidth * 0.9, 0.38, 0.16]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
        {/* Outer Pocket */}
        <mesh position={[0, -0.06, -0.09]}>
          <boxGeometry args={[bodyWidth * 0.7, 0.2, 0.06]} />
          <meshStandardMaterial color="#1E293B" roughness={0.6} />
        </mesh>
        {/* Shoulder Straps */}
        <mesh position={[-0.1, 0.12, 0.1]}>
          <boxGeometry args={[0.04, 0.28, 0.02]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
        <mesh position={[0.1, 0.12, 0.1]}>
          <boxGeometry args={[0.04, 0.28, 0.02]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      </group>
    );
  }

  if (type === "crossbody") {
    return (
      <group position={[0.14, offsetY - 0.15, 0.14]} scale={[scale, scale, scale]} rotation={[0, 0.2, -0.1]}>
        {/* Bag Pouch */}
        <mesh castShadow>
          <boxGeometry args={[0.2, 0.14, 0.08]} />
          <meshStandardMaterial color="#8B5CF6" roughness={0.5} />
        </mesh>
        {/* Diagonal Strap */}
        <mesh position={[-0.14, 0.25, 0]} rotation={[0, 0, -0.7]}>
          <boxGeometry args={[0.03, 0.6, 0.015]} />
          <meshStandardMaterial color="#1E293B" />
        </mesh>
      </group>
    );
  }

  // Tote bag hanging off shoulder
  return (
    <group position={[-bodyWidth - 0.08, offsetY - 0.2, 0]} scale={[scale, scale, scale]}>
      <mesh castShadow>
        <boxGeometry args={[0.08, 0.28, 0.26]} />
        <meshStandardMaterial color="#F5EBE0" roughness={0.8} />
      </mesh>
      {/* Handles */}
      <mesh position={[0, 0.2, 0]}>
        <torusGeometry args={[0.1, 0.012, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#A89F91" />
      </mesh>
    </group>
  );
}

// -----------------------------------------------------------------------------
// 3D PROPS (COFFEE, MIC, LAPTOP, CROWN, ROCKET)
// -----------------------------------------------------------------------------
export function Prop3D({
  type,
  scale = 1,
  handPosition = [0.42, 0.75, 0.12],
}: {
  type: "coffee" | "mic" | "laptop" | "crown" | "rocket";
  scale?: number;
  handPosition?: [number, number, number];
}) {
  if (type === "coffee") {
    return (
      <group position={handPosition} scale={[scale, scale, scale]} rotation={[0, 0, -0.1]}>
        {/* Mug Body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.06, 0.045, 0.13, 20]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.2} metalness={0.1} />
        </mesh>
        {/* Coffee Liquid / Lid */}
        <mesh position={[0, 0.065, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.02, 20]} />
          <meshStandardMaterial color="#7C3AED" roughness={0.3} />
        </mesh>
        {/* Heat Sleeve */}
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[0.061, 0.054, 0.06, 20]} />
          <meshStandardMaterial color="#78350F" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  if (type === "mic") {
    return (
      <group position={handPosition} scale={[scale, scale, scale]} rotation={[0.4, 0, 0]}>
        {/* Mic Body Handle */}
        <mesh castShadow>
          <cylinderGeometry args={[0.022, 0.016, 0.18, 16]} />
          <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Condenser Grille Head */}
        <mesh position={[0, 0.11, 0]}>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.95} roughness={0.15} />
        </mesh>
        {/* Grip Ring */}
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.015, 16]} />
          <meshStandardMaterial color="#8B5CF6" emissive="#8B5CF6" emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }

  if (type === "laptop") {
    return (
      <group position={[0, 0.95, 0.28]} scale={[scale, scale, scale]} rotation={[-0.3, 0, 0]}>
        {/* Keyboard Base */}
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.016, 0.24]} />
          <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Open Display */}
        <group position={[0, 0.09, -0.11]} rotation={[-0.52, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.22, 0.014]} />
            <meshStandardMaterial color="#0F172A" metalness={0.9} />
          </mesh>
          {/* Glowing Screen Content */}
          <mesh position={[0, 0, 0.008]}>
            <planeGeometry args={[0.31, 0.19]} />
            <meshStandardMaterial color="#8B5CF6" emissive="#8B5CF6" emissiveIntensity={0.6} />
          </mesh>
        </group>
      </group>
    );
  }

  if (type === "crown") {
    return (
      <group position={[0, 1.88, 0]} scale={[scale, scale, scale]}>
        {/* Crown Circlet */}
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.19, 0.14, 8]} />
          <meshStandardMaterial color="#F59E0B" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Jewels */}
        {[-0.14, 0, 0.14].map((x, i) => (
          <mesh key={i} position={[x, 0.02, 0.19]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "rocket") {
    return (
      <group position={[0.42, 1.1, 0.2]} scale={[scale * 0.8, scale * 0.8, scale * 0.8]} rotation={[0.4, -0.3, 0.2]}>
        {/* Rocket Body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.02, 0.06, 0.24, 16]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
        </mesh>
        {/* Nose Cone */}
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.06, 0.1, 16]} />
          <meshStandardMaterial color="#EF4444" />
        </mesh>
        {/* Thruster Fire Glow */}
        <mesh position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.04, 0.1, 12]} />
          <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.9} />
        </mesh>
      </group>
    );
  }

  return null;
}

// -----------------------------------------------------------------------------
// 3D HATS & HEADWEAR (BEANIE, SNAPBACK, BERET, BUCKET, HEADBAND, CROWN)
// -----------------------------------------------------------------------------
export function Hat3D({
  type,
  color = "#1E293B",
  scale = 1,
  offsetY = 1.76,
  headRadius = 0.26,
}: {
  type: string;
  color?: string | THREE.Color;
  scale?: number;
  offsetY?: number;
  headRadius?: number;
}) {
  if (type === "none" || !type) return null;

  return (
    <group position={[0, offsetY, 0]} scale={[scale, scale, scale]}>
      {type === "snapback" && (
        <group position={[0, 0.04, 0]} rotation={[0.12, 0, 0]}>
          {/* Dome */}
          <mesh castShadow>
            <sphereGeometry args={[headRadius + 0.02, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          {/* Snapback Visor */}
          <mesh castShadow position={[0, -0.02, headRadius - 0.04]} rotation={[0.22, 0, 0]}>
            <boxGeometry args={[headRadius * 1.15, 0.02, headRadius * 0.8]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        </group>
      )}

      {type === "beanie" && (
        <mesh castShadow position={[0, 0.05, 0]} rotation={[-0.1, 0, 0]} scale={[1, 1.15, 1]}>
          <sphereGeometry args={[headRadius + 0.03, 24, 24]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      )}

      {type === "beret" && (
        <group position={[0.04, 0.06, 0]} rotation={[0.1, 0, -0.2]}>
          <mesh castShadow>
            <cylinderGeometry args={[headRadius * 1.1, headRadius * 0.9, 0.08, 24]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          {/* Stalk */}
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.01, 0.01, 0.03, 8]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      )}

      {type === "bucket" && (
        <group position={[0, 0.06, 0]}>
          {/* Crown */}
          <mesh castShadow>
            <cylinderGeometry args={[headRadius * 0.92, headRadius * 1.05, 0.16, 24]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          {/* Down-angled Brim */}
          <mesh castShadow position={[0, -0.07, 0]} rotation={[0.1, 0, 0]}>
            <cylinderGeometry args={[headRadius * 1.45, headRadius * 1.15, 0.08, 24, 1, true]} />
            <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {type === "headband" && (
        <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[headRadius + 0.015, 0.03, 12, 32]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}
