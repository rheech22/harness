#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// report-diagrams.md(리포트 SVG 다이어그램 컨벤션)의 라벨 폭 추정 표와 같은 값입니다. 한쪽만 바꾸면
// 작성자와 검사기가 서로 다른 기준으로 판단하게 됩니다.
const FONT_SIZES = { "viz-label": 12, "viz-meta": 10, "viz-edge-label": 10, "viz-boundary-label": 10 };
const WIDE_RATIO = 1;
const NARROW_RATIO = 0.6;
const NODE_PADDING = 16;
const MIN_VIEWBOX_MARGIN = 10;
const MAX_DEAD_SPACE_RATIO = 0.3;
const LABEL_CLEARANCE = 4;
// 기준선 위아래로 글자가 차지하는 비율입니다. 고정폭 글꼴의 ascender와 descender에 맞춥니다.
const ASCENT_RATIO = 0.8;
const DESCENT_RATIO = 0.25;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ENTITIES = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&amp;": "&" };

function decodeText(value) {
  return value.replace(/&(?:lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity]);
}

function isWideCharacter(character) {
  const code = character.codePointAt(0);
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

export function estimateTextWidth(text, fontSize) {
  let units = 0;
  for (const character of text) units += isWideCharacter(character) ? WIDE_RATIO : NARROW_RATIO;
  return units * fontSize;
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(
    `\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`,
    "i",
  ));
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function classList(tag) {
  return (attribute(tag, "class") ?? "").trim().split(/\s+/).filter(Boolean);
}

// marker 안의 도형은 0에서 10 사이 좌표를 쓰므로 본문과 섞으면 bounding box가 망가집니다.
// 주석 안의 도형은 그려지지 않으므로 템플릿의 변형 주석을 실제 노드로 세지 않아야 합니다.
function stripNonDrawn(svg) {
  return svg.replace(/<defs\b[\s\S]*?<\/defs>/g, "").replace(/<!--[\s\S]*?-->/g, "");
}

// 템플릿의 {{PLACEHOLDER}}는 최종 라벨이 아니므로 폭과 겹침 판단에서 제외합니다.
function isPlaceholder(text) {
  return /^\{\{[A-Z0-9_]+\}\}$/.test(text);
}

// 템플릿이 쓰는 M/L/H/V/Z만 절대 좌표로 해석합니다. 다른 command를 만나면 그 지점에서 멈추고
// 지금까지 모은 점만 돌려줍니다. 곡선을 직선으로 오해해 겹침을 잘못 보고하지 않기 위해서입니다.
export function parsePathPoints(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const points = [];
  let command = "";
  let index = 0;
  let complete = true;
  let startsWithMove = false;
  let lastCommand = "";
  let x = 0;
  let y = 0;

  const takeNumber = () => Number(tokens[index++]);

  while (index < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[index])) {
      command = tokens[index++];
      lastCommand = command;
      if (index === 1) startsWithMove = command === "M" || command === "m";
      if (!"MLHVZmlhvz".includes(command)) {
        complete = false;
        break;
      }
      if (command === "Z" || command === "z") {
        continue;
      }
    }
    if (command === "M" || command === "L") {
      x = takeNumber();
      y = takeNumber();
    } else if (command === "m" || command === "l") {
      x += takeNumber();
      y += takeNumber();
    } else if (command === "H") {
      x = takeNumber();
    } else if (command === "h") {
      x += takeNumber();
    } else if (command === "V") {
      y = takeNumber();
    } else if (command === "v") {
      y += takeNumber();
    } else {
      complete = false;
      break;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      complete = false;
      break;
    }
    points.push({ x, y });
  }

  return { points, complete, startsWithMove, closed: lastCommand === "Z" || lastCommand === "z" };
}

