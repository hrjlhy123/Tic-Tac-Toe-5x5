`use strict`;

/* Math Utilities */

// Normalization: Adjust a vector to a unit vector so that it has the same direction but a length of one.
const normalize = (v) => {
  // Euclidean norm
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
  return [v[0] / len, v[1] / len, v[2] / len];
};

// Cross product: Calculate the normal vector of two 3D vectors that are perpendicular to them.
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1], // x
  a[2] * b[0] - a[0] * b[2], // y
  a[0] * b[1] - a[1] * b[0], // z
];

// Dot product: A measure of the similarity of two vectors. The larger the value of the dot product, the more parallel the vectors are. (0 when vertical)
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// mat3Multiply: 3D matrix * 3D vector for rotation, scaling...
const mat3Multiply = (mat, vec) => {
  return [
    mat[0] * vec[0] + mat[1] * vec[1] + mat[2] * vec[2], // x-component
    mat[3] * vec[0] + mat[4] * vec[1] + mat[5] * vec[2], // y-component
    mat[6] * vec[0] + mat[7] * vec[1] + mat[8] * vec[2], // z-component
  ];
};

/* Public Function */

// Vertex rotation function
const rotateVertices = (vertices, angle, axis) => {
  let rotated = [];
  const cosA = Math.cos(angle),
    sinA = Math.sin(angle),
    [x, y, z] = axis;

  // Rotation matrix (Rodrigues' rotation formula)
  // prettier-ignore
  const rotationMatrix = [
        cosA + (1 - cosA) * x * x, (1 - cosA) * x * y - sinA * z, (1 - cosA) * x * z + sinA * y,
        (1 - cosA) * y * x + sinA * z, cosA + (1 - cosA) * y * y, (1 - cosA) * y * z - sinA * x,
        (1 - cosA) * z * x - sinA * y, (1 - cosA) * z * y + sinA * x, cosA + (1 - cosA) * x * z,
    ]

  for (let i = 0; i < vertices.length; i += 10) {
    const v = [vertices[i], vertices[i + 1], vertices[i + 2]], // x, y, z
      n = [vertices[i + 3], vertices[i + 4], vertices[i + 5]]; // Normal vector
    const vNew = mat3Multiply(rotationMatrix, v),
      nNew = mat3Multiply(rotationMatrix, n);

    // prettier-ignore
    rotated.push(
        vNew[0], vNew[1], vNew[2], // Rotated x, y, z
        nNew[0], nNew[1], nNew[2], // Rotated normal vector
        ... vertices.slice(i + 6, i + 10) // Copy rgba
      )
  }

  return rotated;
};

// Matrix tanslation function
const createTranslationMatrix = (x, y, z) => {
  // prettier-ignore
  return new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1,
    ])
};

// Matrix rotation function
// prettier-ignore
const createRotationMatrix = (xAngle, yAngle, zAngle) => {
    const cosX = Math.cos(xAngle), sinX = Math.sin(xAngle),
        cosY = Math.cos(yAngle), sinY = Math.sin(yAngle),
        cosZ = Math.cos(zAngle), sinZ = Math.sin(zAngle);

    // Rotation matrix around X-axis
    const rotX = [
        1,    0,     0,     0,
        0, cosX, -sinX,     0,
        0, sinX,  cosX,     0,
        0,    0,     0,     1,
    ]

    // Rotation matrix around Y-axis
    const rotY = [
        cosY, 0, sinY, 0,
           0, 1,    0, 0,
       -sinY, 0, cosY, 0,
           0, 0,    0, 1,
    ]

    // Rotation matrix around Z-axis
    const rotZ = [
        cosZ, -sinZ, 0, 0,
        sinZ,  cosZ, 0, 0,
           0,     0, 1, 0,
           0,     0, 0, 1,
    ]

    return multiplyMatrices(multiplyMatrices(rotZ, rotY), rotX)
}

// Affine transformation function: Combines multiple 3D transformations (rotation, scaling, translation) using 4x4 matrix multiplication.

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

/* Geometry Definitions */
/* Format: [x, y, z, nx, ny, nz, r, g, b, a] */

