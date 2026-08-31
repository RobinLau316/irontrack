import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
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
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) throw new Error(`缺少关键能力：${marker}`);
}

for (const asset of ["irontrack-hero.webp", "irontrack-hero.jpg"]) {
  if (!fs.existsSync(new URL(`../public/${asset}`, import.meta.url))) {
    throw new Error(`缺少本地主视觉资源：${asset}`);
  }
}

for (const removedMarker of ["switchProfileTab('knowledge'", "const knowledge =", "knowledge-item"]) {
  if (html.includes(removedMarker)) throw new Error(`已删除功能仍有残留：${removedMarker}`);
}

console.log(`PASS: index.html 的 ${scripts.length} 个脚本块语法有效，关键能力标记齐全`);
