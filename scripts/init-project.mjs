// 새 저장소에 프로젝트 하네스 뼈대를 심는다.
//   node scripts/init-project.mjs <target-dir> [--runtime claude,codex]
// 런타임 중립 뼈대(src/bootstrap)에 각 어댑터의 project/ 조각을 겹쳐 복사한다.
// 이미 있는 파일은 덮어쓰지 않고 건너뛴다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { root, loadAdapters } from "./link.mjs";

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));
const ri = args.indexOf("--runtime");
const runtimeFilter = ri >= 0 ? args[ri + 1].split(",") : null;
if (!target) { console.error("usage: node scripts/init-project.mjs <target-dir> [--runtime claude,codex]"); process.exit(2); }

const m = JSON.parse(fs.readFileSync(path.join(root, "harness.json"), "utf8"));
const layers = [{ name: "neutral", dir: path.join(root, m.bootstrap ?? "src/bootstrap") }];
for (const a of loadAdapters()) if ((!runtimeFilter || runtimeFilter.includes(a.name)) && a.project) layers.push({ name: a.name, dir: path.join(a.dir, a.project) });

const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
let copied = 0, skipped = 0;
for (const layer of layers) {
  for (const f of walk(layer.dir)) {
    const rel = path.relative(layer.dir, f), dest = path.join(path.resolve(target), rel);
    if (fs.existsSync(dest)) { console.log(`skip  ${rel}  (exists)`); skipped++; continue; }
    fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(f, dest); console.log(`copy  ${rel}  [${layer.name}]`); copied++;
  }
}
console.log(`init-project: ${copied} copied, ${skipped} skipped into ${path.resolve(target)}`);