function boundsOfPoints(points) {
  return {
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

function rectangleBounds(rectangle) {
  return {
    left: rectangle.x,
    right: rectangle.x + rectangle.width,
    top: rectangle.y,
    bottom: rectangle.y + rectangle.height,
  };
}

function boundsOverlap(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const other = polygon[previous];
    const crosses = current.y > point.y !== other.y > point.y;
    if (!crosses) continue;
    const boundaryX =
      current.x + ((point.y - current.y) / (other.y - current.y)) * (other.x - current.x);
    if (point.x < boundaryX) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(a, b, c, d) {
  const orientation = (p, q, r) => Math.sign((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));
  const onSegment = (p, q, r) =>
    Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);

  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

function boundsCorners(bounds) {
  return [
    { x: bounds.left, y: bounds.top },
    { x: bounds.right, y: bounds.top },
    { x: bounds.right, y: bounds.bottom },
    { x: bounds.left, y: bounds.bottom },
  ];
}

// 사각형과 다각형이 실제로 만나는지 봅니다. 다이어그램의 마름모는 bounding box가 실제 면보다
// 훨씬 넓어서 box끼리만 비교하면 비어 있는 모서리 공간을 겹침으로 잘못 보고합니다.
function boundsIntersectPolygon(bounds, polygon) {
  if (polygon.some((point) => pointInPolygon(point, boundsCorners(bounds)))) return true;
  if (boundsCorners(bounds).some((corner) => pointInPolygon(corner, polygon))) return true;

  const rectangleEdges = boundsCorners(bounds);
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    for (let corner = 0; corner < rectangleEdges.length; corner += 1) {
      const from = rectangleEdges[corner];
      const to = rectangleEdges[(corner + 1) % rectangleEdges.length];
      if (segmentsIntersect(start, end, from, to)) return true;
    }
  }
  return false;
}

function boundsIntersectSegment(bounds, start, end) {
  if (
    (start.x >= bounds.left && start.x <= bounds.right && start.y >= bounds.top && start.y <= bounds.bottom) ||
    (end.x >= bounds.left && end.x <= bounds.right && end.y >= bounds.top && end.y <= bounds.bottom)
  ) {
    return true;
  }
  const corners = boundsCorners(bounds);
  for (let index = 0; index < corners.length; index += 1) {
    if (segmentsIntersect(start, end, corners[index], corners[(index + 1) % corners.length])) return true;
  }
  return false;
}

function textBounds(element) {
  const width = estimateTextWidth(element.text, element.fontSize);
  const anchor = element.textAnchor;
  const left = anchor === "middle" ? element.x - width / 2 : anchor === "end" ? element.x - width : element.x;
  return {
    left,
    right: left + width,
    top: element.y - element.fontSize * ASCENT_RATIO,
    bottom: element.y + element.fontSize * DESCENT_RATIO,
  };
}

function padBounds(bounds, padding) {
  return {
    left: bounds.left - padding,
    right: bounds.right + padding,
    top: bounds.top - padding,
    bottom: bounds.bottom + padding,
  };
}

function collectSvgElements(svgBody) {
  const rectangles = [];
  const polygons = [];
  const edges = [];
  const texts = [];

  for (const match of svgBody.matchAll(/<rect\b[^>]*>/g)) {
    const classes = classList(match[0]);
    rectangles.push({
      classes,
      x: Number(attribute(match[0], "x")),
      y: Number(attribute(match[0], "y")),
      width: Number(attribute(match[0], "width")),
      height: Number(attribute(match[0], "height")),
    });
  }

  for (const match of svgBody.matchAll(/<path\b[^>]*>/g)) {
    const classes = classList(match[0]);
    const d = attribute(match[0], "d") ?? "";
    const parsed = parsePathPoints(d);
    if (classes.includes("viz-node")) polygons.push({ classes, ...parsed });
    else if (classes.includes("viz-edge")) edges.push({ classes, ...parsed });
  }

  for (const match of svgBody.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const tag = `<text${match[1]}>`;
    const classes = classList(tag);
    const styled = classes.find((name) => name in FONT_SIZES);
    if (!styled) continue;
    const text = decodeText(match[2].replace(/<[^>]+>/g, "")).trim();
    if (!text) continue;
    texts.push({
      classes,
      text,
      placeholder: isPlaceholder(text),
      fontSize: FONT_SIZES[styled],
      x: Number(attribute(tag, "x")),
      y: Number(attribute(tag, "y")),
      textAnchor: attribute(tag, "text-anchor") ?? "start",
    });
  }

  return { rectangles, polygons, edges, texts };
}

function containerFor(element, rectangles, polygons) {
  const anchor = { x: element.x, y: element.y };
  const polygon = polygons.find((candidate) => pointInPolygon(anchor, candidate.points));
  if (polygon) return { bounds: boundsOfPoints(polygon.points), kind: "판단 노드" };

  const nodes = rectangles.filter((rectangle) => rectangle.classes.includes("viz-node"));
  const rectangle = nodes.find((candidate) => {
    const bounds = rectangleBounds(candidate);
    return anchor.x >= bounds.left && anchor.x <= bounds.right && anchor.y >= bounds.top && anchor.y <= bounds.bottom;
  });
  return rectangle ? { bounds: rectangleBounds(rectangle), kind: "노드" } : null;
}

function checkSvg(svg, label, errors) {
  const openTag = svg.match(/^<svg\b[^>]*>/)?.[0] ?? "";
  const body = stripNonDrawn(svg);
  const viewBox = (attribute(openTag, "viewBox") ?? "").trim().split(/\s+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))) {
    errors.push(`${label}: viewBox를 읽을 수 없습니다`);
    return;
  }
  const [viewX, viewY, viewWidth, viewHeight] = viewBox;
  if (viewWidth <= 0 || viewHeight <= 0) {
    errors.push(`${label}: viewBox의 너비와 높이는 양수여야 합니다`);
    return;
  }
  const { rectangles, polygons, edges, texts } = collectSvgElements(body);

  const invalidRectangle = rectangles.some(({ x, y, width, height }) =>
    ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0);
  const invalidText = texts.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y));
  if (invalidRectangle || invalidText) {
    errors.push(`${label}: SVG 좌표와 크기는 유한한 수이고 너비와 높이는 양수여야 합니다`);
    return;
  }
  if (polygons.some(({ complete, startsWithMove, closed, points }) =>
    !complete || !startsWithMove || !closed || points.length < 3)) {
    errors.push(`${label}: node path는 지원하는 명령으로 닫힌 도형을 완성해야 합니다`);
    return;
  }
  if (edges.some(({ complete, startsWithMove, points }) => !complete || !startsWithMove || points.length < 2)) {
    errors.push(`${label}: edge path는 지원하는 명령으로 두 점 이상을 연결해야 합니다`);
    return;
  }

  if (rectangles.length === 0 && polygons.length === 0) {
    errors.push(`${label}: 노드가 없습니다`);
    return;
  }

  for (const element of texts) {
    if (element.placeholder) continue;
    if (!element.classes.includes("viz-label") && !element.classes.includes("viz-meta")) continue;
    const container = containerFor(element, rectangles, polygons);
    if (!container) continue;
    const usable = container.bounds.right - container.bounds.left - NODE_PADDING;
    const width = estimateTextWidth(element.text, element.fontSize);
    if (width > usable) {
      errors.push(
        `${label}: "${element.text}"의 추정 폭 ${width.toFixed(1)}이 ${container.kind}의 사용 가능 폭 ${usable.toFixed(1)}을 넘습니다`,
      );
    }
  }

  for (const element of texts) {
    if (element.placeholder) continue;
    if (!element.classes.includes("viz-edge-label") && !element.classes.includes("viz-boundary-label")) continue;
    const bounds = padBounds(textBounds(element), LABEL_CLEARANCE);

    for (const rectangle of rectangles) {
      if (!rectangle.classes.includes("viz-node")) continue;
      if (boundsOverlap(bounds, rectangleBounds(rectangle))) {
        errors.push(`${label}: 연결선 라벨 "${element.text}"이 노드와 겹칩니다`);
        break;
      }
    }

    for (const polygon of polygons) {
      if (boundsIntersectPolygon(bounds, polygon.points)) {
        errors.push(`${label}: 연결선 라벨 "${element.text}"이 판단 노드와 겹칩니다`);
        break;
      }
    }

    let hitEdge = false;
    for (const edge of edges) {
      if (!edge.complete) continue;
      for (let index = 0; index + 1 < edge.points.length && !hitEdge; index += 1) {
        if (boundsIntersectSegment(bounds, edge.points[index], edge.points[index + 1])) hitEdge = true;
      }
      if (hitEdge) break;
    }
    if (hitEdge) errors.push(`${label}: 연결선 라벨 "${element.text}"이 연결선과 겹칩니다`);
  }

  const drawn = [
    ...rectangles.map(rectangleBounds),
    ...polygons.map((polygon) => boundsOfPoints(polygon.points)),
    ...edges.map((edge) => boundsOfPoints(edge.points)),
    ...texts.filter((element) => !element.placeholder).map((element) => textBounds(element)),
  ];
  const content = {
    left: Math.min(...drawn.map((bounds) => bounds.left)),
    right: Math.max(...drawn.map((bounds) => bounds.right)),
    top: Math.min(...drawn.map((bounds) => bounds.top)),
    bottom: Math.max(...drawn.map((bounds) => bounds.bottom)),
  };

  const margins = {
    왼쪽: content.left - viewX,
    오른쪽: viewX + viewWidth - content.right,
    위: content.top - viewY,
    아래: viewY + viewHeight - content.bottom,
  };
  for (const [side, margin] of Object.entries(margins)) {
    if (margin < MIN_VIEWBOX_MARGIN) {
      errors.push(`${label}: ${side} 여백이 ${margin.toFixed(1)}로 ${MIN_VIEWBOX_MARGIN} 미만입니다`);
    }
  }

  const deadHorizontal = (margins.왼쪽 + margins.오른쪽) / viewWidth;
  const deadVertical = (margins.위 + margins.아래) / viewHeight;
  if (deadHorizontal > MAX_DEAD_SPACE_RATIO) {
    errors.push(`${label}: 가로 죽은 공간이 ${(deadHorizontal * 100).toFixed(0)}%입니다. viewBox 너비를 줄입니다`);
  }
  if (deadVertical > MAX_DEAD_SPACE_RATIO) {
    errors.push(`${label}: 세로 죽은 공간이 ${(deadVertical * 100).toFixed(0)}%입니다. viewBox 높이를 줄입니다`);
  }
}