// Cylinder representation of line segments
const cylinder = (radius = 0.1, height = 4.8, segment = 24) => {
  const angleStep = (Math.PI * 2) / segment,
    angleStep2 = Math.PI / 2 / (segment / 2);

  let vertices = [];

  // Hemisphere (base)
  // prettier-ignore
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

        vertices.push(x1, y1, z1, n1[0], n1[1], n1[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(x2, y2, z2, n2[0], n2[1], n2[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0)

        vertices.push(x2, y2, z2, n2[0], n2[1], n2[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(r2 * Math.cos(theta + angleStep), y2, r2 * Math.sin(theta + angleStep), n4[0], n4[1], n4[2], 1.0, 1.0, 1.0, 1.0)
    }
  }

  // Hemisphere (top)
  // prettier-ignore
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

        vertices.push(x1, y1, z1, n1[0], n1[1], n1[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(x2, y2, z2, n2[0], n2[1], n2[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0)

        vertices.push(x2, y2, z2, n2[0], n2[1], n2[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(r1 * Math.cos(theta + angleStep), y1, r1 * Math.sin(theta + angleStep), n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0)
        vertices.push(r2 * Math.cos(theta + angleStep), y2, r2 * Math.sin(theta + angleStep), n4[0], n4[1], n4[2], 1.0, 1.0, 1.0, 1.0)
    }
  }

  // Cylindrical side
  // prettier-ignore
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

    vertices.push(x1, -height / 2, z1, n1[0], n1[1], n1[2], 1.0, 1.0, 1.0, 1.0)
    vertices.push(x1, height / 2, z1, n2[0], n2[1], n2[2], 1.0, 1.0, 1.0, 1.0)
    vertices.push(x2, height / 2, z2, n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0)

    vertices.push(x1, -height / 2, z1, n1[0], n1[1], n1[2], 1.0, 1.0, 1.0, 1.0)
    vertices.push(x2, height / 2, z2, n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0)
    vertices.push(x2, -height / 2, z2, n4[0], n4[1], n4[2], 1.0, 1.0, 1.0, 1.0)
  }
  return vertices;
};

// Torus
// prettier-ignore
const torus = (R = 0.28, r = 0.1, segmentMain = 24, segmentTube = 24) => {
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

      const n1 = normalize([x1 - R * Math.cos(theta1), y1 - R * Math.sin(theta1), z1,]),
        n2 = normalize([x2 - R * Math.cos(theta2), y2 - R * Math.sin(theta2), z2,]),
        n3 = normalize([x3 - R * Math.cos(theta2), y3 - R * Math.sin(theta2), z3,]),
        n4 = normalize([x4 - R * Math.cos(theta1), y4 - R * Math.sin(theta1), z4,]);

      vertices.push(x1, y1, z1, n1[0], n1[1], n1[2], 1.0, 1.0, 1.0, 1.0);
      vertices.push(x2, y2, z2, n2[0], n2[1], n2[2], 1.0, 1.0, 1.0, 1.0);
      vertices.push(x3, y3, z3, n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0);
      vertices.push(x1, y1, z1, n1[0], n1[1], n1[2], 1.0, 1.0, 1.0, 1.0);
      vertices.push(x3, y3, z3, n3[0], n3[1], n3[2], 1.0, 1.0, 1.0, 1.0);
      vertices.push(x4, y4, z4, n4[0], n4[1], n4[2], 1.0, 1.0, 1.0, 1.0);
    }
  }
  console.log("Torus Vertex Count:", vertices.length / 10)
  return vertices
};

// "X" geometry by rotating two cylinders
const X = () => {
  const segment = 24;

  const cylinderVertices = cylinder(undefined, 0.8, undefined);

  console.log("Original Cylinder Vertex Count:", cylinderVertices.length / 10);

  const rotatedVertices1 = rotateVertices(
      cylinderVertices,
      Math.PI / 4,
      [0, 0, 1]
    ),
    rotatedVertices2 = rotateVertices(
      cylinderVertices,
      -Math.PI / 4,
      [0, 0, 1]
    );

  console.log(
    "Rotated Cylinder Vertex Count:",
    rotatedVertices1.length / 10,
    rotatedVertices2.length / 10
  );

  return [...rotatedVertices1, ...rotatedVertices2];
};

/* Shader */

const shaderCode = `
struct DataStruct {
    @builtin(position) pos: vec4f,
    @location(0) normal: vec3f,
    @location(1) colors: vec4f,
}

struct InstanceData {
    modelMatrix: mat4x4<f32>,
}

struct Uniforms {
    projectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>, // Camera
    rotationX: f32,
    rotationY: f32,
    position_mouse: vec2<f32>
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(1) @binding(0) var<storage, read> instances: array<InstanceData>;

@vertex
fn vertexMain(
    @location(0) coords: vec3f,
    @location(1) normal: vec3f,
    @location(2) colors: vec4f,
    @builtin(instance_index) instanceIndex: u32
) -> DataStruct {
    var outData: DataStruct;

    // Instance transformation matrix
    let modelMatrix = instances[instanceIndex].modelMatrix;

    let worldPosition = modelMatrix * vec4f(coords, 1.0);
    let worldNormal = normalize((modelMatrix * vec4f(normal, 0.0)).xyz);

    outData.pos = uniforms.projectionMatrix * uniforms.viewMatrix * worldPosition;
    outData.normal = worldNormal;
    outData.colors = colors;
    return outData;
}

@fragment
fn fragmentMain(fragData: DataStruct) -> @location(0) vec4f {
    let lightDirection = normalize(vec3f(uniforms.position_mouse.x, uniforms.position_mouse.y, 5.0));
    let diffuse = max(dot(fragData.normal, lightDirection), 0.0);
    return vec4f(fragData.colors.rgb * diffuse * 1.0, fragData.colors.a);
}
`;

/* WebGPU Configuration */

const canvas = document.getElementById("canvas");

const run = async () => {
  let normalizedX = 1.0,
    normalizedY = 1.0;

  if (!navigator.gpu) {
    throw new Error("WebGPU not supported");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No GPUAdapter found");
  }

  const device = await adapter.requestDevice();
  if (!device) {
    throw new Error("Failed to create a GPUDevice");
  }

  if (!canvas) {
    throw new Error("Could not access canvas in page");
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("Could not obtain WebGPU context for canvas");
  }

  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device: device,
    format: canvasFormat,
    alphaMode: "premultiplied",
  });

  /* Vertex Buffers */
  const vertexData_lineSegment = new Float32Array([...cylinder()]),
    vertexData_torus = new Float32Array([...torus()]),
    vertexData_X = new Float32Array([...X()]);

  console.log(
    `VertexData_lineSegment Count: ${vertexData_lineSegment.length / 10}`
  );
  console.log(`VertexData_torus Count: ${vertexData_torus.length / 10}`);
  console.log(`VertexData_X Count: ${vertexData_X.length / 10}`);

  const vertexBuffer_lineSegment = device.createBuffer({
    label: `lineSegment vertex buffer`,
    size: vertexData_lineSegment.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const vertexBuffer_torus = device.createBuffer({
    label: `torus vertex buffer`,
    size: vertexData_torus.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const vertexBuffer_X = device.createBuffer({
    label: `X vertex buffer`,
    size: vertexData_X.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(vertexBuffer_lineSegment, 0, vertexData_lineSegment);
  device.queue.writeBuffer(vertexBuffer_torus, 0, vertexData_torus);
  device.queue.writeBuffer(vertexBuffer_X, 0, vertexData_X);

  /* Instance Data Setup */
  // prettier-ignore
  let instanceTransforms = [
    // First batch (Cylinder)
    [
      ...createTranslationMatrix(-1.5, 0, 0),
      ...createTranslationMatrix(-0.5, 0, 0),
      ...createTranslationMatrix(0.5, 0, 0),
      ...createTranslationMatrix(1.5, 0, 0),
      ...multiplyMatrices(createTranslationMatrix(-1.5, 0, 0), createRotationMatrix(0, 0, Math.PI / 2)),
      ...multiplyMatrices(createTranslationMatrix(-0.5, 0, 0), createRotationMatrix(0, 0, Math.PI / 2)),
      ...multiplyMatrices(createTranslationMatrix(0.5, 0, 0), createRotationMatrix(0, 0, Math.PI / 2)),
      ...multiplyMatrices(createTranslationMatrix(1.5, 0, 0), createRotationMatrix(0, 0, Math.PI / 2)),
    ],
    // Second batch (Torus)
    [
      ...createTranslationMatrix(-2, 2, 0),
      ...createTranslationMatrix(-1, 2, 0),
      ...createTranslationMatrix(0, 2, 0),
      ...createTranslationMatrix(1, 2, 0),
      ...createTranslationMatrix(2, 2, 0),
      ...createTranslationMatrix(-2, 1, 0),
      ...createTranslationMatrix(-1, 1, 0),
      ...createTranslationMatrix(0, 1, 0),
      ...createTranslationMatrix(1, 1, 0),
      ...createTranslationMatrix(2, 1, 0),
      ...createTranslationMatrix(-2, 0, 0),
      ...createTranslationMatrix(-1, 0, 0),
      ...createTranslationMatrix(0, 0, 0),
      ...createTranslationMatrix(1, 0, 0),
      ...createTranslationMatrix(2, 0, 0),
      ...createTranslationMatrix(-2, -1, 0),
      ...createTranslationMatrix(-1, -1, 0),
      ...createTranslationMatrix(0, -1, 0),
      ...createTranslationMatrix(1, -1, 0),
      ...createTranslationMatrix(2, -1, 0),
      ...createTranslationMatrix(-2, -2, 0),
      ...createTranslationMatrix(-1, -2, 0),
      ...createTranslationMatrix(0, -2, 0),
      ...createTranslationMatrix(1, -2, 0),
      ...createTranslationMatrix(2, -2, 0),
    ],
    // Third batch (X)
    [
      ...createTranslationMatrix(-2, 2, 0),
      ...createTranslationMatrix(-1, 2, 0),
      ...createTranslationMatrix(0, 2, 0),
      ...createTranslationMatrix(1, 2, 0),
      ...createTranslationMatrix(2, 2, 0),
      ...createTranslationMatrix(-2, 1, 0),
      ...createTranslationMatrix(-1, 1, 0),
      ...createTranslationMatrix(0, 1, 0),
      ...createTranslationMatrix(1, 1, 0),
      ...createTranslationMatrix(2, 1, 0),
      ...createTranslationMatrix(-2, 0, 0),
      ...createTranslationMatrix(-1, 0, 0),
      ...createTranslationMatrix(0, 0, 0),
      ...createTranslationMatrix(1, 0, 0),
      ...createTranslationMatrix(2, 0, 0),
      ...createTranslationMatrix(-2, -1, 0),
      ...createTranslationMatrix(-1, -1, 0),
      ...createTranslationMatrix(0, -1, 0),
      ...createTranslationMatrix(1, -1, 0),
      ...createTranslationMatrix(2, -1, 0),
      ...createTranslationMatrix(-2, -2, 0),
      ...createTranslationMatrix(-1, -2, 0),
      ...createTranslationMatrix(0, -2, 0),
      ...createTranslationMatrix(1, -2, 0),
      ...createTranslationMatrix(2, -2, 0),
    ],
  ];

  let hiddenIndices = {
    Torus: new Array(25).fill(false), // Torus group (Total 25 instances)
    X: new Array(25).fill(false), // X group (Total 25 instances)
  };

  // Three states: O / X / Hidden, cycling through 1-3 triggers
  const toggleInstances = (index) => {
    if (index >= 1 && index <= 25) {
      console.log(`index: ${index}`)
      if (hiddenIndices.Torus[index - 1] && hiddenIndices.X[index - 1]) {
        hiddenIndices.Torus[index - 1] = !hiddenIndices.Torus[index - 1];
      } else if (!hiddenIndices.X[index - 1]) {
        hiddenIndices.X[index - 1] = !hiddenIndices.X[index - 1];
      } else {
        hiddenIndices.Torus[index - 1] = !hiddenIndices.Torus[index - 1];
        hiddenIndices.X[index - 1] = !hiddenIndices.X[index - 1];
      }
    } else {
      hiddenIndices = {
        Torus: new Array(25).fill(true),
        X: new Array(25).fill(true),
      };
    }

    // Matrix splitting function based on instance format: 16 floats (4x4 matrix)
    const splitInstances = (instances, hiddenArray) => {
      return instances.reduce((acc, _, i) => {
        if (i % 16 == 0) {
          const instanceIndex = i / 16;
          if (!hiddenArray[instanceIndex]) {
            acc.push(...instances.slice(i, i + 16));
          }
        }
        return acc;
      }, []);
    };

    const filteredTransforms = [
      instanceTransforms[0], // Line segments (cylinders) are always visible
      splitInstances(instanceTransforms[1], hiddenIndices.Torus),
      splitInstances(instanceTransforms[2], hiddenIndices.X),
    ];

    return filteredTransforms;
  };

  const updateInstanceBuffer = (index) => {
    const instanceTransforms_selected = toggleInstances(index);

    const flattenInstanceTransforms = new Float32Array(
      instanceTransforms_selected.flat(Infinity)
    );

    device.queue.writeBuffer(
      instanceBuffer,
      0,
      flattenInstanceTransforms
    );

    instanceCountCylinder = instanceTransforms_selected[0].length / 16;
    instanceCountTorus = instanceTransforms_selected[1].length / 16;
    instanceCountX = instanceTransforms_selected[2].length / 16;

    // console.log(`instanceCountCylinder: ${instanceCountCylinder}`)
    // console.log(`instanceCountTorus: ${instanceCountTorus}`)
    // console.log(`instanceCountX: ${instanceCountX}`)
    render(); // Re-render
  };

  document.querySelectorAll(`[id^="toggle"]`).forEach((button) => {
    button.addEventListener(`click`, (event) => {
      const id = event.target.id;
      const index = parseInt(id.replace(`toggle`, ``), 10);
      // console.log(`index: ${index}`)
      updateInstanceBuffer(index);
    });
  });

  let instanceCountCylinder = instanceTransforms[0].length / 16,
    instanceCountTorus = instanceTransforms[1].length / 16,
    instanceCountX = instanceTransforms[2].length / 16;

  // console.log(`instanceCountCylinder: ${instanceCountCylinder}`);
  // console.log(`instanceCountTorus: ${instanceCountTorus}`);
  // console.log(`instanceCountX: ${instanceCountX}`);

  const flattenInstanceTransforms = new Float32Array(
    instanceTransforms.flat(Infinity)
  );

  const instanceBuffer = device.createBuffer({
    label: "Instance Transform Buffer",
    size: flattenInstanceTransforms.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(instanceBuffer, 0, flattenInstanceTransforms);

  /* Pipeline & Shader Setup */
  const vertexBufferLayout = [
    {
      arrayStride: 40, // 10 floats * 4 bytes = 40 bytes per vertex
      attributes: [
        { format: "float32x3", offset: 0, shaderLocation: 0 }, // Vertex coordinates
        { format: "float32x3", offset: 12, shaderLocation: 1 }, // Normal vector
        { format: "float32x4", offset: 24, shaderLocation: 2 }, // Color (RGBA)
      ],
    },
  ];

  const shaderModule = device.createShaderModule({
    label: "shader module",
    code: shaderCode,
  });

  const sampleCount = 4; // MSAA sample count

  const MSAATexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: canvasFormat,
    sampleCount: sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    sampleCount: sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // Uniform buffer
  const uniformBuffer = device.createBuffer({
    size: 64 + 64 + 8 + 8, // Projection Matrix + View Matrix + Rotation + Padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0, // Uniform Buffer
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });

  const bindGroupLayoutInstance = device.createBindGroupLayout({
    entries: [
      {
        binding: 0, // Instance Buffer
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ],
  });

  const bindGroupInstance = device.createBindGroup({
    layout: bindGroupLayoutInstance,
    entries: [
      {
        binding: 0,
        resource: { buffer: instanceBuffer },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout, bindGroupLayoutInstance],
  });

  const renderPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vertexMain",
      buffers: vertexBufferLayout,
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragmentMain",
      targets: [
        {
          format: canvasFormat,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
    multisample: { count: 4 },
  });

  /* Render Function */
  const render = () => {
    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: MSAATexture.createView(),
          resolveTarget: context.getCurrentTexture().createView(),
          loadOp: "clear",
          clearValue: { r: 0.9, g: 0.9, b: 0.9, a: 0.0 },
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setBindGroup(1, bindGroupInstance);

    // Draw line segment (Cylinder)
    renderPass.setVertexBuffer(0, vertexBuffer_lineSegment);
    renderPass.draw(
      vertexData_lineSegment.length / 10,
      instanceCountCylinder,
      0,
      0
    );

    // Draw torus
    renderPass.setVertexBuffer(0, vertexBuffer_torus);
    renderPass.draw(
      vertexData_torus.length / 10,
      instanceCountTorus,
      0,
      instanceCountCylinder
    );

    // Draw X geometry
    renderPass.setVertexBuffer(0, vertexBuffer_X);
    renderPass.draw(
      vertexData_X.length / 10,
      instanceCountX,
      0,
      instanceCountCylinder + instanceCountTorus
    );

    renderPass.end();
    device.queue.submit([encoder.finish()]);
  };

  /* Camera Matrices */
  // prettier-ignore
  const createViewMatrix = (eye, center, up, rotationX = 0, rotationY = 0) => {
    const forward = normalize([
      center[0] - eye[0],
      center[1] - eye[1],
      center[2] - eye[2],
    ]);
    const right = normalize(cross(forward, up));

    const cosX = Math.cos(rotationX), sinX = Math.sin(rotationX);
    const cosY = Math.cos(rotationY), sinY = Math.sin(rotationY);

    // Rotate around X-axis (vertical rotation)
    const rotatedForwardX = [
      forward[0],
      forward[1] * cosX - forward[2] * sinX,
      forward[1] * sinX + forward[2] * cosX,
    ];

    // Rotate around Y-axis (horizontal rotation)
    const rotatedForward = [rotatedForwardX[0] * cosY - rotatedForwardX[2] * sinY, rotatedForwardX[1], rotatedForwardX[0] * sinY + rotatedForwardX[2] * cosY];

    const rotatedRight = [right[0] * cosY - right[2] * sinY, right[1], right[0] * sinY + right[2] * cosY,];

    const rotatedUp = cross(rotatedRight, rotatedForward);

    return [
      rotatedRight[0], rotatedUp[0], -rotatedForward[0], 0,
      rotatedRight[1], rotatedUp[1], -rotatedForward[1], 0,
      rotatedRight[2], rotatedUp[2], -rotatedForward[2], 0,
      -dot(rotatedRight, eye), -dot(rotatedUp, eye), dot(rotatedForward, eye), 1,
    ];
  };

  const eye = [0, 0, 8],
    center = [0, 0, 0],
    up = [0, 1, 0];

  // prettier-ignore
  const createProjectionMatrix = (fov, aspect, near, far) => {
    const f = 1.0 / Math.tan(fov / 2);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0,
    ];
  };

  const fov = Math.PI / 4,
    aspect = canvas.width / canvas.height,
    near = 0.1,
    far = 10.0;
  const projectionMatrix = createProjectionMatrix(fov, aspect, near, far);

  let rotationX = 0.0,
    rotationY = 0.0;

  // prettier-ignore
  const updateUniforms = (x = 1.0, y = 1.0) => {
    const viewMatrix = createViewMatrix(eye, center, up, rotationX, rotationY);
    const uniformData = new Float32Array([
      ...projectionMatrix, ...viewMatrix,
      0, 0, // rotationX, rotationY (8 bytes)
      x, y, // position_mouse (8 bytes)
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
  };

  // Optionally update alpha channel for X geometry
  const updateAlpha = () => {
    const newVertexData = new Float32Array(vertexData_X);
    for (let i = 0; i < newVertexData.length / 10; i++) {
      newVertexData[i * 10 + 9] = 0.0;
    }
    device.queue.writeBuffer(vertexBuffer_X, 0, newVertexData);
  };

  const animationLoop = () => {
    updateUniforms(normalizedX, normalizedY);
    render();
    requestAnimationFrame(animationLoop);
  };

  updateUniforms(normalizedX, normalizedY);
  render();

  // Hide Torus and X in the next frame
  requestAnimationFrame(() => {
    console.log("Hiding Torus and X...");
    hiddenIndices.Torus = new Array(instanceCountTorus).fill(true);
    hiddenIndices.X = new Array(instanceCountX).fill(true);
    updateInstanceBuffer(null);
  });

  animationLoop();

  /* WebSocket Connection */
  const socket = io("ws://localhost:5000");

  socket.on("connect", () => {
    console.log("Connected to WebSocket successfully!");
  });

  socket.on("update", (data) => {
    // console.log("Server Response:", data);
    if (data.number != 0) {
      // console.log(`data.number:`, data.number)
      const button = document.getElementById("toggle" + data.number);
      if (button) {
        let piece = "";
        // console.log(`button:`, button)
        // console.log(`data:`, data)
        if (data.parity == 1) {
          piece = "O";
          button.click();
        } else if (data.parity == 0) {
          piece = "X";
          button.click();
          button.click();
        }
        console.log(piece);
        if ("win" in data) {
          if (data.win === true) {
            console.log(data)
            const numbers_win = data.numbers_win;
            const divs = document.querySelectorAll("div#win > div");
            numbers_win.forEach((num) => {
              if (divs[num - 1]) {
                divs[num - 1].style.visibility = "visible";
              }
            });
            if (data.AI === true) {
              divs.forEach((div) => {
                div.classList.toggle("win_AI");
              });
            }
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                alert(piece + " win!");
                socket.emit("info", { number: 0 });
                updateInstanceBuffer(null);
                divs.forEach((div) => {
                  div.style.visibility = "hidden";
                  div.classList.remove("win_AI");
                });
              });
            });
          } else if (data.win === false) {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                alert("Tie!");
                socket.emit("info", { number: 0 });
                updateInstanceBuffer(null);
                const divs = document.querySelectorAll("div#win > div");
                divs.forEach((div) => {
                  div.style.visibility = "hidden";
                  div.classList.remove("win_AI");
                });
              });
            });
          }
        }
        // console.log("Triggered button:", data.number);
      }
    } else if (data.number == 0) {
      console.log("Resetting game");
      const divs = document.querySelectorAll("div#win > div");
      divs.forEach((div) => {
        div.style.visibility = "hidden";
        div.classList.remove("win_AI");
      });
      updateInstanceBuffer(null);
    }
  });

  document.querySelectorAll("input[name='gameMode']").forEach((input) => {
    input.addEventListener("change", (event) => {
      const gameMode = event.target.value;
      console.log("gameMode:", gameMode + "P");
      socket.emit("info", { number: 0, gameMode: gameMode });
    });
  });

  canvas.addEventListener("click", async (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Define grid parameters
    const gridSize = 400; // Canvas size
    // const offset = 15; // Margin
    const offset = 54;
    // const gap = 10; // Gap between cells
    const gap = 11;
    // const cellSize = (gridSize - 2 * offset - gap * 4) / 5;
    const cellSize = (gridSize - 2 * offset - gap * 4) / 5;

    const col = Math.floor((x - offset) / (cellSize + gap));
    const row = Math.floor((y - offset) / (cellSize + gap));

    // Check if click is within valid area
    if (
      x < offset ||
      x > gridSize - offset ||
      y < offset ||
      y > gridSize - offset
    ) {
      console.log("Click outside valid area");
      return;
    }

    // Check if click is on the gap between cells
    if (
      (x - offset) % (cellSize + gap) > cellSize ||
      (y - offset) % (cellSize + gap) > cellSize
    ) {
      console.log("Click on gap area");
      return;
    }

    if (row >= 0 && row < 5 && col >= 0 && col < 5) {
      const index = row * 5 + col + 1;
      console.log(`Clicked cell number: ${index}`, `row: ${row}`, `col: ${col}`);
      socket.emit("info", { number: index });
    }
    console.log(`Click at screen coordinates: (${x}, ${y})`);
  });

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    normalizedX = (2 * x) / rect.width - 1;
    normalizedY = 1 - (2 * y) / rect.height;
    requestAnimationFrame(() => {
      updateUniforms(normalizedX, normalizedY);
      render();
    });
  });
};

run();
