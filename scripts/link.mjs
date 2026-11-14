// 링크 계획/적용.
//   node scripts/link.mjs --profile common,writing [--runtime claude,codex] [--home <dir>] [--apply]
// 공용 배포(dist/skills → ~/.agents/skills)는 harness.json 이, 런타임별 경로와 링크는
// src/adapters/<runtime>/adapter.json 이 소유한다. 어댑터 안의 src 표기:
//   "@root/<path>"        하네스 루트 기준 (예: @root/AGENTS.md)
//   "@dist/<path>/*"      생성물 기준 (예: @dist/adapters/claude/commands/*)
//   "@shared.skills/*"    공용 배포에 들어간 스킬마다 (2차 링크)
//   "<path>"              어댑터 디렉터리 기준 (rules/*, commands/*, hooks.json)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifests } from "./build.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const m = JSON.parse(fs.readFileSync(path.join(root, "harness.json"), "utf8"));

export function loadAdapters() {
  const dir = path.join(root, m.adapters ?? "src/adapters");
  return fs.readdirSync(dir).filter((n) => fs.existsSync(path.join(dir, n, "adapter.json")))
    .map((n) => ({ name: n, dir: path.join(dir, n), ...JSON.parse(fs.readFileSync(path.join(dir, n, "adapter.json"), "utf8")) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const HOME = path.resolve(opt("--home", process.env.HOME));
  const apply = args.includes("--apply");
  const profiles = opt("--profile", "common").split(",").map((s) => s.trim()).filter(Boolean);
  const runtimeFilter = opt("--runtime", null)?.split(",").map((s) => s.trim());

  const expand = (p) => p.replace(/^~/, HOME);
  const sharedSkills = expand(m.targets.shared.skills);
  const selected = new Set(profiles.flatMap((p) => { if (!m.profiles[p]) throw new Error(`unknown profile ${p}`); return m.profiles[p]; }));
  const distributed = [...selected].filter((n) => fs.existsSync(path.join(root, "dist/skills", n)));
  // 생성된 명령·규칙은 스킬 선언이 소유한다. 선택한 프로필의 스킬이 선언한 것만 링크한다.
  const ownedEntries = new Set();
  for (const sm of loadManifests()) {
    if (!selected.has(sm.name)) continue;
    for (const [rt, c] of Object.entries(sm.commands ?? {})) ownedEntries.add(`dist/adapters/${rt}/commands/${c.name}.md`);
    for (const [rt, r] of Object.entries(sm.rules ?? {})) ownedEntries.add(`dist/adapters/${rt}/rules/${r.name}.md`);
  }

  const plan = [];
  const addPlan = (link, to, note = "") => plan.push({ link, to, note });

  // 1) 공용 배포 (런타임 중립)
  for (const name of distributed) addPlan(path.join(sharedSkills, name), path.join(root, "dist/skills", name), "shared");
  for (const name of selected) if (!distributed.includes(name)) addPlan(path.join(sharedSkills, name), "(missing: not installed)", "skip");

  // 2) 어댑터별
  const adapters = loadAdapters().filter((a) => !runtimeFilter || runtimeFilter.includes(a.name));
  for (const a of adapters) {
    const target = (key) => { const p = a.targets[key]; if (!p) throw new Error(`${a.name}: unknown target ${key}`); return expand(p); };
    for (const rule of a.links) {
      if (rule.src === "@shared.skills/*") { for (const name of distributed) for (const t of rule.to) addPlan(path.join(target(t), name), path.join(sharedSkills, name), `${a.name} via shared`); continue; }
      const srcBase = rule.src.startsWith("@root/") ? path.join(root, rule.src.slice(6).replace(/\/\*$/, "")) : rule.src.startsWith("@dist/") ? path.join(root, "dist", rule.src.slice(6).replace(/\/\*$/, "")) : path.join(a.dir, rule.src.replace(/\/\*$/, ""));
      if (rule.mode !== "per-entry") { for (const t of rule.to) addPlan(target(t), srcBase, a.name); continue; }
      let entries = fs.existsSync(srcBase) ? fs.readdirSync(srcBase).filter((n) => !n.startsWith(".")) : [];
      if (rule.src.startsWith("@dist/")) entries = entries.filter((n) => ownedEntries.has(path.relative(root, path.join(srcBase, n))));
      for (const name of entries) for (const t of rule.to) addPlan(path.join(target(t), name), path.join(srcBase, name), a.name);
    }
  }

  const rel = (p) => p.startsWith(HOME) ? "~" + p.slice(HOME.length) : p.startsWith(root) ? "harness" + p.slice(root.length) : p;
  console.log(`profiles: ${profiles.join(", ")}   runtimes: ${adapters.map((a) => a.name).join(", ")}   home: ${HOME}   mode: ${apply ? "apply" : "plan"}`);
  for (const { link, to, note } of plan) console.log(`${note === "skip" ? "skip " : "link "} ${rel(link).padEnd(48)} -> ${rel(to).padEnd(44)} ${note !== "skip" ? `[${note}]` : ""}`);

  if (apply) {
    let made = 0, kept = 0;
    for (const { link, to, note } of plan) {
      if (note === "skip") continue;
      fs.mkdirSync(path.dirname(link), { recursive: true });
      const cur = fs.lstatSync(link, { throwIfNoEntry: false });
      if (cur) { if (cur.isSymbolicLink() && fs.readlinkSync(link) === to) { kept++; continue; } throw new Error(`refusing to overwrite existing path: ${link}`); }
      fs.symlinkSync(to, link); made++;
    }
    console.log(`applied: ${made} created, ${kept} already correct`);
  }
}
