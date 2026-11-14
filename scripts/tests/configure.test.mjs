import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { configure, mergeConfig, renderConfig } from "../configure.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hook = (command) => ({ type: "command", command, timeout: 5 });
const config = (command) => ({ hooks: { PostToolUse: [{ matcher: "Edit", hooks: [hook(command)] }] } });
function fixture(t, desired = config("managed")) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "harness-configure-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const home = path.join(base, "home");
  const dir = path.join(base, "adapter");
  fs.mkdirSync(home); fs.mkdirSync(dir);
  const source = path.join(dir, "settings.json");
  fs.writeFileSync(source, JSON.stringify(desired));
  const adapter = { name: "claude", dir, targets: { settings: "~/.claude/settings.json" }, configure: { source: "settings.json", target: "settings", state: "~/.local/state/harness/claude-settings.json" } };
  const target = path.join(home, ".claude/settings.json");
  const state = path.join(home, ".local/state/harness/claude-settings.json");
  const apply = (options = {}) => configure({ adapter, home, apply: true, ...options });
  const writeCurrent = (value) => { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, JSON.stringify(value)); };
  return { base, home, source, adapter, target, state, apply, writeCurrent };
}

test("preserves foreign settings and hooks sharing the same matcher", () => {
  const current = { ...config("plugin"), theme: "dark", permissions: { allow: ["Read"] } };
  const desired = config("managed");
  const first = mergeConfig(current, desired);
  assert.deepEqual(first.value, { ...current, hooks: { PostToolUse: [{ matcher: "Edit", hooks: [hook("plugin"), hook("managed")] }] } });
  assert.deepEqual(first.conflicts, []);
  assert.deepEqual(mergeConfig(first.value, desired, desired).value, first.value);
});

test("updates and removes only previously managed scalar settings and nested leaves", () => {
  const result = mergeConfig({ model: "old", permissions: { ask: ["Bash"], allow: ["Read"] } }, { model: "new" }, { model: "old", permissions: { ask: ["Bash"] } });
  assert.deepEqual(result.value, { model: "new", permissions: { allow: ["Read"] } });
  assert.deepEqual(result.conflicts, []);
});

test("releases removed fields changed by the app and rejects overwriting independent fields", () => {
  assert.deepEqual(mergeConfig({ theme: "app" }, {}, { theme: "old" }).value, { theme: "app" });
  assert.deepEqual(mergeConfig({ model: "app" }, { model: "wanted" }, { model: "old" }).conflicts, ["model"]);
  assert.deepEqual(mergeConfig({ model: "app" }, { model: "wanted" }).conflicts, ["model"]);
});

test("removing owned hooks preserves other hooks and events", () => {
  const current = { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [hook("managed"), hook("plugin")] }], Stop: [{ hooks: [hook("notify")] }] } };
  assert.deepEqual(mergeConfig(current, {}, config("managed")).value, { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [hook("plugin")] }], Stop: [{ hooks: [hook("notify")] }] } });
});

test("dry-run makes no directories; first apply backs up and subsequent apply is a no-op", (t) => {
  const f = fixture(t);
  const plan = configure({ adapter: f.adapter, home: f.home });
  assert.equal(plan.applied, false);
  assert.deepEqual(fs.readdirSync(f.home), []);
  const first = f.apply();
  assert.equal(first.applied, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.target)), config("managed"));
  assert.equal(JSON.parse(fs.readFileSync(path.join(first.backup, "before.json"))).settings.kind, "missing");
  assert.equal(fs.statSync(f.target).mode & 0o777, 0o600);
  const second = f.apply();
  assert.equal(second.applied, false);
  assert.deepEqual(second.changes, []);
  assert.equal(second.stateUpdate, false);
});

test("adopting a symlink preserves its source, backs up its identity, and creates a local file", (t) => {
  const f = fixture(t);
  const original = path.join(f.base, "old settings.json");
  fs.writeFileSync(original, '{"theme":"dark"}\n');
  fs.mkdirSync(path.dirname(f.target)); fs.symlinkSync(original, f.target);
  assert.throws(() => f.apply(), /symlink found/);
  assert.equal(fs.existsSync(f.state), false);
  const plan = f.apply({ adoptSymlink: true });
  assert.equal(fs.lstatSync(f.target).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(original, "utf8"), '{"theme":"dark"}\n');
  assert.equal(JSON.parse(fs.readFileSync(f.target)).theme, "dark");
  assert.equal(JSON.parse(fs.readFileSync(path.join(plan.backup, "before.json"))).settings.link, original);
});

