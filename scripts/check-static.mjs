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
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) throw new Error(`缺少关键能力：${marker}`);
}

console.log(`PASS: index.html 的 ${scripts.length} 个脚本块语法有效，关键能力标记齐全`);
