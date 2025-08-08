"use strict";
import svgPathParser from "https://cdn.jsdelivr.net/npm/svg-path-parser@latest/+esm";
import earcut from "https://cdn.jsdelivr.net/npm/earcut@latest/+esm";

let turnNumber = 1;
let playerNumber = 1;

const svgURL = `./output_fonts/CascadiaCodeNF_symbol.svg`;
const spacing = 1.6; // 设定字符间距（等宽字体）
const scaleFactor = 0.05; // **缩放比例**（0.5 = 50% 大小）

const numberToWord = {
  0: "zero",
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
};

let device, context, pipeline, vertexBuffer, indexBuffer, vertexData, indexData;
let renderLoopActive = false;

const loadPathFromSVG = async (svgURL, symbolID) => {
  const response = await fetch(svgURL);
  const svgText = await response.text();

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(svgText, `image/svg+xml`);
  const symbol = xmlDoc.querySelector(`symbol#${symbolID}`);
  if (!symbol) {
    console.error(`找不到 symbol: ${symbolID}`);
    return null;
  }

  const path = symbol.querySelector(`path`);
  return path ? path.getAttribute(`d`) : null;
};

const parseSVGPath = (d, curveSegments = 10) => {
  let commands = svgPathParser.parseSVG(d);
  let contours = [];
  let currentContour = [];

  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  commands.forEach((cmd) => {
    switch (cmd.code) {
      case "M": // **移动到 (MoveTo) 绝对**
        if (currentContour.length > 0) contours.push(currentContour);
        currentContour = [cmd.x, cmd.y];
        currentX = cmd.x;
        currentY = cmd.y;
        startX = cmd.x; // 记录起点
        startY = cmd.y;
        break;

      case "L": // **直线 (LineTo) 绝对**
        currentX = cmd.x;
        currentY = cmd.y;
        currentContour.push(currentX, currentY);
        break;

      case "l": // **直线 (LineTo) 相对**
        currentX += cmd.x;
        currentY += cmd.y;
        currentContour.push(currentX, currentY);
        break;

      case "Q": // **二次贝塞尔曲线 (Quadratic Bezier)**
        for (let t = 0; t <= 1; t += 1 / curveSegments) {
          let xt =
            (1 - t) * (1 - t) * currentX +
            2 * (1 - t) * t * cmd.x1 +
            t * t * cmd.x;
          let yt =
            (1 - t) * (1 - t) * currentY +
            2 * (1 - t) * t * cmd.y1 +
            t * t * cmd.y;
          currentContour.push(xt, yt);
        }
        currentX = cmd.x;
        currentY = cmd.y;
        break;

      case "q": // **二次贝塞尔曲线 (Quadratic Bezier) 相对**
        let absoluteX1 = currentX + cmd.x1;
        let absoluteY1 = currentY + cmd.y1;
        let absoluteX = currentX + cmd.x;
        let absoluteY = currentY + cmd.y;

        for (let t = 0; t <= 1; t += 1 / curveSegments) {
          let xt =
            (1 - t) * (1 - t) * currentX +
            2 * (1 - t) * t * absoluteX1 +
            t * t * absoluteX;
          let yt =
            (1 - t) * (1 - t) * currentY +
            2 * (1 - t) * t * absoluteY1 +
            t * t * absoluteY;
          currentContour.push(xt, yt);
        }
        currentX = absoluteX;
        currentY = absoluteY;
        break;

      case "Z": // **闭合路径 (Close Path)**
        currentContour.push(startX, startY); // 确保闭合路径
        contours.push(currentContour);
        currentContour = [];
        currentX = startX;
        currentY = startY;
        break;
    }
  });

  if (currentContour.length > 0) contours.push(currentContour);
  //   console.log(`contours:`, contours);
  return contours;
};

const getPolygonArea = (vertices) => {
  let area = 0;
  for (let i = 0; i < vertices.length; i += 2) {
    let j = (i + 2) % vertices.length;
    area += vertices[i] * vertices[j + 1] - vertices[j] * vertices[i + 1];
  }
  return area / 2;
};

const detectHoles = (allContours) => {
  let verticesList = [],
    holesList = [];

  //   console.log(`allContours:`, allContours);
  let startIndex = 0;
  allContours.forEach((contour, index) => {
    let vertices = [];
    // console.log(`contour:`, contour);
    let area = getPolygonArea(contour);
    // console.log(`Contour ${index} area:`, area);

    if (area > 0) {
      holesList.push(startIndex);
    } else {
      holesList.push(null);
    }
    // console.log(`holesList:`, holesList);

    vertices.push(...contour);
    startIndex += contour.length / 2;
    verticesList.push(vertices);
    // holesList.push(holes);
  });

  //   console.log(`Final verticesList:`, verticesList);
  //   console.log(`Final holesList:`, holesList);

  return { verticesList, holesList };
};

