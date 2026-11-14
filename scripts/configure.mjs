// 사용자 설정은 원본에 링크하지 않고 선언한 항목만 적용한다.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual as equal } from "node:util";
import { isMain } from "./build.mjs";
import { root, loadAdapters } from "./link.mjs";

const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (obj, key) => Object.hasOwn(obj, key);
const clone = (v) => structuredClone(v);
const shellQuote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";

export function renderConfig(text, harnessRoot = root) {
  return JSON.parse(text.replaceAll("{{skillDistributionGuard}}", JSON.stringify(`node ${shellQuote(path.join(harnessRoot, "src/hooks/skill-distribution-guard.mjs"))}`).slice(1, -1)));
}

function validateConfig(value, label) {
  if (!object(value)) throw new Error(`${label}: expected a JSON object`);
  if (own(value, "hooks")) {
    if (!object(value.hooks)) throw new Error(`${label}.hooks: expected an object`);
    for (const [event, groups] of Object.entries(value.hooks)) {
      if (!Array.isArray(groups)) throw new Error(`${label}.hooks.${event}: expected an array`);
      for (const group of groups) {
        if (!object(group) || !Array.isArray(group.hooks) || !group.hooks.every(object)) throw new Error(`${label}.hooks.${event}: invalid hook group`);
      }
    }
  }
  for (const key of Object.keys(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error(`${label}: unsupported key ${key}`);
    if (object(value[key])) validateConfigKeys(value[key], label);
  }
}
function validateConfigKeys(value, label) {
  for (const [key, item] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error(`${label}: unsupported key ${key}`);
    if (object(item)) validateConfigKeys(item, label);
    if (Array.isArray(item)) for (const entry of item) if (object(entry)) validateConfigKeys(entry, label);
  }
}

function hookEntries(value, event) {
  return (value.hooks?.[event] ?? []).flatMap(({ hooks, ...metadata }, groupIndex) =>
    hooks.map((hook, hookIndex) => ({ metadata, hook, location: `hooks.${event}[${groupIndex}].hooks[${hookIndex}]` })));
}
const sameEntry = (a, b) => equal(a.metadata, b.metadata) && equal(a.hook, b.hook);
const sameInvocation = (a, b) => typeof a.command === "string" && typeof b.command === "string"
  ? a.type === b.type && a.command === b.command : equal(a, b);

// 일반 설정은 leaf별로, 같은 matcher에 속한 훅도 command별로 소유한다.
export function mergeConfig(current, desired, previous = {}) {
  for (const [label, value] of [["current", current], ["desired", desired], ["previous", previous]]) validateConfig(value, label);
  const result = clone(current);
  const changes = [];
  const conflicts = [];
  function merge(target, wanted, old, prefix = "") {
    for (const key of new Set([...Object.keys(wanted), ...Object.keys(old)])) {
      if (!prefix && key === "hooks") continue;
      const location = prefix ? `${prefix}.${key}` : key;
      if (object(wanted[key]) && (!own(target, key) || object(target[key])) && (!own(old, key) || object(old[key]))) {
        const child = clone(target[key] ?? {});
        merge(child, wanted[key], old[key] ?? {}, location);
        if (Object.keys(child).length) target[key] = child;
        else if (own(target, key) && object(target[key]) && Object.keys(target[key]).length) delete target[key];
      } else if (!own(wanted, key)) {
        if (object(old[key]) && object(target[key])) {
          merge(target[key], {}, old[key], location);
          if (!Object.keys(target[key]).length) delete target[key];
        } else if (own(target, key) && equal(target[key], old[key])) {
          delete target[key]; changes.push(`remove ${location}`);
        }
      } else if (!equal(target[key], wanted[key]) || !own(target, key)) {
        if (own(target, key) && (!own(old, key) || !equal(target[key], old[key]))) conflicts.push(location);
        else { target[key] = clone(wanted[key]); changes.push(`set ${location}`); }
      }
    }
  }
  merge(result, desired, previous);
  for (const event of new Set([...Object.keys(previous.hooks ?? {}), ...Object.keys(desired.hooks ?? {})])) {
    const oldEntries = hookEntries(previous, event);
    const wantedEntries = hookEntries(desired, event);
    const localEntries = hookEntries(current, event);
    const additions = wantedEntries.filter((wanted) => !oldEntries.some((old) => sameEntry(old, wanted)));
    for (const old of oldEntries) {
      if (localEntries.some((local) => sameEntry(local, old))) continue;
      const replacements = wantedEntries.filter((wanted) => sameInvocation(wanted.hook, old.hook));
      if (replacements.some((wanted) => localEntries.some((local) => sameEntry(local, wanted)))) continue;
      if (!replacements.length && additions.length && additions.every((wanted) => localEntries.some((local) => sameEntry(local, wanted)))) continue;
      // 명령 자체가 바뀐 경우에는 어느 훅의 후속인지 추측해 추가하지 않는다.
      if (replacements.length || additions.length) conflicts.push(old.location);
    }
    for (const wanted of wantedEntries) {
      const overlap = localEntries.some((local) => equal(local.metadata, wanted.metadata)
        && sameInvocation(local.hook, wanted.hook) && !sameEntry(local, wanted)
        && !oldEntries.some((old) => sameEntry(old, local)));
      if (overlap) conflicts.push(wanted.location);
    }
  }
  if (conflicts.length) return { value: clone(current), changes: [], conflicts: [...new Set(conflicts)] };
  const hooks = clone(result.hooks ?? {});
  for (const [event, groups] of Object.entries(previous.hooks ?? {})) {
    for (const { hooks: ownedHooks, ...metadata } of groups) {
      const removed = ownedHooks.filter((ownedHook) => !(desired.hooks?.[event] ?? []).some(({ hooks: wantedHooks, ...wantedMetadata }) =>
        equal(metadata, wantedMetadata) && wantedHooks.some((wantedHook) => equal(ownedHook, wantedHook))));
      for (const group of hooks[event] ?? []) {
        const { hooks: commands, ...currentMetadata } = group;
        if (equal(metadata, currentMetadata)) group.hooks = commands.filter((h) => !removed.some((ownedHook) => equal(h, ownedHook)));
      }
    }
    if (hooks[event]) {
      hooks[event] = hooks[event].filter((g) => g.hooks.length);
      if (!hooks[event].length) delete hooks[event];
    }
  }
  for (const [event, groups] of Object.entries(desired.hooks ?? {})) {
    hooks[event] ??= [];
    for (const { hooks: commands, ...metadata } of groups) {
      let group = hooks[event].find(({ hooks: _, ...candidate }) => equal(candidate, metadata));
      if (!group) { group = { ...clone(metadata), hooks: [] }; hooks[event].push(group); }
      for (const command of commands) if (!group.hooks.some((candidate) => equal(candidate, command))) group.hooks.push(clone(command));
    }
  }
  if (!equal(current.hooks ?? {}, hooks)) changes.push("update hooks (preserve unmanaged commands)");
  if (Object.keys(hooks).length) result.hooks = hooks;
  else if (own(previous, "hooks")) delete result.hooks;
  return { value: result, changes, conflicts };
}

function readObject(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT" && !fs.lstatSync(file, { throwIfNoEntry: false })) return fallback; throw error; }
}
function snapshot(file) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (!stat) return { kind: "missing" };
  if (stat.isSymbolicLink()) return { kind: "symlink", link: fs.readlinkSync(file), content: fs.readFileSync(file, "utf8") };
  if (!stat.isFile()) throw new Error(`${file}: expected a regular file or symlink`);
  return { kind: "file", content: fs.readFileSync(file, "utf8"), mode: stat.mode & 0o777 };
}
function checkParents(file, home) {
  for (let dir = path.dirname(file); dir !== path.dirname(home); dir = path.dirname(dir)) {
    const stat = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) throw new Error(`${dir}: settings parent must be a real directory`);
    if (dir === home) break;
  }
}
function atomicWrite(file, content, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try { fs.writeFileSync(tmp, content, { mode, flag: "wx" }); fs.renameSync(tmp, file); }
  finally { fs.rmSync(tmp, { force: true }); }
}
function restore(file, original) {
  if (original.kind === "missing") fs.rmSync(file, { force: true });
  else if (original.kind === "file") atomicWrite(file, original.content, original.mode);
  else {
    const tmp = `${file}.${randomUUID()}.tmp`;
    try { fs.symlinkSync(original.link, tmp); fs.renameSync(tmp, file); }
    finally { fs.rmSync(tmp, { force: true }); }
  }
}

