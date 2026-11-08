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
    if (isExternal && !fs.existsSync(path.join(root, "dist/skills", n, "SKILL.md"))) warnings.push(`external skill not installed: dist/skills/${n} (npx skills add ${manifest.external[n]} --skill ${n})`);
  }
}
for (const name of customNames) if (!Object.values(manifest.profiles).some((l) => l.includes(name))) warnings.push(`custom skill "${name}" belongs to no profile; it will never be linked`);

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
