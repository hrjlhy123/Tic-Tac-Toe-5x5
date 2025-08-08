"use strict";

// ========== import 工具函数：第一段 & 第二段都需要 ==========

import { getCylinderData, getTorusData, getXData } from "./index_abstract.js";
import { computeTextData, setTurnAndPlayer } from "./index_2_abstract.js";

// ========== 第一段所需变量 & 函数（除去与Canvas/Device相关的初始化） ==========

let vertexBuffer_lineSegment, vertexBuffer_torus, vertexBuffer_X;
let instanceBuffer;
let instanceCountCylinder = 0,
  instanceCountTorus = 0,
  instanceCountX = 0;
let hiddenIndices = { Torus: [], X: [] };
let instanceTransforms = []; // 外部应填充实际矩阵
let vertexData_lineSegment, vertexData_torus, vertexData_X;

const normalize = (v) => {
  // Euclidean norm
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

// 这里的 shader 代码（第一段）
const shaderCode_geometry = `

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
    return vec4f(fragData.colors.rgb * diffuse, fragData.colors.a);
}
`;

// 第一段：用于更新 instance 的可见性（Torus/X 是否隐藏）
function toggleInstances(index) {
  if (index >= 1 && index <= 25) {
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

  // 分割函数，每 16 个 float 代表一个 4x4 矩阵
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
    instanceTransforms[0], // Cylinder (line segment) 总是显示
    splitInstances(instanceTransforms[1], hiddenIndices.Torus),
    splitInstances(instanceTransforms[2], hiddenIndices.X),
  ];

  return filteredTransforms;
}

// ========== 第二段文字渲染所需的变量 & 着色器 ==========

let textVertexBuffer, textIndexBuffer;
let textVertexData, textIndexData;
let textPipeline; // 专门绘制文字的管线

// 注意，这里把第二段原始 wgsl 合并进来，只做最少改动
const shaderCode_text = `
@vertex
fn vs_main(@location(0) pos: vec3f) -> @builtin(position) vec4f {
    let scale = 0.8;
    let perspective = mat4x4<f32>(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.5,
        0.0, 0.0, 0.0, 1.0
    );
    return perspective * vec4f(pos * scale, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
    // 文字本身用青色
    return vec4f(0.0, 0.5, 1.0, 1.0);
}
`;

// ========== 公用的初始化与渲染循环 ==========

let device, context;
let geometryPipeline; // 第一段的“几何”管线
let uniformBuffer;
let bindGroup, bindGroupInstance;
let MSAATexture, depthTexture;
let sampleCount = 4;

let rotationX = 0.0,
  rotationY = 0.0;
let normalizedX = 1.0,
  normalizedY = 1.0;

function normalize(v) {
  const len = Math.hypot(...v);
  return len > 0 ? v.map((x) => x / len) : [0, 0, 0];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// 第一段的辅助函数：创建视图矩阵
function createViewMatrix(eye, center, up, rx = 0, ry = 0) {
  const forward = normalize([
    center[0] - eye[0],
    center[1] - eye[1],
    center[2] - eye[2],
  ]);
  const right = normalize(cross(forward, up));

  const cosX = Math.cos(rx),
    sinX = Math.sin(rx);
  const cosY = Math.cos(ry),
    sinY = Math.sin(ry);

  // rotate around X
  const rotatedForwardX = [
    forward[0],
    forward[1] * cosX - forward[2] * sinX,
    forward[1] * sinX + forward[2] * cosX,
  ];
  // rotate around Y
  const rotatedForward = [
    rotatedForwardX[0] * cosY - rotatedForwardX[2] * sinY,
    rotatedForwardX[1],
    rotatedForwardX[0] * sinY + rotatedForwardX[2] * cosY,
  ];
  const rotatedRight = [
    right[0] * cosY - right[2] * sinY,
    right[1],
    right[0] * sinY + right[2] * cosY,
  ];
  const rotatedUp = cross(rotatedRight, rotatedForward);

  return [
    rotatedRight[0],
    rotatedUp[0],
    -rotatedForward[0],
    0,
    rotatedRight[1],
    rotatedUp[1],
    -rotatedForward[1],
    0,
    rotatedRight[2],
    rotatedUp[2],
    -rotatedForward[2],
    0,
    -dot(rotatedRight, eye),
    -dot(rotatedUp, eye),
    dot(rotatedForward, eye),
    1,
  ];
}

// 第一段的辅助函数：创建投影矩阵
function createProjectionMatrix(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov / 2);
  return [
    f / aspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) / (near - far),
    -1,
    0,
    0,
    (2 * far * near) / (near - far),
    0,
  ];
}

