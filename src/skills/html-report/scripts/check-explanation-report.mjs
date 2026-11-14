#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

import { checkReportDiagrams } from "./check-report-diagrams.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.join(path.dirname(SCRIPT_DIR), "assets");
const SHELL_TEMPLATE = fs.readFileSync(path.join(ASSETS_DIR, "report-shell.html"), "utf8");
// Only the repository-owned bundle is evaluated, never JavaScript from the input report.
const prism = runInNewContext(
  `${SHELL_TEMPLATE.match(/<script id="report-prism">([\s\S]*?)<\/script>/)[1]}; Prism;`,
  {},
  { timeout: 1000 },
);
const CODE_LANGUAGES = new Set(Object.keys(prism.languages).filter((name) => typeof prism.languages[name] === "object"));
const QUIZ_TEMPLATE = fs.readFileSync(
  path.join(ASSETS_DIR, "explanation-quiz.html.template"),
  "utf8",
);
const QUIZ_SCRIPT_TEMPLATE = QUIZ_TEMPLATE.match(/<!-- BODY_SCRIPT 조각 -->\s*([\s\S]*)$/)?.[1].trim();
const QUIZ_STYLE_TEMPLATE = QUIZ_TEMPLATE.match(/<!-- BODY_STYLE 조각 -->\s*([\s\S]*?)\s*<!-- BODY 조각 -->/)?.[1].trim();
const MAX_REPORT_BYTES = 10 * 1024 * 1024;

// 표제 문구는 프로젝트 프로필이 소유하므로 `--kicker`로 받습니다. 주지 않으면 kicker가
// 하나이고 비어 있지 않은지만 확인합니다. 설명 유형은 근거와 설명 책임만 결정하므로
// 표제에는 드러내지 않습니다.
const REPORT_MODES = new Set(["change", "implementation", "knowledge"]);
const GENERIC_SECTION_LABELS = new Set([
  "변경 요약",
  "동작 흐름",
  "설계와 코드",
  "구현 개요",
  "질문과 맥락",
  "작동 원리",
  "예시와 적용",
  "이해 확인",
  "도입",
  "원인 추적",
  "해석과 해결",
  "적용 확인",
  "summary",
  "flow",
  "design",
  "quiz",
  "overview",
  "context",
  "principles",
  "application",
  "변경 전 사건과 달라진 결과",
  "실제 변경 전후 실행 경로",
  "설계 선택과 남은 경계",
  "새 상황 적용",
  "요청과 관찰할 결과",
  "입력부터 결과까지의 실행",
  "책임·실패 경계와 선택",
  "중심 논지 또는 상황의 기대와 결과",
  "참여자·상태와 작동 원리",
  "목적별 사용법·대안과 해결",
]);

const MARKERS = [
  "/* BODY_STYLE:start */",
  "/* BODY_STYLE:end */",
  "<!-- BODY:start -->",
  "<!-- BODY:end -->",
  "<!-- BODY_SCRIPT:start -->",
  "<!-- BODY_SCRIPT:end -->",
];

const MARKER_PAIRS = [
  [MARKERS[0], MARKERS[1], "BODY_STYLE"],
  [MARKERS[2], MARKERS[3], "BODY"],
  [MARKERS[4], MARKERS[5], "BODY_SCRIPT"],
];

function countOccurrences(value, token) {
  return value.split(token).length - 1;
}

const NAMED_CHARACTER_REFERENCES = {
  ApplyFunction: "\u2061",
  InvisibleComma: "\u2063",
  InvisibleTimes: "\u2062",
  MediumSpace: "\u205f",
  NegativeMediumSpace: "\u200b",
  NegativeThickSpace: "\u200b",
  NegativeThinSpace: "\u200b",
  NegativeVeryThinSpace: "\u200b",
  NewLine: "\n",
  NoBreak: "\u2060",
  NonBreakingSpace: "\u00a0",
  Tab: "\t",
  ThickSpace: "\u205f\u200a",
  ThinSpace: "\u2009",
  VeryThinSpace: "\u200a",
  ZeroWidthSpace: "\u200b",
  af: "\u2061",
  amp: "&",
  apos: "'",
  emsp13: "\u2004",
  emsp14: "\u2005",
  emsp: "\u2003",
  ensp: "\u2002",
  gt: ">",
  hairsp: "\u200a",
  ic: "\u2063",
  it: "\u2062",
  lt: "<",
  lrm: "\u200e",
  nbsp: "\u00a0",
  numsp: "\u2007",
  puncsp: "\u2008",
  quot: '"',
  rlm: "\u200f",
  shy: "\u00ad",
  thinsp: "\u2009",
  zwj: "\u200d",
  zwnj: "\u200c",
};

