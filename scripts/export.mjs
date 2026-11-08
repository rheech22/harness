// 외부 배포용 스냅샷 생성 (릴리스 행위).
//   node scripts/export.mjs <name> --version <ver>
// harness.json 의 publish.<name> = { from: "skills/<x>" | "tools/<x>", strip: [glob...] }
// from 을 packages/<name>/ 로 복사하고(strip 제외) .export.json 에 버전·소스 해시·패키지 해시를 기록한다.
// packages/ 는 손으로 편집하지 않는다. 소스가 바뀌어도 다음 export 전까지 그대로다(의도된 지연).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { root, walk } from "./build.mjs";

export function globToRe(glob) {
  return new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "(?:.*/)?").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
}
export function listFiles(fromAbs, strip = []) {
  const res = strip.map(globToRe);
  return walk(fromAbs, () => true).map((f) => path.relative(fromAbs, f)).filter((rel) => !res.some((re) => re.test(rel))).sort();
}
export function hashFiles(baseAbs, rels) {
  const h = crypto.createHash("sha256");
  for (const rel of rels) { h.update(rel + "\0"); h.update(fs.readFileSync(path.join(baseAbs, rel))); h.update("\0"); }
  return "sha256:" + h.digest("hex").slice(0, 16);
}
export function publishSpec(name) {
  const m = JSON.parse(fs.readFileSync(path.join(root, "harness.json"), "utf8"));
  const spec = m.publish?.[name];
  if (!spec) throw new Error(`harness.json publish.${name} is not declared`);
  return spec;
}
export function sourceState(name) {
  const spec = publishSpec(name);
  const fromAbs = path.join(root, spec.from);
  const rels = listFiles(fromAbs, spec.strip ?? []);
  return { spec, fromAbs, rels, hash: hashFiles(fromAbs, rels) };
}
export function packageState(name) {
  const dir = path.join(root, "dist/packages", name);
  if (!fs.existsSync(dir)) return null;
  const manifestPath = path.join(dir, ".export.json");
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : null;
  const rels = listFiles(dir).filter((r) => r !== ".export.json");
  return { dir, manifest, rels, hash: hashFiles(dir, rels) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const vi = process.argv.indexOf("--version");
  const version = vi >= 0 ? process.argv[vi + 1] : null;
  if (!name || !version) { console.error("usage: node scripts/export.mjs <name> --version <ver>"); process.exit(2); }
  const { spec, fromAbs, rels, hash } = sourceState(name);
  const dest = path.join(root, "dist/packages", name);
  fs.rmSync(dest, { recursive: true, force: true });
  for (const rel of rels) { fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true }); fs.copyFileSync(path.join(fromAbs, rel), path.join(dest, rel)); }
  const packageHash = hashFiles(dest, rels);
  fs.writeFileSync(path.join(dest, ".export.json"), JSON.stringify({ name, version, from: spec.from, strip: spec.strip ?? [], sourceHash: hash, packageHash, exportedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`exported ${name} v${version}: ${rels.length} file(s) from ${spec.from} -> dist/packages/${name}  (tag: ${name}-v${version})`);
}