const normalizeVertices = (vertices2D, viewBox, targetSize = 2.0) => {
  const [minX, minY, width, height] = viewBox;
  return vertices2D.map((v, i) => {
    return i % 2 === 0
      ? ((v - minX) / width) * targetSize - 1
      : ((v - minY) / height) * targetSize - 1;
  });
};

// const extrude2DTo3D = (allContours, viewBox, depth = 0.2) => {
//   let vertices3D = [];
//   let sideFaces = [];
//   let frontFaces = [];
//   let backFaces = [];

//   const { vertices, holes } = detectHoles(allContours);
//   let normalized2D = normalizeVertices(vertices, viewBox);

//   let front = [];
//   let back = [];

//   for (let i = 0; i < normalized2D.length; i += 2) {
//     let x = normalized2D[i];
//     let y = normalized2D[i + 1];

//     front.push(vertices3D.length / 3);
//     vertices3D.push(x, y, 0);

//     back.push(vertices3D.length / 3);
//     vertices3D.push(x, y, depth);
//   }

//   console.log(`vertices:`, vertices);
//   console.log(`holes:`, holes);

//   // **🔹 1. 生成正面 (Front)**
//   const indicesFront = earcut(normalized2D, holes);
//   frontFaces = indicesFront.map((idx) => front[idx]);

//   console.log(`frontFaces:`, frontFaces);

//   // **🔹 2. 生成背面 (Back)**
//   const indicesBack = indicesFront.reverse();
//   backFaces = indicesBack.map((idx) => back[idx]);

//   console.log(`backFaces:`, backFaces);

//   // **🔹 3. 生成侧面 (Side Faces)**
//   for (let i = 0; i < front.length - 1; i++) {
//     let next = i + 1;
//     sideFaces.push(front[i], back[i], back[next]);
//     sideFaces.push(front[i], back[next], front[next]);
//   }

//   return {
//     vertices3D,
//     sideFaces: [...frontFaces],
//     sideFaces: [...frontFaces, ...backFaces, ...sideFaces],
//   };
// };

// const extrude2DTo3D = (allContours, viewBox, depth = 0.2) => {
//   let vertices3D = [];
//   let sideFaces = [];
//   let frontFaces = [];
//   let backFaces = [];

//   console.log(`allContours:`, allContours);

//   const { vertices, holes } = detectHoles(allContours);
//   let normalized2D = normalizeVertices(vertices, viewBox);

//   let front = [];
//   let back = [];

//   for (let i = 0; i < normalized2D.length; i += 2) {
//     let x = normalized2D[i];
//     let y = normalized2D[i + 1];

//     front.push(vertices3D.length / 3);
//     vertices3D.push(x, y, 0);

//     back.push(vertices3D.length / 3);
//     vertices3D.push(x, y, depth);
//   }

//   console.log(`vertices:`, vertices);
//   console.log(`holes:`, holes);

//   // **🔹 1. 逐个轮廓计算三角剖分**
//   let startIndex = 0;
//   allContours.forEach((contour, index) => {
//     let contourLength = contour.length / 2;
//     let contourHoles = holes
//       .filter((h) => h >= startIndex && h < startIndex + contourLength)
//       .map((h) => h - startIndex);

//     console.log(
//       `Processing contour ${index}, startIndex=${startIndex}, holes=`,
//       contourHoles
//     );

//     const indicesFront = earcut(
//       normalized2D.slice(startIndex * 2, (startIndex + contourLength) * 2),
//       contourHoles
//     );
//     frontFaces.push(...indicesFront.map((idx) => front[startIndex + idx]));

//     const indicesBack = indicesFront.reverse();
//     backFaces.push(...indicesBack.map((idx) => back[startIndex + idx]));

//     startIndex += contourLength;
//   });

//   console.log(`frontFaces:`, frontFaces);
//   console.log(`backFaces:`, backFaces);

//   // **🔹 3. 生成侧面 (Side Faces)**
//   for (let i = 0; i < front.length - 1; i++) {
//     let next = i + 1;
//     sideFaces.push(front[i], back[i], back[next]);
//     sideFaces.push(front[i], back[next], front[next]);
//   }

//   return {
//     vertices3D,
//     sideFaces: [...sideFaces],
//   };
// };