function decodeCharacterReferences(value) {
  return value.replace(
    /&(?:#([0-9]+)|#x([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]+));/g,
    (reference, decimal, hexadecimal, named) => {
      if (named) return Object.hasOwn(NAMED_CHARACTER_REFERENCES, named)
        ? NAMED_CHARACTER_REFERENCES[named]
        : reference;
      const codePoint = Number.parseInt(decimal ?? hexadecimal, decimal ? 10 : 16);
      if (codePoint === 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return "\ufffd";
      }
      return String.fromCodePoint(codePoint);
    },
  );
}

function extractVisibleText(value) {
  return value === undefined
    ? undefined
    : decodeCharacterReferences(value.replace(/<[^>]+>/g, ""))
      .replace(/[\u00ad\u034f\u061c\u200b-\u200f\u2060-\u2064\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim();
}

function parseReportMarkup(markup) {
  // Do not repair malformed HTML or execute report code when checking placement.
  const root = { tag: null, hidden: false, text: "", lastChild: null };
  const stack = [root];
  const nodes = [];
  const voidTags = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
  const inlineTags = new Set("a abbr b bdi bdo br cite code data del dfn em i ins kbd mark q ruby rp rt s samp small span strong sub sup time u var wbr".split(" "));
  let offset = 0;
  for (const token of markup.matchAll(/<\/?[a-z][a-z0-9:-]*(?:[^<>"']|"[^"]*"|'[^']*')*>|[^<]+/gi)) {
    if (token.index !== offset) return null;
    offset += token[0].length;
    const parent = stack.at(-1);
    if (!token[0].startsWith("<")) {
      if (extractVisibleText(token[0])) parent.lastChild = { tag: "#text" };
      if (!parent.hidden) parent.text += token[0];
      continue;
    }
    const [, closing, name, rawAttributes] = token[0].match(/^<(\/?)([\w:-]+)([\s\S]*?)>$/);
    const tag = name.toLowerCase();
    if (closing) {
      if (rawAttributes.trim() || stack.length === 1 || parent.tag !== tag) return null;
      parent.end = offset;
      stack.pop();
      stack.at(-1).text += parent.text;
      continue;
    }
    if (stack.some((node) => node.tag === "p") && !inlineTags.has(tag)) return null;
    const selfClosing = /\/\s*$/.test(rawAttributes);
    if (selfClosing && !voidTags.has(tag) && !stack.some((node) => node.tag === "svg")) return null;
    const attributes = new Map();
    const source = rawAttributes.replace(/\/\s*$/, "").trim();
    const pattern = /\s*([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gy;
    while (pattern.lastIndex < source.length) {
      if (pattern.lastIndex > 0 && !/\s/.test(source[pattern.lastIndex])) return null;
      const attribute = pattern.exec(source);
      if (!attribute) return null;
      const key = attribute[1].toLowerCase();
      if (attributes.has(key)) return null;
      attributes.set(key, decodeCharacterReferences(attribute[2] ?? attribute[3] ?? attribute[4] ?? ""));
    }
    const style = attributes.get("style") ?? "";
    const hidden = parent.hidden || attributes.has("hidden") || attributes.has("inert")
      || attributes.get("aria-hidden")?.toLowerCase() === "true"
      || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:\.0*)?)\s*(?:!important\s*)?(?:;|$)/i.test(style)
      || ["script", "style", "template", "noscript", "details"].includes(tag);
    const node = { tag, hidden, text: "", lastChild: null, attributes, parent, start: token.index, end: offset };
    nodes.push(node);
    parent.lastChild = node;
    if (voidTags.has(tag) || selfClosing) {
      if (tag === "br" && !hidden) parent.text += " ";
    } else {
      stack.push(node);
    }
  }
  return offset === markup.length && stack.length === 1 ? { root, nodes } : null;
}

function hasVisibleEndingParagraph(markup) {
  const root = parseReportMarkup(markup)?.root;
  const paragraph = root?.lastChild?.lastChild;
  return root?.lastChild?.tag === "section" && paragraph?.tag === "p"
    && !paragraph.hidden && Boolean(extractVisibleText(paragraph.text));
}

function validateReaderProvenance(value, label, errors, markup = false) {
  const decoded = decodeCharacterReferences(markup ? value.replace(/<!--[\s\S]*?-->/g, "") : value)
    .replace(/[\u200b-\u200f\u2060-\u2064\ufeff]/g, "");
  const withoutUrls = decoded.replace(/https?:\/\/[^\s<>"']+/g, "");
  const text = markup ? `${withoutUrls.replace(/<[^>]*>/g, " ")} ${withoutUrls}` : withoutUrls;
  if (/\b(?=[0-9a-f]{7,40}\b)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/i.test(decoded)
      || /\b(?:HEAD(?:~\d+)?|origin\/[\w/-]+)\.{2,3}[\w/~.-]+/.test(text)
      || /(?:\b(?:apps|src|lib|packages|scripts|docs)\/[^\s<>]+|\/(?:Users|home|var)\/[^\s<>]+|\b(?:[\w.-]+\/)+[\w.-]+\.(?:dart|tsx?|jsx?|mjs|md|lock|html|json|ya?ml)|\b[\w.-]+\.(?:dart|tsx?|jsx?|mjs|md|lock|html):\d+)/i.test(text)) {
    errors.push(`${label} must not expose commit hashes, Git ranges, or repository paths and line references`);
  }
}

function parseStringLiteral(value) {
  return JSON.parse(value);
}

function extractRegion(value, startMarker, endMarker, errors, label) {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker);
  if (start === -1 || end === -1) return null;
  if (end <= start) {
    errors.push(`${label} markers are out of order`);
    return null;
  }
  return value.slice(start + startMarker.length, end);
}

function replaceRegion(value, startMarker, endMarker, replacement) {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker);
  if (start === -1 || end <= start) return null;
  return `${value.slice(0, start + startMarker.length)}${replacement}${value.slice(end)}`;
}

function normalizeShell(value) {
  let normalized = value.replace(/<title>[\s\S]*?<\/title>/, "<title>__TITLE__</title>");
  normalized = normalized.replace(
    /<header class="head col">[\s\S]*?<\/header>/,
    '<header class="head col">__HEADER__</header>',
  );
  for (const [startMarker, endMarker, label] of MARKER_PAIRS) {
    normalized = replaceRegion(normalized, startMarker, endMarker, `\n__${label}__\n`);
    if (normalized === null) return null;
  }
  return normalized;
}

function findQuizDataRegion(value) {
  const declaration = /\bvar\s+quizData\s*=\s*\[/.exec(value);
  if (!declaration) return null;
  const openBracket = value.indexOf("[", declaration.index);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = openBracket; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "[") depth += 1;
    if (character !== "]") continue;
    depth -= 1;
    if (depth !== 0) continue;

    let end = index + 1;
    while (/\s/.test(value[end] ?? "")) end += 1;
    if (value[end] !== ";") return null;
    return {
      end: end + 1,
      source: value.slice(openBracket + 1, index),
      start: declaration.index,
    };
  }

  return null;
}

function normalizeQuizScript(value) {
  const region = findQuizDataRegion(value);
  if (!region) return null;
  return `${value.slice(0, region.start)}var quizData = __QUIZ_DATA__;${value.slice(region.end)}`.trim();
}

function validateDynamicMarkup(value, label, errors) {
  if (/<\s*(?:script|style|link|meta|iframe|object|embed|base|form|template)\b/i.test(value)) {
    errors.push(`${label} contains a disallowed active element`);
  }
  if (/\son[a-z]+\s*=/i.test(value)) errors.push(`${label} contains an inline event handler`);
  const parsed = parseReportMarkup(value.replace(/<!--[\s\S]*?-->/g, ""));
  if (!parsed) {
    errors.push(`${label} must use balanced tags and strictly separated attributes`);
    return;
  }
  const urlAttributes = new Set(["src", "srcset", "href", "poster", "action", "formaction", "data", "xlink:href", "ping"]);
  for (const node of parsed.nodes) {
    for (const [name, value] of node.attributes) {
      if (!urlAttributes.has(name)) continue;
      const attributeValue = value.trim();
      let sourceLink = false;
      if (node.tag === "a" && name === "href" && /^https?:\/\//i.test(attributeValue)) {
        try {
          const url = new URL(attributeValue);
          sourceLink = ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
        } catch {
          sourceLink = false;
        }
      }
      if ((!attributeValue.startsWith("#") && !sourceLink) || name === "ping") {
        errors.push(`${label} contains a disallowed URL attribute`);
      }
    }
  }
}

function extractHeadingTexts(value) {
  const headingTexts = new Set();
  const visibleValue = value.replace(/<!--[\s\S]*?-->/g, "");
  for (const match of visibleValue.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)) {
    headingTexts.add(match[1]);
  }
  for (const match of visibleValue.matchAll(
    /<[a-z][\w:-]*\b[^>]*class="[^"]*\bh[1-6]\b[^"]*"[^>]*>([\s\S]*?)<\/[a-z][\w:-]*>/gi,
  )) {
    headingTexts.add(match[1]);
  }
  for (const match of visibleValue.matchAll(
    /<p\b[^>]*class="[^"]*\blbl\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
  )) {
    headingTexts.add(match[1]);
  }
  return [...headingTexts].map((text) => extractVisibleText(text));
}

function decodePayload(value) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error("payload is not canonical base64");
  }

  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) {
    throw new Error("payload is not canonical base64");
  }

  return JSON.parse(decoded.toString("utf8"));
}

