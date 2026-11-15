import React, { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WARNING_SIGN_SPEC } from "../engine/collision.js";
import { createWarningSignTexture } from "../engine/apparition-textures.js";
import { useAfterdarkStore } from "../store.js";

const BOARD_WIDTH = 1.9;
const BOARD_HEIGHT = BOARD_WIDTH / 2;
const BOARD_CENTER_Y = 1.75;
const POST_HEIGHT = 2.35;

/**
 * Rotten wooden warning sign just inside the gate. The painted lettering glows faintly
 * (emissive map = the sign texture) so it reads in the dark, with a slow breathing pulse
 * well below any flash threshold. A cold point of light is avoided on purpose: the
 * quality budget caps dynamic point lights.
 */
export const GhostWarningSign: React.FC = () => {
  const { texture, boardMat, woodMat, boardGeo, faceGeo, postGeo, braceGeo } = useMemo(() => {
    const tex = createWarningSignTexture();
    return {
      texture: tex,
      boardMat: new THREE.MeshStandardMaterial({
        color: tex ? "#ffffff" : "#2a211b",
        map: tex,
        emissive: new THREE.Color("#cfe9dc"),
        emissiveMap: tex,
        emissiveIntensity: 0.6,
        roughness: 0.92,
        metalness: 0,
      }),
      woodMat: new THREE.MeshStandardMaterial({ color: "#1d1712", roughness: 0.95 }),
      boardGeo: new THREE.BoxGeometry(BOARD_WIDTH, BOARD_HEIGHT, 0.06),
      faceGeo: new THREE.PlaneGeometry(BOARD_WIDTH * 0.98, BOARD_HEIGHT * 0.96),
      postGeo: new THREE.BoxGeometry(0.11, POST_HEIGHT, 0.11),
      braceGeo: new THREE.BoxGeometry(BOARD_WIDTH * 0.94, 0.07, 0.05),
    };
  }, []);

  useEffect(
    () => () => {
      texture?.dispose();
      boardMat.dispose();
      woodMat.dispose();
      boardGeo.dispose();
      faceGeo.dispose();
      postGeo.dispose();
      braceGeo.dispose();
    },
    [texture, boardMat, woodMat, boardGeo, faceGeo, postGeo, braceGeo],
  );

  useFrame((rootState) => {
    if (typeof document !== "undefined" && document.hidden) return;
    const mat = boardMat;
    const phase = useAfterdarkStore.getState().phase;
    // Dark during the opening, then a slow ~0.4 Hz ghost-light breath
    const t = rootState.clock.elapsedTime;
    const breath = 0.5 + 0.18 * Math.sin(t * 2.4) + 0.06 * Math.sin(t * 5.3 + 1.1);
    mat.emissiveIntensity = phase === "shutdown" ? 0 : breath;
  });

  return (
    <group
      position={[WARNING_SIGN_SPEC.x, 0, WARNING_SIGN_SPEC.z]}
      rotation={[0, WARNING_SIGN_SPEC.rotY, 0.035]}
    >
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={postGeo}
          material={woodMat}
          position={[side * WARNING_SIGN_SPEC.postOffset, POST_HEIGHT / 2, -0.06]}
          rotation={[0, 0, side * 0.03]}
        />
      ))}
      <mesh geometry={braceGeo} material={woodMat} position={[0, BOARD_CENTER_Y - BOARD_HEIGHT / 2 - 0.08, -0.06]} />
      <group position={[0, BOARD_CENTER_Y, 0]} rotation={[-0.05, 0, -0.04]}>
        <mesh geometry={boardGeo} material={woodMat} />
        <mesh geometry={faceGeo} material={boardMat} position={[0, 0, 0.032]} />
      </group>
    </group>
  );
};
