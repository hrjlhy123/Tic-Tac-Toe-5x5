"use strict";

/* Math Utilities */

// Normalize a vector to unit length.
const normalize = (v) => {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / len, v[1] / len, v[2] / len];
};

// Cross product of two 3D vectors.
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Dot product of two 3D vectors.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Multiply a 3x3 matrix with a 3D vector.
const mat3Multiply = (mat, vec) => {
  return [
    mat[0] * vec[0] + mat[1] * vec[1] + mat[2] * vec[2],
    mat[3] * vec[0] + mat[4] * vec[1] + mat[5] * vec[2],
    mat[6] * vec[0] + mat[7] * vec[1] + mat[8] * vec[2],
  ];
};

// Rotate vertices (each vertex assumed to have 10 floats: pos, normal, rgba)
const rotateVertices = (vertices, angle, axis) => {
  let rotated = [];
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle),
    [x, y, z] = axis;
  // Rodrigues' rotation formula rotation matrix (3x3)
  const rotationMatrix = [
    cosA + (1 - cosA) * x * x, (1 - cosA) * x * y - sinA * z, (1 - cosA) * x * z + sinA * y,
    (1 - cosA) * y * x + sinA * z, cosA + (1 - cosA) * y * y, (1 - cosA) * y * z - sinA * x,
    (1 - cosA) * z * x - sinA * y, (1 - cosA) * z * y + sinA * x, cosA + (1 - cosA) * z * z,
  ];
  for (let i = 0; i < vertices.length; i += 10) {
    const v = [vertices[i], vertices[i + 1], vertices[i + 2]];
    const n = [vertices[i + 3], vertices[i + 4], vertices[i + 5]];
    const vNew = mat3Multiply(rotationMatrix, v);
    const nNew = mat3Multiply(rotationMatrix, n);
    rotated.push(
      vNew[0], vNew[1], vNew[2],
      nNew[0], nNew[1], nNew[2],
      ...vertices.slice(i + 6, i + 10)
    );
  }
  return rotated;
};

// 4x4 Matrix utilities
const createTranslationMatrix = (x, y, z) => {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
};

const multiplyMatrices = (a, b) => {
  const result = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] =
        a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }
  return result;
};

const createRotationMatrix = (xAngle, yAngle, zAngle) => {
  const cosX = Math.cos(xAngle), sinX = Math.sin(xAngle),
        cosY = Math.cos(yAngle), sinY = Math.sin(yAngle),
        cosZ = Math.cos(zAngle), sinZ = Math.sin(zAngle);
  const rotX = [
    1,    0,     0,     0,
    0, cosX, -sinX,     0,
    0, sinX,  cosX,     0,
    0,    0,     0,     1,
  ];
  const rotY = [
    cosY, 0, sinY, 0,
       0, 1,    0, 0,
   -sinY, 0, cosY, 0,
       0, 0,    0, 1,
  ];
  const rotZ = [
    cosZ, -sinZ, 0, 0,
    sinZ,  cosZ, 0, 0,
       0,     0, 1, 0,
       0,     0, 0, 1,
  ];
  return multiplyMatrices(multiplyMatrices(rotZ, rotY), rotX);
};

/* Geometry Definitions */
/* 顶点格式: [x, y, z, nx, ny, nz, r, g, b, a] */

// 生成表示圆柱体两端半球以及侧面（用于线段表示）的顶点数据
function cylinder(radius = 0.1, height = 4.8, segment = 24) {
  const angleStep = (Math.PI * 2) / segment,
        angleStep2 = Math.PI / 2 / (segment / 2);
  let vertices = [];
  // Hemisphere (base)
  for (let i = 0; i < segment / 2; i++) {
    const phi1 = i * angleStep2,
          phi2 = (i + 1) * angleStep2;
    const y1 = -radius * Math.cos(phi1) - height / 2,
          y2 = -radius * Math.cos(phi2) - height / 2;
    const r1 = radius * Math.sin(phi1),
          r2 = radius * Math.sin(phi2);
    for (let j = 0; j <= segment; j++) {
      const theta = j * angleStep;
      const x1 = r1 * Math.cos(theta),
            x2 = r1 * Math.cos(theta),
            z1 = r1 * Math.sin(theta),
            z2 = r2 * Math.sin(theta);
      const n1 = normalize([x1, y1 + height / 2, z1]),
            n2 = normalize([x2, y2 + height / 2, z2]),
            n3 = normalize([r1 * Math.cos(theta + angleStep), y1 + height / 2, r1 * Math.sin(theta + angleStep)]),
            n4 = normalize([r2 * Math.cos(theta + angleStep), y2 + height / 2, r2 * Math.sin(theta + angleStep)]);
      vertices.push(x1, y1, z1, ...n1, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x2, y2, z2, ...n2, 1.0, 1.0, 1.0, 1.0);
      vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), ...n3, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x2, y2, z2, ...n2, 1.0, 1.0, 1.0, 1.0);
      vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), ...n3, 1.0, 1.0, 1.0, 1.0);
      vertices.push(r2 * Math.cos(theta + angleStep), y2, r2 * Math.sin(theta + angleStep), ...n4, 1.0, 1.0, 1.0, 1.0);
    }
  }
  // Hemisphere (top)
  for (let i = 0; i < segment / 2; i++) {
    const phi1 = Math.PI + i * angleStep2,
          phi2 = Math.PI + (i + 1) * angleStep2;
    const y1 = -radius * Math.cos(phi1) + height / 2,
          y2 = -radius * Math.cos(phi2) + height / 2;
    const r1 = radius * Math.sin(phi1),
          r2 = radius * Math.sin(phi2);
    for (let j = 0; j <= segment; j++) {
      const theta = j * angleStep;
      const x1 = r1 * Math.cos(theta),
            x2 = r1 * Math.cos(theta),
            z1 = r1 * Math.sin(theta),
            z2 = r2 * Math.sin(theta);
      const n1 = normalize([x1, y1 - height / 2, z1]),
            n2 = normalize([x2, y2 - height / 2, z2]),
            n3 = normalize([r1 * Math.cos(theta + angleStep), y1 - height / 2, r1 * Math.sin(theta + angleStep)]),
            n4 = normalize([r2 * Math.cos(theta + angleStep), y2 - height / 2, r2 * Math.sin(theta + angleStep)]);
      vertices.push(x1, y1, z1, ...n1, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x2, y2, z2, ...n2, 1.0, 1.0, 1.0, 1.0);
      vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), ...n3, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x2, y2, z2, ...n2, 1.0, 1.0, 1.0, 1.0);
      vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), ...n3, 1.0, 1.0, 1.0, 1.0);
      vertices.push(r2 * Math.cos(theta + angleStep), y2, r2 * Math.sin(theta + angleStep), ...n4, 1.0, 1.0, 1.0, 1.0);
    }
  }
  // Cylindrical side
  for (let i = 0; i < segment; i++) {
    const angle1 = i * angleStep,
          angle2 = (i + 1) * angleStep;
    const x1 = radius * Math.cos(angle1),
          x2 = radius * Math.cos(angle2),
          z1 = radius * Math.sin(angle1),
          z2 = radius * Math.sin(angle2);
    const n1 = normalize([x1, 0, z1]),
          n2 = normalize([x1, 0, z1]),
          n3 = normalize([x2, 0, z2]),
          n4 = normalize([x2, 0, z2]);
    vertices.push(x1, -height / 2, z1, ...n1, 1.0, 1.0, 1.0, 1.0);
    vertices.push(x1, height / 2, z1, ...n2, 1.0, 1.0, 1.0, 1.0);
    vertices.push(x2, height / 2, z2, ...n3, 1.0, 1.0, 1.0, 1.0);
    vertices.push(x1, -height / 2, z1, ...n1, 1.0, 1.0, 1.0, 1.0);
    vertices.push(x2, height / 2, z2, ...n3, 1.0, 1.0, 1.0, 1.0);
    vertices.push(x2, -height / 2, z2, ...n4, 1.0, 1.0, 1.0, 1.0);
  }
  return vertices;
}