const extrude2DTo3D = (allContours, viewBox, depth = 0.2) => {
  let vertices3D = [],
    sideFaces = [],
    frontFaces = [],
    backFaces = [];

  const { verticesList, holesList } = detectHoles(allContours);

  verticesList.forEach((vertices, i) => {
    if (holesList[i] != null) {
      //   console.log(`Skipping hole contour ${i}`);
    } else {
      let normalized2D = normalizeVertices(vertices, viewBox),
        holes = null,
        front = [],
        back = [];
      if (holesList[i + 1] != null) {
        holes = holesList[i + 1];
        normalized2D.push(...verticesList[i + 1]);
        // console.log(`normalized2D:`, normalized2D);
      }

      for (let j = 0; j < normalized2D.length; j += 2) {
        let x = normalized2D[j],
          y = normalized2D[j + 1];

        front.push(vertices3D.length / 3);
        vertices3D.push(x, y, 0);

        back.push(vertices3D.length / 3);
        vertices3D.push(x, y, depth);
      }

      //   console.log(`Processing contour ${i}, holes=`, holes);

      const indicesFront = earcut(normalized2D, holes);
      frontFaces.push(...indicesFront.map((idx) => front[idx]));

      const indicesBack = indicesFront.slice().reverse();
      backFaces.push(...indicesBack.map((idx) => back[idx]));

      // console.log(`frontFaces:`, frontFaces);

      for (let j = 0; j < front.length - 1; j++) {
        let next = j + 1;
        sideFaces.push(front[j], back[j], back[next]);
        sideFaces.push(front[j], back[next], front[next]);
      }
    }
  });

  return {
    vertices3D,
    sideFaces: [...frontFaces, ...backFaces, ...sideFaces],
  };
};

const initWebGPU = async () => {
  if (!navigator.gpu) {
    console.error(`WebGPU not supported!`);
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  device = await adapter.requestDevice();

  const canvas = document.querySelector(`canvas`);
  context = canvas.getContext(`webgpu`);

  context.configure({
    device,
    format: navigator.gpu.getPreferredCanvasFormat(),
  });

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

  vertexBuffer = device.createBuffer({
    size: 0,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  indexBuffer = device.createBuffer({
    size: 0,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_SDT,
  });

  if (!renderLoopActive) {
    renderLoopActive = true;
    requestAnimationFrame(renderFrame);
  }
};

// **🎨 更新 WebGPU 缓冲区**
const updateBuffers = () => {
  // **🔹 重新创建 vertexBuffer 以匹配数据大小**
  if (!vertexBuffer || vertexBuffer.size !== vertexData.byteLength) {
    if (vertexBuffer) vertexBuffer.destroy(); // **释放旧的缓冲区**
    vertexBuffer = device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  // **🔹 重新创建 indexBuffer 以匹配数据大小**
  if (!indexBuffer || indexBuffer.size !== indexData.byteLength) {
    if (indexBuffer) indexBuffer.destroy();
    indexBuffer = device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }

  // **🔹 写入新的数据**
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  device.queue.writeBuffer(indexBuffer, 0, indexData);
};

// **🎨 WebGPU 渲染帧**
const renderFrame = () => {
  if (!indexData || !vertexData) {
    console.warn(
      "indexData or vertexData is not initialized yet, skipping frame."
    );
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

  if (indexData.length > 0) {
    passEncoder.drawIndexed(indexData.length);
  } else {
    console.warn("Skipping drawIndexed() because indexData is empty.");
  }

  passEncoder.drawIndexed(indexData.length);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(renderFrame);
};

// **🔄 动态更新文本**
const renderText = async () => {
  let vertices3D = [];
  let sideFaces = [];

  const turnStr =
    turnNumber < 10
      ? [numberToWord[0], numberToWord[turnNumber]]
      : [
          numberToWord[Math.floor(turnNumber / 10)],
          numberToWord[turnNumber % 10],
        ];

  // prettier-ignore
  const word = [`t`, `u`, `r`, `n`, ...turnStr, `colon`, `space`, `P`, `l`, `a`, `y`, `e`, `r`, playerNumber == 1 ? `one` : `two`];

  for (let i = 0; i < word.length; i++) {
    const symbolID = `glyph-${word[i]}`;
    const d = await loadPathFromSVG(svgURL, symbolID);
    if (!d) continue;

    const vertices2D = parseSVGPath(d);
    const { vertices3D: letterVertices, sideFaces: letterFaces } =
      extrude2DTo3D(vertices2D, [0, 0, 1200, 1420], 0.2);

    let offsetX = i * spacing * scaleFactor;
    let vertexOffset = vertices3D.length / 3;

    for (let j = 0; j < letterVertices.length; j += 3) {
      vertices3D.push(letterVertices[j] * scaleFactor + offsetX);
      vertices3D.push(letterVertices[j + 1] * scaleFactor);
      vertices3D.push(letterVertices[j + 2] * scaleFactor);
    }

    sideFaces.push(...letterFaces.map((idx) => idx + vertexOffset));
  }

  if (vertices3D.length === 0 || sideFaces.length === 0) {
    console.warn("No valid 3D vertices or side faces were generated.");
    return;
  }

  vertexData = new Float32Array(vertices3D);
  indexData = new Uint32Array(sideFaces);

  updateBuffers();
};

const main = async () => {
  await initWebGPU();

  renderText();

  setInterval(() => {
    turnNumber = turnNumber >= 99 ? 1 : turnNumber + 1; // 01 → 99 → 01 循环
    playerNumber = playerNumber === 1 ? 2 : 1; // 1 → 2 → 1 交替
    renderText();
  }, 3000);
};

main();
