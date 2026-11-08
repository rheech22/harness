// 외부 스킬 설치. harness.json 의 external[name] 이 가리키는 upstream 에서 Skills CLI 로 설치한다.
//   node scripts/add-external.mjs <name> [<name> ...]   선언된 이름만
//   node scripts/add-external.mjs --all                  external 전부
// 설치 자리는 레포 루트의 .agents/skills → dist/skills 링크가 정한다. agent 대상은 codex 하나만 쓴다.
// 다른 대상(claude-code 등)은 레포 안에 런타임 디렉터리(.claude/ 등)를 만들고 복사본을 늘리기 때문이다.
// 결과는 dist/skills/<name>/ 와 skills-lock.json 에 남으며 둘 다 커밋한다.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "harness.json"), "utf8"));
const external = manifest.external ?? {};
const args = process.argv.slice(2);
const names = args.includes("--all") ? Object.keys(external) : args.filter((a) => !a.startsWith("--"));
if (!names.length) { console.error("usage: node scripts/add-external.mjs <name> [<name> ...] | --all"); process.exit(2); }

const link = path.join(root, ".agents/skills");
const st = fs.lstatSync(link, { throwIfNoEntry: false });
if (!st?.isSymbolicLink() || path.resolve(path.dirname(link), fs.readlinkSync(link)) !== path.join(root, "dist/skills")) {
  console.error(".agents/skills must be a symlink to dist/skills (the install location)"); process.exit(1);
}

let failed = 0;
for (const name of names) {
  const repo = external[name];
  if (!repo) { console.error(`error ${name}: not declared in harness.json external`); failed++; continue; }
  console.log(`install ${name} <- ${repo}`);
  const r = spawnSync("npx", ["-y", "skills@latest", "add", repo, "-s", name, "-a", "codex", "-y"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { console.error(`error ${name}: skills add exited ${r.status}`); failed++; continue; }
  if (!fs.existsSync(path.join(root, "dist/skills", name, "SKILL.md"))) { console.error(`error ${name}: dist/skills/${name}/SKILL.md missing after install`); failed++; }
}
for (const stray of [".claude", ".codex", ".cursor"]) if (fs.existsSync(path.join(root, stray))) console.log(`warn  ${stray}/ appeared in the repo; it is gitignored but should not exist (wrong agent target?)`);
process.exit(failed ? 1 : 0);