const eye = [0, 0, 8],
  center = [0, 0, 0],
  up = [0, 1, 0];
const fov = Math.PI / 4,
  aspect = 1.0,
  near = 0.1,
  far = 10.0;
let projectionMatrix = createProjectionMatrix(fov, aspect, near, far);

async function initAll() {
  // 1) 请求 adapter / device
  if (!navigator.gpu) throw new Error("WebGPU not supported");
  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();

  // 2) 访问 canvas & context
  const canvas = document.getElementById("canvas");
  context = canvas.getContext("webgpu");
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

  // 3) 配置 canvas
  context.configure({
    device,
    format: canvasFormat,
    alphaMode: "premultiplied",
  });

  // 4) MSAA & Depth
  sampleCount = 4;
  MSAATexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: canvasFormat,
    sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    sampleCount,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // ========== 第一段：创建“几何”相关的资源 ==========

  // 4.1) 获取几何数据
  vertexData_lineSegment = getCylinderData();
  vertexData_torus = getTorusData();
  vertexData_X = getXData();

  console.log(
    `VertexData_lineSegment Count: ${vertexData_lineSegment.length / 10}`
  );
  console.log(`VertexData_torus Count: ${vertexData_torus.length / 10}`);
  console.log(`VertexData_X Count: ${vertexData_X.length / 10}`);

  // 4.2) 创建 GPUBuffer
  vertexBuffer_lineSegment = device.createBuffer({
    label: "lineSegment vertex buffer",
    size: vertexData_lineSegment.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  vertexBuffer_torus = device.createBuffer({
    label: "torus vertex buffer",
    size: vertexData_torus.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  vertexBuffer_X = device.createBuffer({
    label: "X vertex buffer",
    size: vertexData_X.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer_lineSegment, 0, vertexData_lineSegment);
  device.queue.writeBuffer(vertexBuffer_torus, 0, vertexData_torus);
  device.queue.writeBuffer(vertexBuffer_X, 0, vertexData_X);

  // 4.3) 初始化 Instance 的数据 (这里简单举例)
  // 实际上需要你自己填充
  instanceTransforms = [
    // First batch (Cylinder)
    [
      ...createTranslationMatrix(-1.5, 0, 0),
      ...createTranslationMatrix(-0.5, 0, 0),
      ...createTranslationMatrix(0.5, 0, 0),
      ...createTranslationMatrix(1.5, 0, 0),
      ...multiplyMatrices(
        createTranslationMatrix(-1.5, 0, 0),
        createRotationMatrix(0, 0, Math.PI / 2)
      ),
      ...multiplyMatrices(
        createTranslationMatrix(-0.5, 0, 0),
        createRotationMatrix(0, 0, Math.PI / 2)
      ),
      ...multiplyMatrices(
        createTranslationMatrix(0.5, 0, 0),
        createRotationMatrix(0, 0, Math.PI / 2)
      ),
      ...multiplyMatrices(
        createTranslationMatrix(1.5, 0, 0),
        createRotationMatrix(0, 0, Math.PI / 2)
      ),
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
  hiddenIndices = {
    Torus: new Array(25).fill(false),
    X: new Array(25).fill(false),
  };

  // 计算实例个数
  instanceCountCylinder = instanceTransforms[0].length / 16; // 这里假设只有一个矩阵
  instanceCountTorus = instanceTransforms[1].length / 16; // 25
  instanceCountX = instanceTransforms[2].length / 16; // 25

  // 4.4) 创建 instanceBuffer
  const flattenTransforms = new Float32Array(instanceTransforms.flat(Infinity));
  instanceBuffer = device.createBuffer({
    label: "Instance Transform Buffer",
    size: flattenTransforms.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(instanceBuffer, 0, flattenTransforms);

  // 4.5) Uniform buffer (projection / view / mouse)
  uniformBuffer = device.createBuffer({
    size: 64 + 64 + 8 + 8, // proj + view + 2 floats + 2 floats
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // 4.6) BindGroup
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });
  const bindGroupLayoutInstance = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });
  bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });
  bindGroupInstance = device.createBindGroup({
    layout: bindGroupLayoutInstance,
    entries: [{ binding: 0, resource: { buffer: instanceBuffer } }],
  });

  // 4.7) 创建“几何”管线 geometryPipeline
  const shaderModule_geometry = device.createShaderModule({
    code: shaderCode_geometry,
  });
  const pipelineLayout_geometry = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout, bindGroupLayoutInstance],
  });
  geometryPipeline = device.createRenderPipeline({
    layout: pipelineLayout_geometry,
    vertex: {
      module: shaderModule_geometry,
      entryPoint: "vertexMain",
      buffers: [
        {
          arrayStride: 40, // 10 floats * 4 bytes
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 0 },
            { format: "float32x3", offset: 12, shaderLocation: 1 },
            { format: "float32x4", offset: 24, shaderLocation: 2 },
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule_geometry,
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
    multisample: { count: sampleCount },
  });

  // ========== 第二段：文字管线（在同一个 device 上） ==========

  // 创建 textPipeline
  const shaderModule_text = device.createShaderModule({
    code: shaderCode_text,
  });
  textPipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule_text,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12, // 3 floats * 4 bytes
          attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
        },
      ],
    },
    fragment: {
      module: shaderModule_text,
      entryPoint: "fs_main",
      targets: [{ format: canvasFormat }],
    },
    primitive: { topology: "triangle-list" },
    multisample: { count: sampleCount }, // 与几何相同的MSAA
  });

  // 初始化空缓冲区
  textVertexBuffer = device.createBuffer({
    size: 0,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  textIndexBuffer = device.createBuffer({
    size: 0,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  // 第一次拿到文字数据
  const textData = await computeTextData();
  if (textData) {
    textVertexData = textData.vertexData;
    textIndexData = textData.indexData;
    updateTextBuffers(); // 写进GPU
  }

  // 文字示例：定时更新
  let localTurn = 1;
  let localPlayer = 1;
  setInterval(async () => {
    localTurn = localTurn >= 99 ? 1 : localTurn + 1;
    localPlayer = localPlayer === 1 ? 2 : 1;
    setTurnAndPlayer(localTurn, localPlayer);

    const newData = await computeTextData();
    if (!newData) return;
    textVertexData = newData.vertexData;
    textIndexData = newData.indexData;
    updateTextBuffers();
  }, 3000);
}

// 更新文字顶点/索引缓冲
function updateTextBuffers() {
  if (!textVertexData || !textIndexData) return;
  // 若大小变化就重新创建
  if (
    !textVertexBuffer ||
    textVertexBuffer.size !== textVertexData.byteLength
  ) {
    if (textVertexBuffer) textVertexBuffer.destroy();
    textVertexBuffer = device.createBuffer({
      size: textVertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }
  if (!textIndexBuffer || textIndexBuffer.size !== textIndexData.byteLength) {
    if (textIndexBuffer) textIndexBuffer.destroy();
    textIndexBuffer = device.createBuffer({
      size: textIndexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }
  device.queue.writeBuffer(textVertexBuffer, 0, textVertexData);
  device.queue.writeBuffer(textIndexBuffer, 0, textIndexData);
}

// 每帧更新第一个 snippet 的 uniform
function updateUniforms(mouseX, mouseY) {
  // 重新计算投影 (万一 Canvas 尺寸改了)
  const canvas = document.getElementById("canvas");
  const aspect = canvas.width / canvas.height;
  projectionMatrix = createProjectionMatrix(fov, aspect, near, far);

  const viewMatrix = createViewMatrix(eye, center, up, rotationX, rotationY);
  const uniformData = new Float32Array([
    ...projectionMatrix,
    ...viewMatrix,
    0,
    0, // rotationX, rotationY (目前用不上)
    mouseX,
    mouseY, // position_mouse
  ]);
  device.queue.writeBuffer(uniformBuffer, 0, uniformData);
}

// 在同一个 Pass 中先画几何，再画文字
function renderAll() {
  updateUniforms(normalizedX, normalizedY);

  const commandEncoder = device.createCommandEncoder();

  // colorAttachment 用 MSAA + resolveTarget
  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: MSAATexture.createView(),
        resolveTarget: context.getCurrentTexture().createView(),
        loadOp: "clear",
        // 改成你想要的背景色
        clearValue: { r: 0.9, g: 0.9, b: 0.9, a: 1.0 },
        storeOp: "store",
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthLoadOp: "clear",
      depthStoreOp: "store",
      depthClearValue: 1.0,
    },
  });

  // ---------- 先画“几何” ----------
  renderPass.setPipeline(geometryPipeline);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.setBindGroup(1, bindGroupInstance);

  // 1) Cylinder
  renderPass.setVertexBuffer(0, vertexBuffer_lineSegment);
  renderPass.draw(
    vertexData_lineSegment.length / 10,
    instanceCountCylinder,
    0,
    0
  );

  // 2) Torus
  renderPass.setVertexBuffer(0, vertexBuffer_torus);
  renderPass.draw(
    vertexData_torus.length / 10,
    instanceCountTorus,
    0,
    instanceCountCylinder
  );

  // 3) X
  renderPass.setVertexBuffer(0, vertexBuffer_X);
  renderPass.draw(
    vertexData_X.length / 10,
    instanceCountX,
    0,
    instanceCountCylinder + instanceCountTorus
  );

  // ---------- 再画“文字” ----------
  if (
    textVertexBuffer &&
    textIndexBuffer &&
    textIndexData &&
    textIndexData.length > 0
  ) {
    renderPass.setPipeline(textPipeline);
    renderPass.setVertexBuffer(0, textVertexBuffer);
    renderPass.setIndexBuffer(textIndexBuffer, "uint32");
    renderPass.drawIndexed(textIndexData.length);
  }

  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}

// 动画循环
function animationLoop() {
  renderAll();
  requestAnimationFrame(animationLoop);
}

// ========== 入口函数，相当于两个 snippet 的整合启动 ==========

async function main() {
  // 1) 初始化（包含第一段、第二段资源）
  await initAll();

  // 2) 添加第一段中的事件监听逻辑
  const canvas = document.getElementById("canvas");
  canvas.addEventListener("click", (event) => {
    // 这里可参考第一段用户点击 => socket.emit(...) => toggle ...
  });
  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    normalizedX = (2 * x) / rect.width - 1;
    normalizedY = 1 - (2 * y) / rect.height;
  });

  // 3) 启动无限循环
  animationLoop();
}

main();

// ========== 补充：在需要时调用，以隐藏/切换 Torus/X ==========

function updateInstanceBuffer(index) {
  const instanceTransforms_selected = toggleInstances(index);
  const flattenInstanceTransforms = new Float32Array(
    instanceTransforms_selected.flat(Infinity)
  );
  device.queue.writeBuffer(instanceBuffer, 0, flattenInstanceTransforms);

  instanceCountCylinder = instanceTransforms_selected[0].length / 16;
  instanceCountTorus = instanceTransforms_selected[1].length / 16;
  instanceCountX = instanceTransforms_selected[2].length / 16;
}