function parseQuizQuestions(source) {
  let index = 0;

  const fail = (message) => {
    throw new Error(`${message} at offset ${index}`);
  };
  const skipWhitespace = () => {
    while (/\s/.test(source[index] ?? "")) index += 1;
  };
  const expectCharacter = (character) => {
    skipWhitespace();
    if (source[index] !== character) fail(`expected ${character}`);
    index += 1;
  };
  const expectKey = (key) => {
    skipWhitespace();
    if (!source.startsWith(key, index) || /[A-Za-z0-9_$]/.test(source[index + key.length] ?? "")) {
      fail(`expected ${key}`);
    }
    index += key.length;
  };
  const readString = () => {
    skipWhitespace();
    if (source[index] !== '"') fail("expected a JSON string");
    const start = index;
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const character = source[index];
      index += 1;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === '"') return parseStringLiteral(source.slice(start, index));
    }
    fail("unterminated JSON string");
  };
  const readOption = () => {
    expectCharacter("{");
    expectKey("text");
    expectCharacter(":");
    const text = readString();
    expectCharacter(",");
    expectKey("payload");
    expectCharacter(":");
    const payload = readString();
    expectCharacter("}");
    return { payload, text };
  };
  const readOptions = () => {
    const options = [];
    expectCharacter("[");
    skipWhitespace();
    while (source[index] !== "]") {
      options.push(readOption());
      skipWhitespace();
      if (source[index] === "]") break;
      expectCharacter(",");
    }
    expectCharacter("]");
    return options;
  };
  const readQuestion = () => {
    expectCharacter("{");
    expectKey("id");
    expectCharacter(":");
    const id = readString();
    expectCharacter(",");
    expectKey("prompt");
    expectCharacter(":");
    const prompt = readString();
    expectCharacter(",");
    expectKey("options");
    expectCharacter(":");
    const options = readOptions();
    expectCharacter("}");
    return { id, options, prompt };
  };

  const questions = [];
  skipWhitespace();
  while (index < source.length) {
    questions.push(readQuestion());
    skipWhitespace();
    if (index >= source.length) break;
    expectCharacter(",");
    skipWhitespace();
  }
  return questions;
}

