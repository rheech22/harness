// 외부 배포용 스냅샷 생성 (릴리스 행위).
//   node scripts/export.mjs <name> --version <ver>
// harness.json 의 publish.<name> = { from, strip: [glob...], versionFile?: "excalibridge/__init__.py" }
// from 을 packages/<name>/ 로 복사하고(strip 제외) .export.json 에 버전·소스 해시·패키지 해시를 기록한다.
// packages/ 는 손으로 편집하지 않는다. 소스가 바뀌어도 다음 export 전까지 그대로다(의도된 지연).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { root, walk } from "./build.mjs";

export function globToRe(glob) {
  const pattern = glob.split(/(\*\*\/|\*\*|\*)/).map((part) => {
    if (part === "**/") return "(?:.*/)?";
    if (part === "**") return ".*";
    if (part === "*") return "[^/]*";
    return part.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return new RegExp(`^${pattern}$`);
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
  if (!fs.statSync(fromAbs, { throwIfNoEntry: false })?.isDirectory()) throw new Error(`${name}: source directory ${spec.from} does not exist`);
  const rels = listFiles(fromAbs, spec.strip ?? []);
  return { spec, fromAbs, rels, hash: hashFiles(fromAbs, rels) };
}

export function readPackageVersion(baseAbs, versionFile) {
  const text = fs.readFileSync(path.join(baseAbs, versionFile), "utf8");
  const version = /^__version__\s*=\s*["']([^"']+)["']\s*$/m.exec(text)?.[1];
  if (!version) throw new Error(`${versionFile}: expected a literal __version__ assignment`);
  return version;
}

export function validateRelease(name, version, src) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`invalid release version "${version}": expected MAJOR.MINOR.PATCH`);
  if (src.spec.versionFile) {
    const packageVersion = readPackageVersion(src.fromAbs, src.spec.versionFile);
    if (version !== packageVersion) throw new Error(`${name}: export version ${version} differs from package version ${packageVersion}`);
    if (!src.rels.includes(src.spec.versionFile)) throw new Error(`${name}: versionFile must be included in the exported package`);
  }
  const tag = `${name}-v${version}`;
  const result = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/tags/${tag}`], { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status === 0) throw new Error(`${name}: release tag ${tag} already exists`);
  if (result.status !== 1) throw new Error(`cannot check release tag ${tag}: ${result.stderr.trim()}`);
  const previous = packageState(name);
  if (previous?.manifest?.version === version && previous.manifest.sourceHash !== src.hash) throw new Error(`${name}: v${version} was already exported with different content; bump the package version`);
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
  let src;
  try {
    src = sourceState(name);
    validateRelease(name, version, src);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  const { spec, fromAbs, rels, hash } = src;
  const dest = path.join(root, "dist/packages", name);
  fs.rmSync(dest, { recursive: true, force: true });
  for (const rel of rels) { fs.mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true }); fs.copyFileSync(path.join(fromAbs, rel), path.join(dest, rel)); }
  const packageHash = hashFiles(dest, rels);
  fs.writeFileSync(path.join(dest, ".export.json"), JSON.stringify({ name, version, from: spec.from, strip: spec.strip ?? [], sourceHash: hash, packageHash, exportedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`exported ${name} v${version}: ${rels.length} file(s) from ${spec.from} -> dist/packages/${name}  (tag: ${name}-v${version})`);
}
