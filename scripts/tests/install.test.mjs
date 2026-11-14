import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("a relocated checkout installs independently without dotfiles or a HOME/harness directory", (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "harness-independent-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const checkout = path.join(base, "checkout with 'quotes'");
  const home = path.join(base, "home");
  fs.mkdirSync(checkout); fs.mkdirSync(home);
  for (const rel of ["AGENTS.md", "harness.json", "skills-lock.json", "src", "scripts", "dist", ".agents"]) {
    fs.cpSync(path.join(root, rel), path.join(checkout, rel), { recursive: true, verbatimSymlinks: true });
  }
  const run = (file, args = []) => {
    const result = spawnSync(process.execPath, [path.join(checkout, "scripts", file), ...args], { cwd: checkout, env: { ...process.env, HOME: home }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout;
  };
  run("build.mjs");
  run("check.mjs");
  run("link.mjs", ["--profile", "common,writing", "--runtime", "claude,codex", "--apply"]);
  run("configure.mjs", ["--runtime", "claude,codex", "--apply"]);
  assert.equal(fs.existsSync(path.join(home, "dotfiles")), false);
  assert.equal(fs.existsSync(path.join(home, "harness")), false);
  assert.equal(fs.realpathSync(path.join(home, ".claude/CLAUDE.md")), path.join(fs.realpathSync(checkout), "AGENTS.md"));
  assert.equal(fs.realpathSync(path.join(home, ".agents/skills/explain")), path.join(fs.realpathSync(checkout), "dist/skills/explain"));
  for (const rel of [".claude/settings.json", ".codex/hooks.json"]) {
    const file = path.join(home, rel);
    assert.equal(fs.lstatSync(file).isSymbolicLink(), false);
    const settings = JSON.parse(fs.readFileSync(file));
    const command = settings.hooks.PostToolUse[0].hooks[0].command;
    const result = spawnSync("/bin/sh", ["-c", command], { cwd: home, env: { ...process.env, HOME: home }, input: JSON.stringify({ tool_name: "Edit", tool_input: { file_path: "dist/skills/example/SKILL.md" } }), encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /src\/packages\//);
  }
  const original = fs.readFileSync(path.join(checkout, "src/adapters/claude/settings.json"), "utf8");
  const local = path.join(home, ".claude/settings.json");
  const changed = JSON.parse(fs.readFileSync(local)); changed.theme = "local-theme";
  fs.writeFileSync(local, JSON.stringify(changed));
  const repeated = run("configure.mjs", ["--runtime", "claude,codex", "--apply"]).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(repeated.map((p) => p.applied), [false, false]);
  assert.equal(JSON.parse(fs.readFileSync(local)).theme, "local-theme");
  assert.equal(fs.readFileSync(path.join(checkout, "src/adapters/claude/settings.json"), "utf8"), original);
  assert.equal(fs.existsSync(path.join(home, ".codex/config.toml")), false);
  run("link.mjs", ["--profile", "common,writing", "--runtime", "claude,codex", "--apply"]);
});
