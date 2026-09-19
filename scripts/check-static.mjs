import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));

function readLocalAsset(assetPath) {
  const clean = assetPath.replace(/^\.\//, "");
  const abs = path.join(root, clean);
  if (!fs.existsSync(abs)) throw new Error(`缺少本地资源：${assetPath}`);
  return fs.readFileSync(abs, "utf8");
}

// 按文档顺序收集脚本内容：外链脚本读文件，内联脚本取内容。
const scriptTags = [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
const scripts = scriptTags.map((match) => {
  const attrs = match[1] || "";
  const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);
  if (!srcMatch) return match[2];
  const src = srcMatch[1];
  if (/^https?:/i.test(src)) throw new Error(`不允许外链远程脚本：${src}`);
  return readLocalAsset(src);
});

if (scripts.length === 0) {
  throw new Error("index.html 中没有找到脚本块");
}

scripts.forEach((script, index) => {
  try {
    new Function(script);
  } catch (error) {
    throw new Error(`第 ${index + 1} 个脚本块语法错误：${error.message}`);
  }
});

// 收集样式内容（外链 CSS），标记检查针对 HTML + CSS + 全部 JS 的合并文本。
const cssLinks = [...html.matchAll(/<link[^>]+rel\s*=\s*["']stylesheet["'][^>]*>/gi)];
const cssTexts = cssLinks.map((tag) => {
  const hrefMatch = tag[0].match(/href\s*=\s*["']([^"']+)["']/i);
  if (!hrefMatch) return "";
  const href = hrefMatch[1];
  if (/^https?:/i.test(href)) throw new Error(`不允许外链远程样式：${href}`);
  return readLocalAsset(href);
});

const combined = html + "\n" + cssTexts.join("\n") + "\n" + scripts.join("\n");

const requiredMarkers = [
  "EXERCISE_LIBRARY",
  "createLocalPlan",
  "renderPlanPreview",
  "persistTrainingState",
  "exportBackup",
  "irontrack-hero.webp",
  "training-actions",
  "keyboard-active",
  "prefers-reduced-motion",
  "ensureUserDataCompatibility",
  "rememberCompatibilityData",
  "repairAndRetryPage",
  './public/exercise-engine.js',
  "EXERCISE_CATALOG_URL",
  "exercise_preferences",
  "toggleExerciseInstructions",
  "restorePausedExercise",
  "replacementMuscle",
  'rel="apple-touch-icon"',
  'href="./manifest.json"',
];

for (const marker of requiredMarkers) {
  if (!combined.includes(marker)) throw new Error(`缺少关键能力：${marker}`);
}

if (/<(?:script|link)[^>]+(?:src|href)=["'][^"']*exercise-instructions-zh/i.test(html)) {
  throw new Error("中文步骤不得在首页通过 script 或 link 预加载");
}

if (!combined.includes("![1,2].includes(Number(payload.version))")) {
  throw new Error("备份导入未兼容版本 1 与版本 2");
}

for (const backupKey of ["exercise_preferences", "exercise_catalog_version"]) {
  const userKeyLine = combined.match(/const USER_DATA_KEYS = \[[^\n]+/i)?.[0] || "";
  if (!userKeyLine.includes(`'${backupKey}'`)) throw new Error(`普通备份缺少 ${backupKey}`);
}

if (/USER_DATA_KEYS[^\n]+apikey/i.test(combined)) {
  throw new Error("普通备份不应包含 API Key");
}

if (!fs.existsSync(new URL("../public/exercise-engine.js", import.meta.url))) {
  throw new Error("缺少本地动作引擎");
}

// Service Worker：注册标记 + 预缓存清单逐条校验文件存在。
if (!combined.includes("serviceWorker")) {
  throw new Error("缺少 Service Worker 注册逻辑");
}
const swPath = new URL("../sw.js", import.meta.url);
if (!fs.existsSync(swPath)) {
  throw new Error("缺少 Service Worker 文件：sw.js");
}
const swText = fs.readFileSync(swPath, "utf8");
new Function(swText);
if (!/CACHE_VERSION\s*=\s*['"][^'"]+['"]/.test(swText)) {
  throw new Error("sw.js 缺少 CACHE_VERSION 版本号");
}
for (const match of swText.matchAll(/'(\.\/[^']+)'/g)) {
  const entry = match[1];
  if (entry === "./") continue;
  const abs = path.join(root, entry.replace(/^\.\//, ""));
  if (!fs.existsSync(abs)) throw new Error(`sw.js 预缓存清单引用了不存在的文件：${entry}`);
}

for (const asset of ["irontrack-hero.webp", "irontrack-hero.jpg"]) {
  if (!fs.existsSync(new URL(`../public/${asset}`, import.meta.url))) {
    throw new Error(`缺少本地主视觉资源：${asset}`);
  }
}

const pngAssets = [
  ["apple-touch-icon.png", 180, 180],
  ["icon-192.png", 192, 192],
  ["icon-512.png", 512, 512],
  ["icon-maskable-512.png", 512, 512],
];

for (const [asset, expectedWidth, expectedHeight] of pngAssets) {
  const pathUrl = new URL(`../public/${asset}`, import.meta.url);
  if (!fs.existsSync(pathUrl)) throw new Error(`缺少主屏幕图标资源：${asset}`);
  const png = fs.readFileSync(pathUrl);
  const signature = png.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error(`主屏幕图标不是有效 PNG：${asset}`);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`主屏幕图标尺寸错误：${asset} 应为 ${expectedWidth}×${expectedHeight}，实际为 ${width}×${height}`);
  }
}

if (manifest.name !== "IronTrack - 智能健身伴侣" || manifest.short_name !== "IronTrack") {
  throw new Error("Web App 清单中的应用名称不正确");
}

if (manifest.start_url !== "./" || manifest.scope !== "./") {
  throw new Error("Web App 清单必须使用适配 GitHub Pages 子目录的相对入口");
}

const manifestIcons = new Map(manifest.icons.map((icon) => [icon.src, icon]));
for (const src of ["./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"]) {
  if (!manifestIcons.has(src)) throw new Error(`Web App 清单缺少图标引用：${src}`);
}

if (manifestIcons.get("./icon-maskable-512.png")?.purpose !== "maskable") {
  throw new Error("Web App 清单缺少 maskable 图标用途声明");
}

for (const removedMarker of ["switchProfileTab('knowledge'", "const knowledge =", "knowledge-item"]) {
  if (combined.includes(removedMarker)) throw new Error(`已删除功能仍有残留：${removedMarker}`);
}

console.log(`PASS: index.html 的 ${scripts.length} 个脚本块语法有效，关键能力标记齐全`);
