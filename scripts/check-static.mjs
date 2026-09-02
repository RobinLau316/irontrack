import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const manifest = JSON.parse(fs.readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);

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
  "normalizeCatalogAIPlan",
  'rel="apple-touch-icon"',
  'href="./manifest.json"',
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) throw new Error(`缺少关键能力：${marker}`);
}

if (/<(?:script|link)[^>]+(?:src|href)=["'][^"']*exercise-instructions-zh/i.test(html)) {
  throw new Error("中文步骤不得在首页通过 script 或 link 预加载");
}

if (!html.includes("![1,2].includes(Number(payload.version))")) {
  throw new Error("备份导入未兼容版本 1 与版本 2");
}

for (const backupKey of ["exercise_preferences", "exercise_catalog_version"]) {
  const userKeyLine = html.match(/const USER_DATA_KEYS = \[[^\n]+/i)?.[0] || "";
  if (!userKeyLine.includes(`'${backupKey}'`)) throw new Error(`普通备份缺少 ${backupKey}`);
}

if (/USER_DATA_KEYS[^\n]+apikey/i.test(html)) {
  throw new Error("普通备份不应包含 API Key");
}

if (!fs.existsSync(new URL("../public/exercise-engine.js", import.meta.url))) {
  throw new Error("缺少本地动作引擎");
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
  const path = new URL(`../public/${asset}`, import.meta.url);
  if (!fs.existsSync(path)) throw new Error(`缺少主屏幕图标资源：${asset}`);
  const png = fs.readFileSync(path);
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
  if (html.includes(removedMarker)) throw new Error(`已删除功能仍有残留：${removedMarker}`);
}

console.log(`PASS: index.html 的 ${scripts.length} 个脚本块语法有效，关键能力标记齐全`);
