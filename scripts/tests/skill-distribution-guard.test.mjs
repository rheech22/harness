import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { renderConfig } from "../configure.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hook = path.join(root, "src/hooks/skill-distribution-guard.mjs");
function run(payload) {
  const result = spawnSync(process.execPath, [hook], { input: payload, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
function edit(file_path) {
  return JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path } });
}
function warning(output) {
  const result = JSON.parse(output).hookSpecificOutput;
  assert.equal(result.hookEventName, "PostToolUse");
  assert.match(result.additionalContext, /src\/packages\//);
  assert.match(result.additionalContext, /scripts\/check\.mjs/);
}

for (const file of ["dist/skills/a/SKILL.md", "/repo/dist/packages/a/file.py", ".agents/skills/a/SKILL.md", "/home/u/.claude/skills/a/SKILL.md", "./src/../dist/test.md", "C:\\repo\\dist\\test.md"]) {
  test(`warns for generated path ${file}`, () => warning(run(edit(file))));
}
for (const file of ["src/docs/common/a.md", "src/skills/a/skill.json", "src/packages/a/a.py", "distribution/a.md", "src/distinct/a.md", ".agents/skills-other/a.md"]) {
  test(`does not warn for ${file}`, () => assert.equal(run(edit(file)), ""));
}
for (const field of ["command", "patch", "input", "raw"]) {
  test(`reads apply_patch ${field} input and move destination`, () => {
    const patch = "*** Begin Patch\n*** Update File: src/a.md\n*** Move to: dist/a.md\n*** End Patch";
    const tool_input = field === "raw" ? patch : { [field]: patch };
    warning(run(JSON.stringify({ tool_name: "apply_patch", tool_input })));
  });
}
for (const action of ["Add File", "Update File", "Delete File"]) {
  test(`reads patch ${action} with CRLF`, () => {
    warning(run(JSON.stringify({ tool_name: "apply_patch", tool_input: { input: `*** ${action}: dist/a.md\r\n` } })));
  });
}
for (const payload of ["invalid json", "null", "{}", '{"tool_name":"apply_patch","tool_input":{"command":[]}}']) {
  test(`ignores malformed or irrelevant input: ${payload}`, () => assert.equal(run(payload), ""));
}

test("both adapters execute the shared script from an isolated HOME", (t) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "harness-hook-home-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  fs.symlinkSync(root, path.join(home, "harness"));
  for (const file of ["src/adapters/codex/hooks.json", "src/adapters/claude/settings.json"]) {
    const config = renderConfig(fs.readFileSync(path.join(root, file), "utf8"));
    const command = config.hooks.PostToolUse[0].hooks[0].command;
    const result = spawnSync("/bin/sh", ["-c", command], { env: { ...process.env, HOME: home }, input: edit("dist/a.md"), encoding: "utf8", cwd: home });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    warning(result.stdout);
  }
});