export function configure({ adapter, home, apply = false, adoptSymlink = false, harnessRoot = root }) {
  const spec = adapter.configure;
  const expand = (value) => {
    if (!value?.startsWith("~/")) throw new Error(`${adapter.name}: configuration paths must be HOME-relative`);
    const resolved = path.resolve(home, value.slice(2));
    if (!resolved.startsWith(home + path.sep)) throw new Error(`${adapter.name}: configuration path escapes HOME`);
    return resolved;
  };
  const target = expand(adapter.targets[spec.target]);
  const stateFile = expand(spec.state);
  checkParents(target, home); checkParents(stateFile, home);
  const before = snapshot(target);
  if (before.kind === "symlink" && !adoptSymlink) throw new Error(`${target}: symlink found; review --adopt-symlink to replace the link while preserving its target`);
  const stateBefore = snapshot(stateFile);
  if (stateBefore.kind === "symlink") throw new Error(`${stateFile}: state must not be a symlink`);
  const state = readObject(stateFile, null);
  if (stateBefore.kind !== "missing" && (!object(state) || state.version !== 1 || state.target !== target || !object(state.managed))) throw new Error(`${stateFile}: invalid configuration state`);
  const desired = renderConfig(fs.readFileSync(path.join(adapter.dir, spec.source), "utf8"), harnessRoot);
  const current = before.kind === "missing" ? {} : JSON.parse(before.content);
  const merged = mergeConfig(current, desired, state?.managed ?? {});
  if (merged.conflicts.length) throw new Error(`${adapter.name}: conflicting settings: ${merged.conflicts.join(", ")}; preserve or resolve them before applying`);
  const writeSettings = before.kind !== "file" || !equal(current, merged.value);
  const nextState = { version: 1, target, managed: desired };
  const writeState = !equal(state, nextState);
  const changes = [...merged.changes, ...(before.kind === "symlink" ? ["replace settings symlink with local file"] : [])];
  if (before.kind === "missing") changes.unshift("create local settings file");
  const plan = { runtime: adapter.name, target, changes, stateUpdate: writeState, applied: false };
  if (!apply || (!writeSettings && !writeState)) return plan;
  const stateDir = path.dirname(stateFile);
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const lock = stateFile + ".lock";
  fs.mkdirSync(lock, { mode: 0o700 });
  try {
    if (!equal(snapshot(target), before) || !equal(snapshot(stateFile), stateBefore)) throw new Error(`${target}: settings changed during planning; run again`);
    const backup = path.join(stateDir, "backups", `${adapter.name}-${randomUUID()}`);
    fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(backup, "before.json"), JSON.stringify({ target, settings: before, state: stateBefore }, null, 2) + "\n", { mode: 0o600 });
    try {
      if (writeSettings) atomicWrite(target, JSON.stringify(merged.value, null, 2) + "\n");
      if (writeState) atomicWrite(stateFile, JSON.stringify(nextState, null, 2) + "\n");
    } catch (error) { restore(target, before); restore(stateFile, stateBefore); throw error; }
    return { ...plan, applied: true, backup };
  } finally { fs.rmdirSync(lock); }
}

if (isMain(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const opt = (key, fallback) => {
      const index = args.indexOf(key);
      if (index < 0) return fallback;
      if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`${key} requires a value`);
      return args[index + 1];
    };
    for (let i = 0; i < args.length; i++) {
      if (["--home", "--runtime"].includes(args[i])) i++;
      else if (!["--apply", "--adopt-symlink"].includes(args[i])) throw new Error(`unknown option: ${args[i]}`);
    }
    const home = path.resolve(opt("--home", process.env.HOME));
    const adapters = loadAdapters();
    const names = opt("--runtime", adapters.filter((a) => a.configure).map((a) => a.name).join(",")).split(",");
    const selected = names.map((name) => {
      const adapter = adapters.find((a) => a.name === name);
      if (!adapter?.configure) throw new Error(`${name}: no configuration adapter`);
      return adapter;
    });
    const options = { home, adoptSymlink: args.includes("--adopt-symlink") };
    const plans = selected.map((adapter) => configure({ adapter, ...options }));
    for (const [index, adapter] of selected.entries()) {
      console.log(JSON.stringify(args.includes("--apply") ? configure({ adapter, ...options, apply: true }) : plans[index]));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
