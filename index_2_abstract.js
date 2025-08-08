"use strict";
import svgPathParser from "https://cdn.jsdelivr.net/npm/svg-path-parser@latest/+esm";
import earcut from "https://cdn.jsdelivr.net/npm/earcut@latest/+esm";

// 全局状态（仅用于生成数据）
let turnNumber = 1;
let playerNumber = 1;

const svgURL = `./output_fonts/CascadiaCodeNF_symbol.svg`;
const spacing = 1.6;      // 设定字符间距（等宽字体）
const scaleFactor = 0.05; // 缩放比例

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

// 加载指定 symbol 的 SVG 路径数据
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

// 解析 SVG 路径字符串，生成二维轮廓数据
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
      case "M": // 移动到（绝对）
        if (currentContour.length > 0) contours.push(currentContour);
        currentContour = [cmd.x, cmd.y];
        currentX = cmd.x;
        currentY = cmd.y;
        startX = cmd.x;
        startY = cmd.y;
        break;
      case "L": // 直线（绝对）
        currentX = cmd.x;
        currentY = cmd.y;
        currentContour.push(currentX, currentY);
        break;
      case "l": // 直线（相对）
        currentX += cmd.x;
        currentY += cmd.y;
        currentContour.push(currentX, currentY);
        break;
      case "Q": // 二次贝塞尔曲线（绝对）
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
      case "q": // 二次贝塞尔曲线（相对）
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
      case "Z": // 闭合路径
        currentContour.push(startX, startY);
        contours.push(currentContour);
        currentContour = [];
        currentX = startX;
        currentY = startY;
        break;
    }
  });

  if (currentContour.length > 0) contours.push(currentContour);
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
  let verticesList = [], holesList = [];
  let startIndex = 0;
  allContours.forEach((contour) => {
    let area = getPolygonArea(contour);
    if (area > 0) {
      holesList.push(startIndex);
    } else {
      holesList.push(null);
    }
    verticesList.push([...contour]);
    startIndex += contour.length / 2;
  });
  return { verticesList, holesList };
};

const normalizeVertices = (vertices2D, viewBox, targetSize = 2.0) => {
  const [minX, minY, width, height] = viewBox;
  return vertices2D.map((v, i) =>
    i % 2 === 0
      ? ((v - minX) / width) * targetSize - 1
      : ((v - minY) / height) * targetSize - 1
  );
};

const extrude2DTo3D = (allContours, viewBox, depth = 0.2) => {
  let vertices3D = [], sideFaces = [], frontFaces = [], backFaces = [];
  const { verticesList, holesList } = detectHoles(allContours);

  verticesList.forEach((vertices, i) => {
    if (holesList[i] != null) {
      // 跳过孔洞部分
    } else {
      let normalized2D = normalizeVertices(vertices, viewBox),
        holes = null,
        front = [],
        back = [];
      if (holesList[i + 1] != null) {
        holes = holesList[i + 1];
        normalized2D.push(...verticesList[i + 1]);
      }
      for (let j = 0; j < normalized2D.length; j += 2) {
        let x = normalized2D[j],
          y = normalized2D[j + 1];
        front.push(vertices3D.length / 3);
        vertices3D.push(x, y, 0);
        back.push(vertices3D.length / 3);
        vertices3D.push(x, y, depth);
      }
      const indicesFront = earcut(normalized2D, holes);
      frontFaces.push(...indicesFront.map((idx) => front[idx]));
      const indicesBack = indicesFront.slice().reverse();
      backFaces.push(...indicesBack.map((idx) => back[idx]));
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

/**
 * 计算文本几何数据，并返回 vertexData 与 indexData（typed arrays）
 */
export async function computeTextData() {
  let vertices3D = [];
  let sideFaces = [];

  const turnStr =
    turnNumber < 10
      ? [numberToWord[0], numberToWord[turnNumber]]
      : [
          numberToWord[Math.floor(turnNumber / 10)],
          numberToWord[turnNumber % 10],
        ];

  // 组成待绘制的文本（turn + colon + space + Player）
  const word = [
    `t`,
    `u`,
    `r`,
    `n`,
    ...turnStr,
    `colon`,
    `space`,
    `P`,
    `l`,
    `a`,
    `y`,
    `e`,
    `r`,
    playerNumber === 1 ? `one` : `two`,
  ];

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
    console.warn("没有生成有效的 3D 顶点或面数据");
    return null;
  }

  // 返回生成的顶点数据和索引数据
  const vertexData = new Float32Array(vertices3D);
  const indexData = new Uint32Array(sideFaces);
  return { vertexData, indexData };
}

/* 可选：如果需要外部控制 turnNumber/playerNumber，可提供 setter 接口 */
export function setTurnAndPlayer(turn, player) {
  turnNumber = turn;
  playerNumber = player;
}