function extractQuizQuestions(script, errors) {
  const region = findQuizDataRegion(script);
  if (!region) {
    errors.push("quizData array is missing or malformed");
    return [];
  }
  if (/<\/script/i.test(region.source)) errors.push("quizData contains a script-closing sequence");
  if (region.source.includes("<")) errors.push("quizData must escape < as \\u003c");

  try {
    return parseQuizQuestions(region.source);
  } catch (error) {
    errors.push(`quizData contains unsupported syntax: ${error.message}`);
    return [];
  }
}

export function validateExplanationReport(html, mode, { kicker: expectedKicker } = {}) {
  const errors = [];
  if (!REPORT_MODES.has(mode)) return [`unsupported mode: ${mode}`];

  // 다이어그램 기하 검사는 별도 명령으로도 실행할 수 있지만, 아티클 checker가 산출물 전체를
  // 이미 받으므로 여기서 함께 돌려 작성자가 명령을 하나만 기억하게 합니다.
  errors.push(...checkReportDiagrams(html));

  for (const marker of MARKERS) {
    const count = countOccurrences(html, marker);
    if (count !== 1) errors.push(`${marker} must appear exactly once, found ${count}`);
  }

  const markerOffsets = MARKERS.map((marker) => html.indexOf(marker));
  if (markerOffsets.every((offset) => offset !== -1)) {
    for (let index = 1; index < markerOffsets.length; index += 1) {
      if (markerOffsets[index] <= markerOffsets[index - 1]) {
        errors.push("shell markers must appear in BODY_STYLE, BODY, BODY_SCRIPT order");
        break;
      }
    }
  }

  const externalResourcePattern = /(?:src|href)\s*=\s*["']\s*(?:https?:|\/\/)|url\(\s*["']?\s*(?:https?:|\/\/)|@import\s+(?:url\(\s*)?["']?\s*(?:https?:|\/\/)/gi;
  const withoutNavigation = html.replace(/<a\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gi,
    (tag) => tag.replace(/\shref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ""));
  if (externalResourcePattern.test(withoutNavigation)) errors.push("external resource reference is not allowed");

  const bodyStyle = extractRegion(html, MARKERS[0], MARKERS[1], errors, "BODY_STYLE");
  if (bodyStyle !== null) {
    if (bodyStyle.trim() !== QUIZ_STYLE_TEMPLATE) errors.push("BODY_STYLE must match the canonical quiz styles");
    if (bodyStyle.includes("<")) errors.push("BODY_STYLE must not contain HTML markup");
    if (/#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i.test(bodyStyle)) {
      errors.push("BODY_STYLE must not contain a hex color literal");
    }
    if (/:[^;}{]*\b(?:black|silver|gray|grey|white|maroon|red|purple|fuchsia|green|lime|olive|yellow|navy|blue|teal|aqua|orange|rebeccapurple)\b/i.test(bodyStyle)) {
      errors.push("BODY_STYLE must not contain a named color literal");
    }
    if (/\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\(/i.test(bodyStyle)) {
      errors.push("BODY_STYLE must not contain a color function literal");
    }
    for (const declaration of bodyStyle.matchAll(
      /\b(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left)(?:-color)?|-color)?|fill|stroke)\s*:\s*([^;}{]+)/gi,
    )) {
      const value = declaration[1];
      if (/var\s*\(/i.test(value) || /^(?:0|none|transparent|inherit|initial|unset|currentColor)$/i.test(value.trim())) {
        continue;
      }
      const words = value.match(/[a-z]+/gi) ?? [];
      const allowedWords = new Set(["solid", "dashed", "dotted", "double", "none", "currentcolor"]);
      if (words.some((word) => !allowedWords.has(word.toLowerCase()))) {
        errors.push(`BODY_STYLE color declaration must use a shell variable: ${declaration[0].trim()}`);
      }
    }
  }

  if (/{{[A-Z0-9_]+}}/.test(html)) errors.push("unresolved template placeholder found");

  for (const heading of extractHeadingTexts(html)) {
    if (/니까\?$/.test(heading)) {
      errors.push(`heading must not use the -니까? style: ${heading}`);
    }
  }

  const normalizedShell = normalizeShell(html);
  const normalizedTemplate = normalizeShell(SHELL_TEMPLATE);
  if (!normalizedShell || normalizedShell !== normalizedTemplate) {
    errors.push("content outside the header and BODY marker regions must match report-shell.html");
  }

  const body = extractRegion(html, MARKERS[2], MARKERS[3], errors, "BODY");
  const bodyScript = extractRegion(html, MARKERS[4], MARKERS[5], errors, "BODY_SCRIPT");
  const header = html.match(/<header class="head col">([\s\S]*?)<\/header>/)?.[1];
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  validateReaderProvenance(`${title ?? ""}\n${header ?? ""}\n${body ?? ""}`, "reader HTML", errors, true);
  if (body !== null) validateDynamicMarkup(body, "BODY", errors);
  if (header) {
    validateDynamicMarkup(header, "header", errors);
    const visibleHeader = header.replace(/<!--[\s\S]*?-->/g, "");
    const kickers = [...visibleHeader.matchAll(/<p\b[^>]*class="[^"]*\bkicker\b[^"]*"[^>]*>([\s\S]*?)<\/p>/g)];
    const headings = [...visibleHeader.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
    const actualKicker = extractVisibleText(kickers[0]?.[1]);
    if (expectedKicker !== undefined) {
      if (kickers.length !== 1 || actualKicker !== expectedKicker) {
        errors.push(`header kicker must be "${expectedKicker}", found "${actualKicker ?? "none"}"`);
      }
    } else if (kickers.length !== 1 || !actualKicker) {
      errors.push(`header must contain exactly one non-empty kicker, found "${actualKicker ?? "none"}"`);
    }
    if (headings.length !== 1 || !extractVisibleText(headings[0][1])) {
      errors.push("header must contain exactly one non-empty heading");
    }
    // 제목 아래 메타 행은 독자에게 조사 흔적만 남기므로 설명 아티클에서는 표제를 kicker와 H1로 끝냅니다.
    if (/<(?:dl|dt|dd)\b/i.test(visibleHeader) || /\sdata-meta\s*=/i.test(visibleHeader)) {
      errors.push("header must not contain a metadata list below the heading");
    }
    const headerRemainder = visibleHeader
      .replace(/<p\b[^>]*class="[^"]*\bkicker\b[^"]*"[^>]*>[\s\S]*?<\/p>/g, "")
      .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/g, "");
    if (extractVisibleText(headerRemainder)) {
      errors.push("header must contain only the kicker and the heading");
    }
  }

  if (bodyScript !== null) {
    const normalizedScript = normalizeQuizScript(bodyScript);
    const normalizedQuizTemplate = normalizeQuizScript(QUIZ_SCRIPT_TEMPLATE ?? "");
    if (!normalizedScript || normalizedScript !== normalizedQuizTemplate) {
      errors.push("BODY_SCRIPT must match the canonical quiz renderer except for quizData");
    }
  }

  if (body === null) return errors;
  const visibleBody = body.replace(/<!--[\s\S]*?-->/g, "");

  const article = visibleBody.match(/^\s*<div class="explanation">\s*<nav aria-label="목차">([\s\S]*?)<\/nav>([\s\S]*)<\/div>\s*$/);
  if (!article) {
    errors.push('BODY must contain one .explanation wrapper starting with <nav aria-label="목차">');
    return errors;
  }
  const sections = [...article[2].matchAll(/\s*<section\b([^>]*)>([\s\S]*?)<\/section>/g)];
  if (sections.map((section) => section[0]).join("").trim() !== article[2].trim()
      || sections.some((section) => /<\/?section\b/i.test(section[2]))) {
    errors.push("article sections must be flat siblings with no content outside them");
  }
  const attribute = (attributes, name) => attributes.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  const structure = sections.map((section) => attribute(section[1], "id") ?? "");
  const parts = sections.map((section) => attribute(section[1], "data-part"));
  const bodyCount = sections.length;
  if (bodyCount < 3 || bodyCount > 6) errors.push("article must contain 3 to 6 body sections");
  if (parts[0] !== "opening" || parts.at(-1) !== "ending"
      || parts.slice(1, -1).some((part) => part !== "development")) {
    errors.push("section roles must be opening, development (1 to 4), ending in order");
  }
  if (structure.some((id) => !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))
      || structure.some((id) => id === "quiz" || id.startsWith("quiz-"))) {
    errors.push("section ids must be content-specific kebab-case ids, not quiz ids");
  }
  const allIds = [];
  for (const tag of html.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<[a-z][^>]*>/gi)) {
    const ids = [...tag[0].matchAll(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)];
    if (ids.length > 1) errors.push("an element must not repeat its id attribute");
    allIds.push(...ids.map((match) => decodeCharacterReferences(match[1] ?? match[2] ?? match[3])));
  }
  if (new Set(allIds).size !== allIds.length) errors.push("HTML ids must be unique");

  const expectedSectionIds = structure;
  const tocMatches = [...article[1].matchAll(/<(ul|ol)\b[^>]*class="[^"]*\btoc\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/g)];
  if (tocMatches.length !== 1) errors.push("navigation must contain exactly one table of contents");
  const tocMatch = tocMatches[0];
  const tocItems = tocMatch ? [...tocMatch[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)] : [];
  if (tocMatch && (tocMatch[2].replace(/<li\b[^>]*>[\s\S]*?<\/li>/g, "").trim()
      || tocItems.some((item) => [...item[1].matchAll(/<a\b/g)].length !== 1))) {
    errors.push("table of contents must contain only list items with one link each");
  }
  const tocLinks = tocMatch
    ? [...tocMatch[2].matchAll(/<a\b[^>]*\bhref="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
      (match) => ({
        id: match[1],
        label: extractVisibleText(match[2]),
      }),
    )
    : [];
  const tocNumbers = tocItems.map((match) => {
    const number = match[1].match(
      /<span\b[^>]*class="[^"]*\bn\b[^"]*"[^>]*>([\s\S]*?)<\/span>/,
    )?.[1];
    return extractVisibleText(number) ?? "";
  });
  const expectedTocNumbers = expectedSectionIds.map((_, index) => String(index + 1).padStart(2, "0"));
  if (tocNumbers.join("|") !== expectedTocNumbers.join("|")) {
    errors.push(`table of contents numbers must be ${expectedTocNumbers.join(", ")} in order`);
  }
  const linkedSectionIds = tocLinks.map(({ id }) => id);
  if (linkedSectionIds.join("|") !== expectedSectionIds.join("|")) {
    errors.push(
      `table of contents must link ${expectedSectionIds.join(", ")} in order`,
    );
  }

  const sectionLabels = [];
  sections.forEach((match, index) => {
    const id = structure[index];
    const section = match[2];
    const labelMatch = section.match(/^\s*<h2 class="section-title">([\s\S]*?)<\/h2>/);
    const actualLabel = extractVisibleText(labelMatch?.[1]);
    if (!actualLabel) errors.push(`section ${id} must start with a non-empty content-specific h2.section-title`);
    else {
      const normalizedLabel = actualLabel.toLowerCase();
      const exposesGenericLabel = [...GENERIC_SECTION_LABELS].some((genericLabel) => (
        new RegExp(
          `^${genericLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[\\s\\p{P}\\p{S}])`,
          "u",
        ).test(normalizedLabel)
      ));
      if (exposesGenericLabel || /^\p{N}+(?:$|[\s\p{P}\p{S}])/u.test(actualLabel)) {
        errors.push(`section ${id} must not expose an internal label or number: "${actualLabel}"`);
      }
    }
    sectionLabels.push(actualLabel ?? "");
  });

  if (new Set(sectionLabels).size !== sectionLabels.length) {
    errors.push("content section labels must be unique");
  }
  const tocLabels = tocLinks.map(({ label }) => label);
  if (tocLabels.join("|") !== sectionLabels.join("|")) {
    errors.push("table-of-contents labels must match their content section labels");
  }
  if (/<a\b[^>]*\bhref=["']#quiz(?:-[^"']*)?["']/i.test(article[1])) {
    errors.push("navigation must not link to quizzes");
  }

  if (!hasVisibleEndingParagraph(sections.at(-1)?.[0] ?? "")) {
    errors.push("ending must finish with a visible prose paragraph, not a TL;DR or folded detail");
  }
  let summaryCount = 0;
  sections.forEach((section, index) => {
    const summaries = [...section[2].matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)]
      .filter((match) => extractVisibleText(match[1]) === "TL;DR");
    summaryCount += summaries.length;
    const foldedSummary = /<details>\s*<summary>TL;DR<\/summary>/.test(section[2]);
    if ((summaries.length > 0 && (index !== 0 || !foldedSummary))
        || extractHeadingTexts(section[2]).includes("TL;DR")) {
      errors.push("optional TL;DR must be a folded details summary in the opening, never the ending");
    }
  });
  if (summaryCount > 1) errors.push("optional TL;DR must appear at most once");

  const canonicalQuizBody = QUIZ_TEMPLATE.match(/<!-- BODY 조각 -->\s*([\s\S]*?)\s*<!-- BODY_SCRIPT 조각 -->/)?.[1];
  const questions = bodyScript === null ? [] : extractQuizQuestions(bodyScript, errors);
  if (questions.length < 3 || questions.length > 5) {
    errors.push(`quiz must contain 3 to 5 questions, found ${questions.length}`);
  }
  const parsedBody = parseReportMarkup(visibleBody);
  if (!parsedBody) errors.push("BODY must have balanced tags for quiz placement");
  for (const node of parsedBody?.nodes ?? []) {
    if (node.tag !== "code" || node.parent.tag !== "pre") continue;
    const languages = (node.attributes.get("class") ?? "").split(/\s+/).filter((name) => name.startsWith("language-"));
    if (languages.length !== 1 || !CODE_LANGUAGES.has(languages[0].slice("language-".length))) {
      errors.push(`code block must declare one supported source language, found ${languages.join(", ") || "none"}; add the official grammar to the shell instead of silently using plain`);
    }
  }
  const mounts = parsedBody?.nodes.filter((node) => node.attributes.has("data-question")
    || node.attributes.get("class")?.split(/\s+/).includes("quiz")
    || node.attributes.get("id")?.startsWith("quiz-")) ?? [];
  const questionIds = questions.map((question) => question.id);
  const mountIds = mounts.map((mount) => mount.attributes.get("data-question"));
  if (questionIds.some((id) => !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id))
      || new Set(questionIds).size !== questionIds.length) errors.push("quizData ids must be unique kebab-case ids");
  if (new Set(mountIds).size !== mountIds.length
      || mountIds.length !== questionIds.length
      || mountIds.some((id) => !questionIds.includes(id))) errors.push("quiz mounts and quizData ids must match one-to-one");
  for (const mount of mounts) {
    const id = mount.attributes.get("data-question");
    if (mount.hidden || mount.parent.tag !== "section" || mount.parent.attributes.get("data-part") !== "development") {
      errors.push(`quiz ${id} must be a visible direct child of a development section`);
    }
    if (visibleBody.slice(mount.start, mount.end).trim() !== canonicalQuizBody?.replaceAll("{{QUESTION_ID}}", id)) {
      errors.push(`quiz ${id} must match the canonical quiz mount including noscript`);
    }
  }
  for (const node of parsedBody?.nodes ?? []) {
    if (node.tag !== "a") continue;
    let ancestor = node.parent;
    while (ancestor && ancestor.tag !== "nav") ancestor = ancestor.parent;
    if (ancestor && !structure.some((id) => node.attributes.get("href") === `#${id}`)) {
      errors.push("navigation may link only to body sections, never quiz mounts");
    }
  }

  const correctPositions = [];
  questions.forEach((question, questionIndex) => {
    const number = questionIndex + 1;
    if (!question.prompt.trim()) errors.push(`question ${number} prompt must not be empty`);
    validateReaderProvenance(question.prompt, `question ${number}`, errors);
    if (question.options.length < 3 || question.options.length > 4) {
      errors.push(`question ${number} must contain 3 to 4 options, found ${question.options.length}`);
    }

    const decodedOptions = [];
    question.options.forEach((option, optionIndex) => {
      if (!option.text.trim()) errors.push(`question ${number} option text must not be empty`);
      validateReaderProvenance(option.text, `question ${number} option`, errors);
      try {
        const result = decodePayload(option.payload);
        const keys = Object.keys(result).sort();
        if (keys.join("|") !== "correct|feedback") {
          errors.push(`question ${number} option ${optionIndex + 1} payload must contain only correct and feedback`);
        }
        if (typeof result.correct !== "boolean" || typeof result.feedback !== "string" || !result.feedback.trim()) {
          errors.push(`question ${number} option ${optionIndex + 1} payload has invalid result values`);
        }
        if (typeof result.feedback === "string") validateReaderProvenance(result.feedback, `question ${number} feedback`, errors);
        decodedOptions.push({ ...option, ...result });
      } catch (error) {
        errors.push(`question ${number} option ${optionIndex + 1}: ${error.message}`);
      }
    });

    if (decodedOptions.length !== question.options.length) return;

    const correctOptions = decodedOptions
      .map((option, index) => ({ option, index }))
      .filter(({ option }) => option.correct);
    if (correctOptions.length !== 1) {
      errors.push(`question ${number} must have exactly one correct option, found ${correctOptions.length}`);
      return;
    }
    correctPositions.push(correctOptions[0].index);

    const lengths = decodedOptions.map((option) => Array.from(option.text).length);
    const longest = Math.max(...lengths);
    const shortest = Math.min(...lengths);
    if (longest - shortest > 25) {
      errors.push(`question ${number} option length difference must be at most 25, found ${longest - shortest}`);
    }

    const correctLength = lengths[correctOptions[0].index];
    if (correctLength === longest && lengths.filter((length) => length === longest).length === 1) {
      errors.push(`question ${number} correct option must not be the only longest option`);
    }
  });

  if (correctPositions.length > 1 && new Set(correctPositions).size === 1) {
    errors.push("correct payload positions must vary across questions");
  }

  return errors;
}

