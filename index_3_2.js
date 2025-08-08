"use strict";
import { computeTextData, setTurnAndPlayer } from "./index_2_abstract.js";

let device, context, pipeline;
let vertexBuffer, indexBuffer;
let vertexData, indexData;
let renderLoopActive = false;

// 初始化 WebGPU：获取 adapter、device、canvas 与上下文，并配置画布
const initWebGPU = async () => {
  if (!navigator.gpu) {
    console.error("WebGPU 不支持！");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();

  const canvas = document.querySelector("canvas");
  context = canvas.getContext("webgpu");

  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
  });

  // 简单的着色器：将传入顶点做透视变换并上色
  const shaderCode = `
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
        return vec4f(0.0, 0.5, 1.0, 1.0);
    }
  `;

  pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({ code: shaderCode }),
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, format: "float32x3", offset: 0 }],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ code: shaderCode }),
      entryPoint: "fs_main",
      targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
    },
    primitive: { topology: "triangle-list" },
  });

  // 初始化空缓冲区（后续根据数据大小重新创建）
  vertexBuffer = device.createBuffer({
    size: 0,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  indexBuffer = device.createBuffer({
    size: 0,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });

  // 启动渲染循环
  if (!renderLoopActive) {
    renderLoopActive = true;
    requestAnimationFrame(renderFrame);
  }
};

// 根据最新生成的 vertexData 与 indexData 更新 GPU 缓冲区
const updateBuffers = () => {
  if (!vertexBuffer || vertexBuffer.size !== vertexData.byteLength) {
    if (vertexBuffer) vertexBuffer.destroy();
    vertexBuffer = device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }
  if (!indexBuffer || indexBuffer.size !== indexData.byteLength) {
    if (indexBuffer) indexBuffer.destroy();
    indexBuffer = device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);
};

// 渲染一帧：绑定管线和缓冲区并绘制
const renderFrame = () => {
  if (!vertexData || !indexData) {
    requestAnimationFrame(renderFrame);
    return;
  }
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: [1, 1, 1, 1],
      },
    ],
  });
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, vertexBuffer);
  passEncoder.setIndexBuffer(indexBuffer, "uint32");
  passEncoder.drawIndexed(indexData.length);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(renderFrame);
};

// 主函数：初始化 WebGPU，调用 textData 模块计算数据，然后更新缓冲区并周期性更新
const main = async () => {
  await initWebGPU();

  // 首次调用计算文本数据
  const data = await computeTextData();
  if (!data) return;
  vertexData = data.vertexData;
  indexData = data.indexData;
  updateBuffers();

  let localTurn = 1;
  let localPlayer = 1;

  // 每 3 秒更新一次文本（更新 turnNumber 与 playerNumber 后重新计算数据）
  setInterval(async () => {
    // // 简单示例：循环更新 turnNumber 与 playerNumber
    // turnNumber = turnNumber >= 99 ? 1 : turnNumber + 1;
    // playerNumber = playerNumber === 1 ? 2 : 1;
    // 更新局部状态
    localTurn = localTurn >= 99 ? 1 : localTurn + 1;
    localPlayer = localPlayer === 1 ? 2 : 1;

    // 如果需要外部设置，可调用 setTurnAndPlayer(turn, player)
    setTurnAndPlayer(localTurn, localPlayer);

    const newData = await computeTextData();
    if (!newData) return;
    vertexData = newData.vertexData;
    indexData = newData.indexData;
    updateBuffers();
  }, 3000);
};

main();