test("invalid JSON, hook groups and symlink parents are refused before writing", (t) => {
  const f = fixture(t);
  f.writeCurrent({ hooks: { PostToolUse: "invalid" } });
  assert.throws(() => f.apply(), /expected an array/);
  assert.equal(fs.existsSync(f.state), false);
  fs.writeFileSync(f.target, "not json");
  assert.throws(() => f.apply(), SyntaxError);
  assert.equal(fs.readFileSync(f.target, "utf8"), "not json");
  fs.rmSync(path.dirname(f.target), { recursive: true });
  fs.symlinkSync(f.adapter.dir, path.dirname(f.target));
  assert.throws(() => f.apply(), /parent must be a real directory/);
});

test("conflicting settings are reported without changing the file or writing state", (t) => {
  const f = fixture(t, { model: "wanted" });
  f.writeCurrent({ model: "mine" });
  const before = fs.readFileSync(f.target, "utf8");
  assert.throws(() => f.apply(), /conflicting settings: model/);
  assert.equal(fs.readFileSync(f.target, "utf8"), before);
  assert.equal(fs.existsSync(f.state), false);
});

test("a changed source updates owned hooks without changing foreign commands", (t) => {
  const f = fixture(t);
  f.writeCurrent(config("plugin")); f.apply();
  fs.writeFileSync(f.source, JSON.stringify(config("managed-v2")));
  f.apply();
  assert.deepEqual(JSON.parse(fs.readFileSync(f.target)), { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [hook("plugin"), hook("managed-v2")] }] } });
});

test("unsafe object keys and invalid state are rejected", (t) => {
  assert.throws(() => mergeConfig({}, JSON.parse('{"__proto__":{"polluted":true}}')), /unsupported key/);
  const f = fixture(t); f.apply();
  fs.writeFileSync(f.state, '{"version":2}');
  assert.throws(() => f.apply(), /invalid configuration state/);
});

test("hook paths are shell-quoted for a relocated checkout containing spaces and quotes", (t) => {
  const f = fixture(t);
  const harnessRoot = path.join(f.base, "harness with 'quote'");
  fs.mkdirSync(path.join(harnessRoot, "src/hooks"), { recursive: true });
  fs.writeFileSync(path.join(harnessRoot, "src/hooks/skill-distribution-guard.mjs"), 'console.log("relocated-hook");');
  const rendered = renderConfig('{"command":"{{skillDistributionGuard}}"}', harnessRoot);
  assert.equal(execFileSync("/bin/sh", ["-c", rendered.command], { encoding: "utf8" }).trim(), "relocated-hook");
});

test("configuration CLI defaults to dry-run and rejects unknown runtime and options", (t) => {
  const f = fixture(t);
  const cli = path.join(root, "scripts/configure.mjs");
  const plans = execFileSync(process.execPath, [cli, "--home", f.home], { encoding: "utf8" }).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(plans.map((plan) => plan.runtime).sort(), ["claude", "codex"]);
  assert.deepEqual(plans.map((plan) => plan.applied), [false, false]);
  assert.deepEqual(fs.readdirSync(f.home), []);
  assert.throws(() => execFileSync(process.execPath, [cli, "--home", f.home, "--runtime", "missing"], { stdio: "pipe" }), /no configuration adapter/);
  assert.throws(() => execFileSync(process.execPath, [cli, "--unknown"], { stdio: "pipe" }), /unknown option/);
});

test("a state write failure restores the previous settings", (t) => {
  const f = fixture(t); f.writeCurrent({ theme: "dark" });
  const before = fs.readFileSync(f.target, "utf8");
  const rename = fs.renameSync;
  t.mock.method(fs, "renameSync", (from, to) => {
    if (to === f.state) throw new Error("simulated state write failure");
    return rename(from, to);
  });
  assert.throws(() => f.apply(), /simulated state write failure/);
  assert.equal(fs.readFileSync(f.target, "utf8"), before);
  assert.equal(fs.existsSync(f.state), false);
  assert.equal(fs.existsSync(f.state + ".lock"), false);
});

test("all requested runtimes are validated before the CLI changes settings", (t) => {
  const f = fixture(t);
  assert.throws(() => execFileSync(process.execPath, [path.join(root, "scripts/configure.mjs"), "--home", f.home, "--runtime", "claude,missing", "--apply"], { stdio: "pipe" }), /no configuration adapter/);
  assert.deepEqual(fs.readdirSync(f.home), []);
});

test("project bootstrap omits globally configured hooks", (t) => {
  const f = fixture(t);
  execFileSync(process.execPath, [path.join(root, "scripts/init-project.mjs"), f.home], { stdio: "pipe" });
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(path.join(f.home, ".claude/settings.json"))), "hooks"), false);
  assert.equal(fs.existsSync(path.join(f.home, ".codex/hooks.json")), false);
});

test("claiming an existing hook does not reorder foreign commands on subsequent applies", () => {
  const current = { hooks: { PostToolUse: [{ matcher: "Edit", hooks: [hook("managed"), hook("plugin")] }] } };
  const desired = config("managed");
  assert.deepEqual(mergeConfig(current, desired).value, current);
  const repeated = mergeConfig(current, desired, desired);
  assert.deepEqual(repeated.value, current);
  assert.deepEqual(repeated.changes, []);
});

