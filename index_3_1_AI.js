"use strict";
import { getCylinderData, getTorusData, getXData } from "./index_abstract.js";

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
  const vertexData_lineSegment = getCylinderData();
  const vertexData_torus = getTorusData();
  const vertexData_X = getXData();

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
  let instanceTransforms = [...];

  let hiddenIndices = {
    Torus: new Array(25).fill(false), // Torus group (Total 25 instances)
    X: new Array(25).fill(false), // X group (Total 25 instances)
  };

  // Three states: O / X / Hidden, cycling through 1-3 triggers
  const toggleInstances = (index) => {
    if (index >= 1 && index <= 25) {
      console.log(`index: ${index}`);
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

    device.queue.writeBuffer(instanceBuffer, 0, flattenInstanceTransforms);

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
            console.log(data);
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
      console.log(
        `Clicked cell number: ${index}`,
        `row: ${row}`,
        `col: ${col}`
      );
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