export function checkReportDiagrams(html) {
  const errors = [];
  const figures = [...html.matchAll(/(<figure\b[^>]*>)([\s\S]*?)<\/figure>/g)]
    .filter((match) => classList(match[1]).includes("viz"));

  const allIds = [...html.matchAll(/<[a-z][^>]*>/gi)]
    .map((match) => attribute(match[0], "id"))
    .filter(Boolean);
  const documentIds = new Set(allIds);
  const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
  for (const id of [...new Set(duplicateIds)]) errors.push(`id "${id}"가 페이지 안에서 중복됩니다`);

  figures.forEach((figure, figureIndex) => {
    const body = figure[2];
    const caption = body.match(/(<figcaption\b[^>]*>)([\s\S]*?)<\/figcaption>/);
    const captionId = caption ? attribute(caption[1], "id") : undefined;
    const name = caption ? decodeText(caption[2].replace(/<[^>]+>/g, "")).trim() : `다이어그램 ${figureIndex + 1}`;
    const svgs = [...body.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0]);

    const desktop = svgs.filter((svg) => classList(svg.match(/^<svg\b[^>]*>/)[0]).includes("viz-desktop"));
    const mobile = svgs.filter((svg) => classList(svg.match(/^<svg\b[^>]*>/)[0]).includes("viz-mobile"));
    if (desktop.length !== 1 || mobile.length !== 1) {
      errors.push(
        `${name}: viz-desktop과 viz-mobile이 하나씩 있어야 합니다. desktop=${desktop.length} mobile=${mobile.length}`,
      );
    }

    for (const svg of svgs) {
      const openTag = svg.match(/^<svg\b[^>]*>/)[0];
      const variant = classList(openTag).includes("viz-mobile") ? "mobile" : "desktop";
      const label = `${name} (${variant})`;

      const labelledBy = (attribute(openTag, "aria-labelledby") ?? "").trim().split(/\s+/).filter(Boolean);
      for (const id of labelledBy) {
        if (!documentIds.has(id)) errors.push(`${label}: aria-labelledby가 없는 id "${id}"를 가리킵니다`);
      }
      const titleTag = svg.match(/<title\b[^>]*>/)?.[0];
      const descTag = svg.match(/<desc\b[^>]*>/)?.[0];
      if (!titleTag || !descTag) {
        errors.push(`${label}: title과 desc가 모두 있어야 합니다`);
      } else {
        const requiredIds = [captionId, attribute(titleTag, "id"), attribute(descTag, "id")];
        if (requiredIds.some((id) => !id) || requiredIds.some((id) => !labelledBy.includes(id))) {
          errors.push(`${label}: aria-labelledby는 현재 figure의 figcaption, title, desc id를 모두 가리켜야 합니다`);
        }
      }

      checkSvg(svg, label, errors);
    }
  });

  return errors;
}

function printHelp() {
  console.log(`Usage: node "${fileURLToPath(import.meta.url)}" <file>

Checks the inline SVG diagrams in a generated report without a browser.
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  if (args.length !== 1) {
    console.error("exactly one report file is required");
    console.error("Run with --help for usage.");
    process.exit(2);
  }

  const reportPath = path.resolve(args[0]);
  let report;
  try {
    const stats = fs.statSync(reportPath);
    if (!stats.isFile()) throw new Error("path is not a regular file");
    if (stats.size > MAX_FILE_BYTES) throw new Error(`file exceeds ${MAX_FILE_BYTES} bytes`);
    report = fs.readFileSync(reportPath, "utf8");
  } catch (error) {
    console.error(`cannot read report file ${args[0]}: ${error.message}`);
    process.exit(2);
  }

  const errors = checkReportDiagrams(report);
  if (errors.length > 0) {
    console.error("Report diagram check failed:\n");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Report diagram check passed (${args[0]}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