// Generate Torus geometry.
function torus(R = 0.28, r = 0.1, segmentMain = 24, segmentTube = 24) {
  const angleStepMain = (Math.PI * 2) / segmentMain,
        angleStepTube = (Math.PI * 2) / segmentTube;
  let vertices = [];
  for (let i = 0; i < segmentMain; i++) {
    const theta1 = i * angleStepMain,
          theta2 = (i + 1) * angleStepMain;
    for (let j = 0; j <= segmentTube; j++) {
      const phi1 = j * angleStepTube,
            phi2 = (j + 1) * angleStepTube;
      const x1 = (R + r * Math.cos(phi1)) * Math.cos(theta1),
            y1 = (R + r * Math.cos(phi1)) * Math.sin(theta1),
            z1 = r * Math.sin(phi1);
      const x2 = (R + r * Math.cos(phi1)) * Math.cos(theta2),
            y2 = (R + r * Math.cos(phi1)) * Math.sin(theta2),
            z2 = r * Math.sin(phi1);
      const x3 = (R + r * Math.cos(phi2)) * Math.cos(theta2),
            y3 = (R + r * Math.cos(phi2)) * Math.sin(theta2),
            z3 = r * Math.sin(phi2);
      const x4 = (R + r * Math.cos(phi2)) * Math.cos(theta1),
            y4 = (R + r * Math.cos(phi2)) * Math.sin(theta1),
            z4 = r * Math.sin(phi2);
      const n1 = normalize([x1 - R * Math.cos(theta1), y1 - R * Math.sin(theta1), z1]),
            n2 = normalize([x2 - R * Math.cos(theta2), y2 - R * Math.sin(theta2), z2]),
            n3 = normalize([x3 - R * Math.cos(theta2), y3 - R * Math.sin(theta2), z3]),
            n4 = normalize([x4 - R * Math.cos(theta1), y4 - R * Math.sin(theta1), z4]);
      vertices.push(x1, y1, z1, ...n1, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x2, y2, z2, ...n2, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x3, y3, z3, ...n3, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x1, y1, z1, ...n1, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x3, y3, z3, ...n3, 1.0, 1.0, 1.0, 1.0);
      vertices.push(x4, y4, z4, ...n4, 1.0, 1.0, 1.0, 1.0);
    }
  }
  console.log("Torus Vertex Count:", vertices.length / 10);
  return vertices;
}

// "X" geometry: 由两个旋转后的圆柱体构成
function X() {
  const segment = 24;
  const cylinderVertices = cylinder(undefined, 0.8, undefined);
  console.log("Original Cylinder Vertex Count:", cylinderVertices.length / 10);
  const rotatedVertices1 = rotateVertices(cylinderVertices, Math.PI / 4, [0, 0, 1]);
  const rotatedVertices2 = rotateVertices(cylinderVertices, -Math.PI / 4, [0, 0, 1]);
  console.log("Rotated Cylinder Vertex Count:", rotatedVertices1.length / 10, rotatedVertices2.length / 10);
  return [...rotatedVertices1, ...rotatedVertices2];
}

/* Exported Data Interface */
// 返回圆柱体（线段）的顶点数据
export function getCylinderData() {
  return new Float32Array(cylinder());
}
// 返回圆环的顶点数据
export function getTorusData() {
  return new Float32Array(torus());
}
// 返回 X 形状的顶点数据
export function getXData() {
  return new Float32Array(X());
}