export function parseArgs(args) {
  let mode;
  let kicker;
  let filePath;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--mode") {
      if (!args[index + 1]) throw new Error("--mode requires a value");
      mode = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length);
      continue;
    }
    if (arg === "--kicker") {
      if (!args[index + 1]) throw new Error("--kicker requires a value");
      kicker = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith("--kicker=")) {
      kicker = arg.slice("--kicker=".length);
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`unknown argument: ${arg}`);
    if (filePath) throw new Error("only one report file may be provided");
    filePath = arg;
  }

  if (help) return { help };
  if (!mode) throw new Error("--mode is required");
  if (!REPORT_MODES.has(mode)) throw new Error(`unsupported mode: ${mode}`);
  if (kicker !== undefined && !kicker.trim()) throw new Error("--kicker must not be empty");
  if (!filePath) throw new Error("report file is required");
  return { filePath, help, kicker, mode };
}

function printHelp() {
  console.log(`Usage: node "${fileURLToPath(import.meta.url)}" --mode <change|implementation|knowledge> [--kicker <text>] <file>

Checks a generated explanation report without executing its JavaScript.
Templates are read from the directory above this script or its assets/ sibling (report-shell.html,
explanation-quiz.html.template). --kicker is the header phrase the project
profile defines; without it only presence of a single kicker is checked.
`);
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error("Run with --help for usage.");
    process.exit(2);
  }

  if (options.help) {
    printHelp();
    return;
  }

  const reportPath = path.resolve(options.filePath);
  let report;
  try {
    const stats = fs.statSync(reportPath);
    if (!stats.isFile()) throw new Error("path is not a regular file");
    if (stats.size > MAX_REPORT_BYTES) {
      throw new Error(`file exceeds ${MAX_REPORT_BYTES} bytes`);
    }
    report = fs.readFileSync(reportPath, "utf8");
  } catch (error) {
    console.error(`cannot read report file ${options.filePath}: ${error.message}`);
    process.exit(2);
  }

  const errors = validateExplanationReport(report, options.mode, { kicker: options.kicker });
  if (errors.length > 0) {
    console.error("Explanation report check failed:\n");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Explanation report check passed (${options.mode}, ${options.filePath}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
