// 파일 편집이 끝난 뒤 생성물 직접 수정을 감지해 원본 편집 경로를 안내한다.
import fs from "node:fs";
import path from "node:path";

let payload;
try { payload = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
if (!payload || typeof payload !== "object") process.exit(0);

const input = payload.tool_input;
const touched = [];
if (payload.tool_name === "apply_patch") {
  const patch = typeof input === "string" ? input : input?.patch ?? input?.input ?? input?.command;
  if (typeof patch === "string") {
    touched.push(...[...patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)\r?$/gm)].map((m) => m[1].trim()));
  }
} else if (typeof input?.file_path === "string") {
  touched.push(input.file_path);
}

const guarded = /(?:^|\/)(?:dist(?:\/|$)|\.(?:agents|claude)\/skills(?:\/|$))/;
if (touched.some((p) => guarded.test(path.posix.normalize(p.replaceAll("\\", "/"))))) {
  console.log(JSON.stringify({ hookSpecificOutput: {
    hookEventName: payload.hook_event_name ?? "PostToolUse",
    additionalContext: "하네스: 생성된 배포물을 직접 수정했습니다. 하네스 원본(src/docs/, src/skills/, src/packages/)을 수정하고 `node scripts/build.mjs`와 `node scripts/check.mjs`를 실행하세요. dist/packages/는 새 버전으로 export하고, 발행된 스냅샷은 직접 수정하지 마세요.",
  } }));
}
