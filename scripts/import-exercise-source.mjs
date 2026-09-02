import crypto from "node:crypto";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const lock = JSON.parse(fs.readFileSync(new URL("tools/exercise-catalog/source-lock.json", root), "utf8"));
const sourceFlag = process.argv.indexOf("--source");

if (sourceFlag < 0 || !process.argv[sourceFlag + 1]) {
  throw new Error("用法：node scripts/import-exercise-source.mjs --source /absolute/path/to/exercises.json");
}

const sourcePath = process.argv[sourceFlag + 1];
const sourceBytes = fs.readFileSync(sourcePath);
const sha256 = crypto.createHash("sha256").update(sourceBytes).digest("hex");

if (sha256 !== lock.dataSha256) {
  throw new Error(`数据源校验值不一致：应为 ${lock.dataSha256}，实际为 ${sha256}`);
}

const records = JSON.parse(sourceBytes.toString("utf8"));
if (!Array.isArray(records) || records.length !== lock.expectedRecords) {
  throw new Error(`数据源记录数量异常：应为 ${lock.expectedRecords}，实际为 ${Array.isArray(records) ? records.length : "非数组"}`);
}

const requiredFields = [
  "id", "name", "category", "body_part", "equipment", "instructions",
  "instruction_steps", "muscle_group", "secondary_muscles", "target",
  "image", "gif_url", "media_id", "created_at", "attribution",
];
const languages = ["en", "es", "it", "tr", "ru", "zh", "hi", "pl", "ko", "fr"];
const ids = new Set();
const errors = [];

for (const [index, record] of records.entries()) {
  for (const field of requiredFields) {
    if (!(field in record)) errors.push(`第 ${index + 1} 条缺少 ${field}`);
  }
  if (ids.has(record.id)) errors.push(`重复编号 ${record.id}`);
  ids.add(record.id);
  if (record.category !== record.body_part) errors.push(`${record.id} 的 category 与 body_part 不一致`);
  for (const language of languages) {
    if (!String(record.instructions?.[language] || "").trim()) errors.push(`${record.id} 缺少 ${language} 说明`);
    if (!Array.isArray(record.instruction_steps?.[language]) || record.instruction_steps[language].length === 0) {
      errors.push(`${record.id} 缺少 ${language} 分步说明`);
    }
  }
}

if (errors.length) {
  throw new Error(`数据源结构校验失败：\n${errors.slice(0, 20).join("\n")}${errors.length > 20 ? `\n另有 ${errors.length - 20} 项` : ""}`);
}

console.log(`PASS: ${lock.repository}@${lock.commit.slice(0, 7)}，${records.length} 条记录，SHA-256 ${sha256}`);