test("a null ownership record is rejected without rewriting settings", (t) => {
  const f = fixture(t); f.apply();
  const before = fs.readFileSync(f.target, "utf8");
  fs.writeFileSync(f.state, "null");
  assert.throws(() => f.apply(), /invalid configuration state/);
  assert.equal(fs.readFileSync(f.target, "utf8"), before);
  assert.equal(fs.readFileSync(f.state, "utf8"), "null");
});

test("configure can be imported from a stdin module without running the CLI", (t) => {
  const f = fixture(t);
  const cli = path.join(root, "scripts/configure.mjs");
  const code = `await import(${JSON.stringify(pathToFileURL(cli).href)}); console.log('imported');`;
  const output = execFileSync(process.execPath, ["--input-type=module", "-"], { input: code, encoding: "utf8", env: { ...process.env, HOME: f.home } });
  assert.equal(output.trim(), "imported");
  assert.deepEqual(fs.readdirSync(f.home), []);
});

for (const [label, change] of [
  ["timeout", (value) => { value.hooks.PostToolUse[0].hooks[0].timeout = 10; }],
  ["command", (value) => { value.hooks.PostToolUse[0].hooks[0].command = "locally-edited"; }],
  ["matcher", (value) => { value.hooks.PostToolUse[0].matcher = "Write"; }],
  ["deletion", (value) => { delete value.hooks.PostToolUse; }],
]) {
  test(`reports a locally changed managed hook (${label}) without adding another hook`, () => {
    const previous = config("managed");
    const current = structuredClone(previous); change(current);
    const result = mergeConfig(current, previous, previous);
    assert.deepEqual(result.conflicts, ["hooks.PostToolUse[0].hooks[0]"]);
    assert.deepEqual(result.value, current);
    assert.deepEqual(result.changes, []);
  });
}

test("first adoption rejects an existing invocation with different hook options", () => {
  const current = config("managed"); current.hooks.PostToolUse[0].hooks[0].timeout = 10;
  const result = mergeConfig(current, config("managed"));
  assert.deepEqual(result.conflicts, ["hooks.PostToolUse[0].hooks[0]"]);
  assert.deepEqual(result.value, current);
});

test("source hook option updates replace the previous owned command", () => {
  const previous = config("managed");
  const desired = config("managed"); desired.hooks.PostToolUse[0].hooks[0].timeout = 10;
  const result = mergeConfig(previous, desired, previous);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.value, desired);
});

test("a local hook already matching the new source is accepted", () => {
  const previous = config("managed");
  const desired = config("managed"); desired.hooks.PostToolUse[0].hooks[0].timeout = 10;
  const result = mergeConfig(desired, desired, previous);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.value, desired);
  assert.deepEqual(result.changes, []);
});

test("changing the source command does not bypass a local managed hook change", () => {
  const previous = config("old-checkout/managed");
  const current = structuredClone(previous); current.hooks.PostToolUse[0].hooks[0].timeout = 10;
  const result = mergeConfig(current, config("new-checkout/managed"), previous);
  assert.deepEqual(result.conflicts, ["hooks.PostToolUse[0].hooks[0]"]);
  assert.deepEqual(result.value, current);
});

test("removing a managed declaration releases a locally modified hook", () => {
  const previous = config("managed");
  const current = structuredClone(previous); current.hooks.PostToolUse[0].hooks[0].timeout = 10;
  const result = mergeConfig(current, {}, previous);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.value, current);
});

test("a managed hook conflict leaves settings, ownership state and backups untouched", (t) => {
  const f = fixture(t); const first = f.apply();
  const current = JSON.parse(fs.readFileSync(f.target));
  current.hooks.PostToolUse[0].hooks[0].timeout = 10; f.writeCurrent(current);
  const settingsBefore = fs.readFileSync(f.target, "utf8");
  const stateBefore = fs.readFileSync(f.state, "utf8");
  const backupsBefore = fs.readdirSync(path.dirname(first.backup));
  assert.throws(() => f.apply(), /conflicting settings: hooks\.PostToolUse\[0\]\.hooks\[0\]/);
  assert.equal(fs.readFileSync(f.target, "utf8"), settingsBefore);
  assert.equal(fs.readFileSync(f.state, "utf8"), stateBefore);
  assert.deepEqual(fs.readdirSync(path.dirname(first.backup)), backupsBefore);
});

test("a deliberately changed local command is accepted once the source matches it", () => {
  const previous = config("old-command");
  const current = config("approved-new-command");
  const result = mergeConfig(current, current, previous);
  assert.deepEqual(result.conflicts, []);
  assert.deepEqual(result.value, current);
  assert.deepEqual(result.changes, []);
});
