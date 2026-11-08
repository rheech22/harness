// 1) dist/ drift: src/ 로부터 다시 만든 결과와 같은가 (어긋나면 오류). 번들 닫힘(끊어진 링크)은 오류, 번들 밖 링크는 경고
// 2) 매니페스트 정합: profiles 의 이름이 custom(src/skills, src/tools) 또는 external 로 설명되는가
// 3) 외부 스킬 설치 여부 (경고)
// 4) dist/packages 상태: 손편집은 오류, 소스가 앞서 있으면 "export 대기" 경고 (정상 상태)
import fs from "node:fs";
import path from "node:path";
import { root, expected, generatedDirs } from "./build.mjs";
import { sourceState, packageState } from "./export.mjs";

const { files, warnings: buildWarnings, errors: buildErrors } = expected();
const errors = [...buildErrors], warnings = [...buildWarnings], notes = [];
const same = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

for (const [rel, content] of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) errors.push(`missing generated file: ${rel} (run: node scripts/build.mjs)`);
  else if (!same(fs.readFileSync(abs), content)) errors.push(`drift: ${rel} differs from its source (edit src/, then rebuild)`);
}
const expectedKeys = new Set(files.keys());
for (const rel of generatedDirs()) {
  const still = rel.startsWith("dist/skills/") ? [...expectedKeys].some((k) => k.startsWith(rel + "/")) : expectedKeys.has(rel);
  if (!still) errors.push(`stale generated output: ${rel}`);
}
const customNames = new Set([...expectedKeys].filter((k) => k.startsWith("dist/skills/")).map((k) => k.split("/")[2]));

const manifest = JSON.parse(fs.readFileSync(path.join(root, "harness.json"), "utf8"));
const external = new Set(Object.keys(manifest.external ?? {}));
for (const [profile, names] of Object.entries(manifest.profiles)) {
  for (const n of names) {
    const isCustom = customNames.has(n), isExternal = external.has(n);
    if (isCustom && isExternal) errors.push(`profile ${profile}: "${n}" is declared both custom and external`);
    if (!isCustom && !isExternal) errors.push(`profile ${profile}: "${n}" is neither custom (src/skills, src/tools) nor listed in external`);
    if (isExternal && !fs.existsSync(path.join(root, "dist/skills", n, "SKILL.md"))) warnings.push(`external skill not installed: dist/skills/${n} (node scripts/add-external.mjs ${n})`);
  }
}
for (const name of customNames) if (!Object.values(manifest.profiles).some((l) => l.includes(name))) warnings.push(`custom skill "${name}" belongs to no profile; it will never be linked`);

// 5) external 과 skills-lock.json 의 정합: 설치 자리 링크, lock 출처, 선언 없는 설치
const agentsLink = path.join(root, ".agents/skills");
const linkStat = fs.lstatSync(agentsLink, { throwIfNoEntry: false });
if (!linkStat?.isSymbolicLink() || path.resolve(path.dirname(agentsLink), fs.readlinkSync(agentsLink)) !== path.join(root, "dist/skills")) errors.push(".agents/skills must be a symlink to dist/skills (Skills CLI install location)");
const lockPath = path.join(root, "skills-lock.json");
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, "utf8")).skills ?? {} : {};
for (const n of external) {
  const entry = lock[n];
  if (!entry) { if (fs.existsSync(path.join(root, "dist/skills", n, "SKILL.md"))) errors.push(`external skill ${n} is installed but missing from skills-lock.json (reinstall with node scripts/add-external.mjs ${n})`); continue; }
  if (entry.source !== manifest.external[n]) errors.push(`skills-lock.json: ${n} comes from ${entry.source} but harness.json external says ${manifest.external[n]}`);
}
for (const n of Object.keys(lock)) if (!external.has(n)) errors.push(`skills-lock.json has "${n}" which harness.json does not declare as external`);
for (const n of fs.existsSync(path.join(root, "dist/skills")) ? fs.readdirSync(path.join(root, "dist/skills")) : []) if (!customNames.has(n) && !external.has(n)) errors.push(`dist/skills/${n} is neither generated nor declared external`);

for (const name of Object.keys(manifest.publish ?? {})) {
  const src = sourceState(name);
  const pkg = packageState(name);
  if (!pkg) { notes.push(`publish ${name}: never exported (node scripts/export.mjs ${name} --version <ver>)`); continue; }
  if (!pkg.manifest) { errors.push(`dist/packages/${name}: missing .export.json (not produced by export.mjs)`); continue; }
  if (pkg.hash !== pkg.manifest.packageHash) errors.push(`dist/packages/${name}: edited by hand since export v${pkg.manifest.version} (re-run export instead)`);
  else if (src.hash !== pkg.manifest.sourceHash) warnings.push(`export pending: ${name} v${pkg.manifest.version} is behind ${src.spec.from} (fine until the next release)`);
  else notes.push(`publish ${name}: v${pkg.manifest.version} is current`);
}

for (const n of notes) console.log(`note  ${n}`);
for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`error ${e}`);
console.log(errors.length ? `check failed (${errors.length} error(s))` : `check passed (${files.size} generated files, ${warnings.length} warning(s))`);
process.exit(errors.length ? 1 : 0);
