import * as THREE from "three";

/**
 * Merges multiple transformed non-indexed Three.js BufferGeometries cleanly into a
 * single instancing-ready BufferGeometry, disposing intermediate geometries immediately.
 */
export function mergeSimpleGeometries(
  parts: readonly THREE.BufferGeometry[],
): THREE.BufferGeometry {
  const prepared: THREE.BufferGeometry[] = [];
  let totalVertices = 0;

  for (const part of parts) {
    const nonIndexed = part.index ? part.toNonIndexed() : part.clone();
    if (!nonIndexed.getAttribute("normal")) {
      nonIndexed.computeVertexNormals();
    }
    const pos = nonIndexed.getAttribute("position");
    totalVertices += pos.count;
    prepared.push(nonIndexed);
    part.dispose();
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);

  let offset = 0;
  for (const g of prepared) {
    const posAttr = g.getAttribute("position") as THREE.BufferAttribute;
    const normAttr = g.getAttribute("normal") as THREE.BufferAttribute;

    for (let i = 0; i < posAttr.count; i++) {
      const dst = (offset + i) * 3;
      positions[dst] = posAttr.getX(i);
      positions[dst + 1] = posAttr.getY(i);
      positions[dst + 2] = posAttr.getZ(i);

      normals[dst] = normAttr.getX(i);
      normals[dst + 1] = normAttr.getY(i);
      normals[dst + 2] = normAttr.getZ(i);
    }

    offset += posAttr.count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Builds a Gothic lancet-arched headstone with stepped granite plinth.
 */
export function createLancetTombstoneGeometry(): THREE.BufferGeometry {
  const plinth = new THREE.BoxGeometry(0.92, 0.22, 0.42);
  plinth.translate(0, 0.11, 0);

  const shape = new THREE.Shape();
  shape.moveTo(-0.34, 0);
  shape.lineTo(0.34, 0);
  shape.lineTo(0.34, 0.96);
  shape.quadraticCurveTo(0.32, 1.32, 0, 1.52);
  shape.quadraticCurveTo(-0.32, 1.32, -0.34, 0.96);
  shape.closePath();

  const slab = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  slab.translate(0, 0.22, -0.1);

  return mergeSimpleGeometries([plinth, slab]);
}

/**
 * Builds an octagonal-base cemetery obelisk monument.
 */
export function createObeliskGeometry(): THREE.BufferGeometry {
  const base = new THREE.BoxGeometry(1.05, 0.34, 1.05);
  base.translate(0, 0.17, 0);

  const shaft = new THREE.CylinderGeometry(0.18, 0.36, 1.85, 4);
  shaft.rotateY(Math.PI / 4);
  shaft.translate(0, 1.26, 0);

  const cap = new THREE.ConeGeometry(0.255, 0.42, 4);
  cap.rotateY(Math.PI / 4);
  cap.translate(0, 2.39, 0);

  return mergeSimpleGeometries([base, shaft, cap]);
}

/**
 * Builds a real 3D gnarled dead tree mesh (tapered crooked trunk + forked bare limbs).
 * Zero flat SVGs, PNGs, or CSS 3D planes.
 */
export function createGnarledTreeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  // Root flare
  const roots = new THREE.CylinderGeometry(0.42, 0.72, 0.7, 7);
  roots.translate(0, 0.35, 0);
  parts.push(roots);

  // Lower trunk leaning slightly west
  const trunkLower = new THREE.CylinderGeometry(0.29, 0.42, 2.0, 7);
  trunkLower.rotateZ(0.08);
  trunkLower.translate(-0.08, 1.65, 0);
  parts.push(trunkLower);

  // Upper twisted trunk leaning back east
  const trunkUpper = new THREE.CylinderGeometry(0.16, 0.29, 2.2, 7);
  trunkUpper.rotateZ(-0.14);
  trunkUpper.rotateX(0.07);
  trunkUpper.translate(0.02, 3.55, 0.05);
  parts.push(trunkUpper);

  // 4 crooked bare claw limbs
  const limbDefs: Array<[number, number, number, number, number, number]> = [
    [0.14, 1.6, 0.72, 0.25, 0.18, 3.1],
    [0.11, 1.45, -0.78, -0.3, -0.22, 3.3],
    [0.09, 1.35, 0.45, 0.85, 0.05, 4.15],
    [0.07, 1.25, -0.52, -0.82, -0.04, 4.35],
  ];

  for (const [topR, len, rz, rx, ox, oy] of limbDefs) {
    const limb = new THREE.CylinderGeometry(topR * 0.45, topR, len, 5);
    limb.rotateZ(rz);
    limb.rotateX(rx);
    limb.translate(ox - Math.sin(rz) * len * 0.4, oy + Math.cos(rz) * len * 0.35, 0);
    parts.push(limb);
  }

  return mergeSimpleGeometries(parts);
}

/**
 * Builds a single wrought-iron fence/gate picket with diamond spear finial.
 */
export function createIronPicketGeometry(height = 2.6): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(0.032, 0.036, height, 6);
  shaft.translate(0, height / 2, 0);

  const spear = new THREE.ConeGeometry(0.072, 0.24, 4);
  spear.rotateY(Math.PI / 4);
  spear.translate(0, height + 0.12, 0);

  return mergeSimpleGeometries([shaft, spear]);
}

export interface AfterdarkSharedGeometries {
  readonly lancetTombstone: THREE.BufferGeometry;
  readonly obeliskTombstone: THREE.BufferGeometry;
  readonly gnarledTree: THREE.BufferGeometry;
  readonly fencePicket: THREE.BufferGeometry;
  readonly stoneBlock: THREE.BufferGeometry;
}

export function createAfterdarkSharedGeometries(): AfterdarkSharedGeometries {
  return {
    lancetTombstone: createLancetTombstoneGeometry(),
    obeliskTombstone: createObeliskGeometry(),
    gnarledTree: createGnarledTreeGeometry(),
    fencePicket: createIronPicketGeometry(2.5),
    stoneBlock: new THREE.BoxGeometry(1, 1, 1),
  };
}

export function disposeAfterdarkSharedGeometries(
  geometries: AfterdarkSharedGeometries,
): void {
  geometries.lancetTombstone.dispose();
  geometries.obeliskTombstone.dispose();
  geometries.gnarledTree.dispose();
  geometries.fencePicket.dispose();
  geometries.stoneBlock.dispose();
}
