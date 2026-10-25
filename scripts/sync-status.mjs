#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const file = path.resolve(process.cwd(), ".sync/status.json");
try {
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  const lines = [
    `آخر فحص: ${report.checkedAt}`,
    `الفرع المتتبَّع: ${report.trackBranch}`,
    `الحالة: ${report.state}`,
    `كوميتات جديدة آخر دورة: ${report.newCommits?.length ?? 0}`,
    `الدمج: ${report.merge} · الأنواع: ${report.typecheck} · الاختبارات: ${report.tests}`,
    `الدفع: ${report.pushed ? "تم" : "لم يتم"}`,
    `الرسالة: ${report.message}`,
  ];
  if (report.newCommits?.length) {
    lines.push("", "آخر الكوميتات المسحوبة:");
    for (const c of report.newCommits) lines.push(`  - ${c}`);
  }
  console.log(lines.join("\n"));
} catch {
  console.log("لا يوجد تقرير بعد — شغّل: npm run sync:branch");
}
