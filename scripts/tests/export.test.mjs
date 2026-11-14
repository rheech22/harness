import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-export-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"));
  for (const file of ["build.mjs", "export.mjs"]) fs.copyFileSync(path.join(scripts, file), path.join(root, "scripts", file));
  const source = path.join(root, "src/packages/demo");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "__init__.py"), '__version__ = "1.2.3"\n');
  fs.writeFileSync(path.join(source, "payload.txt"), "original");
  fs.writeFileSync(path.join(root, "harness.json"), JSON.stringify({ publish: { demo: { from: "src/packages/demo", versionFile: "__init__.py" } } }));
  execFileSync("git", ["init", "--quiet", root]);
  const run = (version = "1.2.3") => spawnSync(process.execPath, ["scripts/export.mjs", "demo", "--version", version], { cwd: root, encoding: "utf8" });
  return { root, source, run, dest: path.join(root, "dist/packages/demo") };
}

test("exports the matching package version and preserves its payload", (t) => {
  const { run, dest } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, ".export.json"))).version, "1.2.3");
  assert.equal(fs.readFileSync(path.join(dest, "payload.txt"), "utf8"), "original");
  assert.equal(run().status, 0, "identical untagged exports are repeatable");
});

test("rejects a package version mismatch before replacing the snapshot", (t) => {
  const { run, dest } = fixture(t);
  assert.equal(run().status, 0);
  const before = fs.readFileSync(path.join(dest, ".export.json"), "utf8");
  const result = run("1.2.4");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /export version 1\.2\.4 differs from package version 1\.2\.3/);
  assert.equal(fs.readFileSync(path.join(dest, ".export.json"), "utf8"), before);
});

test("rejects changed source under an already exported version", (t) => {
  const { run, source, dest } = fixture(t);
  assert.equal(run().status, 0);
  fs.writeFileSync(path.join(source, "payload.txt"), "changed");
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /already exported with different content/);
  assert.equal(fs.readFileSync(path.join(dest, "payload.txt"), "utf8"), "original");
});

test("rejects an existing package tag even without a previous snapshot", (t) => {
  const { root, run } = fixture(t);
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "fixture"], { cwd: root });
  execFileSync("git", ["tag", "demo-v1.2.3"], { cwd: root });
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /release tag demo-v1\.2\.3 already exists/);
});

test("rejects malformed versions", (t) => {
  const { run } = fixture(t);
  const result = run("01.2.3");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid release version/);
});

test("a new package version permits the changed source", (t) => {
  const { run, source, dest } = fixture(t);
  assert.equal(run().status, 0);
  fs.writeFileSync(path.join(source, "__init__.py"), '__version__ = "1.2.4"\n');
  fs.writeFileSync(path.join(source, "payload.txt"), "changed");
  const result = run("1.2.4");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dest, ".export.json"))).version, "1.2.4");
  assert.equal(fs.readFileSync(path.join(dest, "payload.txt"), "utf8"), "changed");
});

test("rejects stripping the version file from the exported package", (t) => {
  const { root, run } = fixture(t);
  const manifestPath = path.join(root, "harness.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.publish.demo.strip = ["__init__.py"];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /versionFile must be included/);
});

test("rejects a version file without a literal package version", (t) => {
  const { source, run } = fixture(t);
  fs.writeFileSync(path.join(source, "__init__.py"), '__version__ = get_version()\n');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expected a literal __version__ assignment/);
});

test("strips nested Python caches while keeping package code", (t) => {
  const { root, source, run, dest } = fixture(t);
  fs.mkdirSync(path.join(source, "demo/adapters/__pycache__"), { recursive: true });
  fs.writeFileSync(path.join(source, "demo/adapters/__pycache__/inbox.pyc"), "cache");
  fs.writeFileSync(path.join(source, "demo/adapters/inbox.py"), "code");
  const manifestPath = path.join(root, "harness.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  manifest.publish.demo.strip = ["**/__pycache__/**", "**/*.pyc"];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(dest, "demo/adapters/__pycache__/inbox.pyc")), false);
  assert.equal(fs.readFileSync(path.join(dest, "demo/adapters/inbox.py"), "utf8"), "code");
});
