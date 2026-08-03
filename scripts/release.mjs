#!/usr/bin/env node
/**
 * OneDB 一键版本升级脚本
 *
 * 用法:
 *   node scripts/release.mjs patch        # 0.2.4 -> 0.2.5 (默认)
 *   node scripts/release.mjs minor        # 0.2.4 -> 0.3.0
 *   node scripts/release.mjs major        # 0.2.4 -> 1.0.0
 *   node scripts/release.mjs 1.0.0        # 指定具体版本号
 *
 * 流程:
 *   1. 校验工作区是否干净
 *   2. 同步更新所有配置文件中的版本号
 *   3. git commit -> git tag vX.Y.Z -> git push (提交 + 标签)
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- 工具函数 ----------

function git(args) {
  return execSync(`git ${args}`, { cwd: ROOT, stdio: "pipe" }).toString().trim();
}

function fail(msg) {
  console.error(`\u274C ${msg}`);
  process.exit(1);
}

function readJSON(relPath) {
  const abs = resolve(ROOT, relPath);
  if (!existsSync(abs)) fail(`文件不存在: ${relPath}`);
  return { abs, data: JSON.parse(readFileSync(abs, "utf-8")) };
}

function writeJSON(relPath, data) {
  const abs = resolve(ROOT, relPath);
  writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`  ✓ ${relPath}`);
}

function bumpVersion(current, type) {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    fail(`无法解析当前版本号: ${current}`);
  }
  let [major, minor, patch] = parts;
  if (type === "major") [major, minor, patch] = [major + 1, 0, 0];
  else if (type === "minor") [major, minor, patch] = [major, minor + 1, 0];
  else if (type === "patch") patch += 1;
  else fail(`无效的升级类型: ${type}（可选: patch / minor / major / 具体版本号）`);
  return `${major}.${minor}.${patch}`;
}

function isValidVersion(v) {
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(v);
}

// ---------- 主流程 ----------

const arg = process.argv[2] || "patch";

// 1. 校验工作区干净（避免把无关改动一起提交）
const status = git("status --porcelain");
if (status) {
  fail("工作区存在未提交的改动，请先提交或清理后再执行版本升级。");
}

// 2. 计算新版本号
const pkg = readJSON("package.json");
const oldVersion = pkg.data.version;
const newVersion = isValidVersion(arg) ? arg : bumpVersion(oldVersion, arg);

if (newVersion === oldVersion) {
  fail(`新版本号与当前版本相同: ${newVersion}`);
}

const tagName = `v${newVersion}`;

// 检查 tag 是否已存在
const existingTags = git("tag -l");
if (existingTags.split("\n").includes(tagName)) {
  fail(`标签 ${tagName} 已存在，请使用其他版本号。`);
}

console.log(`\n🚀 版本升级: ${oldVersion} -> ${newVersion}\n`);

// 3. 更新 package.json / package-lock.json
pkg.data.version = newVersion;
writeJSON("package.json", pkg.data);

const lock = readJSON("package-lock.json");
lock.data.version = newVersion;
if (lock.data.packages && lock.data.packages[""]) {
  lock.data.packages[""].version = newVersion;
}
writeJSON("package-lock.json", lock.data);

// 4. 更新 tauri.conf.json
const tauriConf = readJSON("src-tauri/tauri.conf.json");
tauriConf.data.version = newVersion;
writeJSON("src-tauri/tauri.conf.json", tauriConf.data);

// 5. 更新 Cargo.toml 中 [package] 的 version
const cargoTomlPath = resolve(ROOT, "src-tauri/Cargo.toml");
let cargoToml = readFileSync(cargoTomlPath, "utf-8");
const tomlReplaced = cargoToml.replace(
  /(name = "onedb"\r?\nversion = ")[^"]+(")/,
  `$1${newVersion}$2`
);
if (tomlReplaced === cargoToml) fail("未能在 Cargo.toml 中定位 version 字段");
writeFileSync(cargoTomlPath, tomlReplaced, "utf-8");
console.log("  ✓ src-tauri/Cargo.toml");

// 6. 更新 Cargo.lock 中 onedb 包的版本
const cargoLockPath = resolve(ROOT, "src-tauri/Cargo.lock");
let cargoLock = readFileSync(cargoLockPath, "utf-8");
const lockReplaced = cargoLock.replace(
  /(name = "onedb"\r?\nversion = ")[^"]+(")/,
  `$1${newVersion}$2`
);
if (lockReplaced === cargoLock) fail("未能在 Cargo.lock 中定位 onedb 包的 version 字段");
writeFileSync(cargoLockPath, lockReplaced, "utf-8");
console.log("  ✓ src-tauri/Cargo.lock");

// 7. 提交、打 tag、推送
console.log("\n📦 提交并推送...\n");
git("add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock");
git(`commit -m "chore(release): ${tagName}"`);
git(`tag ${tagName}`);
git("push");
git(`push origin ${tagName}`);

console.log(`\n✅ 完成! 版本已升级到 ${newVersion}，标签 ${tagName} 已推送到远程。`);
