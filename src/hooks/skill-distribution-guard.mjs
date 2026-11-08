// 두 런타임 공용 hook 스크립트. 생성된 skill 배포를 직접 수정하면 안내를 주입한다.
// Claude: settings.json PostToolUse(Write|Edit)   Codex: hooks.json PostToolUse(apply_patch)
import fs from "node:fs";
let payload; try { payload = JSON.parse(fs.readFileSync(0, "utf8")); } catch { process.exit(0); }
const touched = [];
if (payload.tool_name === "apply_patch") {
  const patch = payload.tool_input?.command ?? "";
  touched.push(...[...patch.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)].map((m) => m[1]));
} else if (payload.tool_input?.file_path) touched.push(payload.tool_input.file_path);
const guarded = ["/dist/", ".agents/skills/", ".claude/skills/"];
if (touched.some((p) => guarded.some((g) => p.includes(g)))) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: payload.hook_event_name, additionalContext:
    "하네스: 생성된 skill 배포를 직접 수정했습니다. docs/를 고치고 `node scripts/build.mjs`로 다시 생성한 뒤 `node scripts/check.mjs`로 검증하세요." } }));
}
