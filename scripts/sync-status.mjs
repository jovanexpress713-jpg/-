#!/usr/bin/env node
/**
 * تقرير حالة المزامنة: آخر دورة + نبضة المراقب + آخر الأحداث التاريخية.
 *   npm run sync:status          # ملخص
 *   npm run sync:status -- 10    # آخر 10 أحداث
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJSON = (p) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
  } catch {
    return null;
  }
};

const status = readJSON(".sync/status.json");
const beat = readJSON(".sync/heartbeat.json");

const ago = (iso) => {
  if (!iso) return "—";
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 90) return `قبل ${seconds} ثانية`;
  if (seconds < 5400) return `قبل ${Math.round(seconds / 60)} دقيقة`;
  return `قبل ${Math.round(seconds / 3600)} ساعة`;
};

if (!status) {
  console.log("لا يوجد تقرير بعد — شغّل: npm run sync:branch");
  process.exit(0);
}

console.log("── آخر دورة ──");
console.log(`  الوقت          ${status.checkedAt} (${ago(status.checkedAt)})`);
console.log(`  الفرع المتتبَّع  ${status.trackBranch}`);
console.log(`  الحالة          ${status.state}`);
console.log(`  كوميتات جديدة   ${status.newCommits?.length ?? 0}`);
console.log(
  `  الدمج/الأنواع   ${status.merge} · ${status.typecheck}${status.tests !== "off" ? ` · tests=${status.tests}` : ""}`,
);
console.log(`  مقياس التصميم   ${status.autofix ?? "—"}`);
console.log(`  الدفع           ${status.pushed ? "تم" : "لم يتم"}`);
console.log(`  الرسالة         ${status.message}`);

if (status.newCommits?.length) {
  console.log("\n  آخر الكوميتات المسحوبة:");
  for (const c of status.newCommits) console.log(`    - ${c}`);
}

if (status.radar?.length) {
  console.log("\n── رادار الفروع النشطة (لا تُدمج تلقائيًا) ──");
  for (const b of status.radar) {
    const msg = b.aheadOfSession ? `+${b.aheadOfSession} عن فرعك` : "مدموج";
    console.log(`  ${b.branch} · ${b.sha} · ${msg} · ${b.subject?.slice(0, 60) ?? ""}`);
  }
}

console.log("\n── المراقب ──");
if (!beat) {
  console.log("  لا نبضة — المراقب غير مشغّل. شغّله بـ: npm run sync:watch");
} else {
  const pidAlive = (() => {
    try {
      process.kill(beat.pid, 0);
      return true;
    } catch {
      return false;
    }
  })();
  console.log(`  pid            ${beat.pid} ${pidAlive ? "(حيّ)" : "(غير موجود — أعد التشغيل)"}`);
  console.log(`  الفترة         كل ${beat.intervalSeconds} ثانية`);
  console.log(`  الدورات        ${beat.rounds}`);
  console.log(`  آخر نبضة       ${beat.lastBeat} (${ago(beat.lastBeat)})`);
  console.log(`  آخر نتيجة      ${beat.lastResult?.state ?? "—"} · ${beat.lastResult?.message ?? ""}`);
  if (beat.lastBeat && Date.now() - new Date(beat.lastBeat).getTime() > beat.intervalSeconds * 3000) {
    console.log("  ⚠ النبضة متأخرة — قد تكون البيئة أوقفت العملية.");
  }
}

const wanted = Number(process.argv[2] || 5);
const historyPath = path.join(root, ".sync/history.jsonl");
if (fs.existsSync(historyPath) && wanted > 0) {
  const lines = fs
    .readFileSync(historyPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-wanted);
  console.log(`\n── آخر ${lines.length} حدثًا ──`);
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const mark = e.state === "synced" ? "✔" : e.state === "up-to-date" ? "·" : "!";
      const extra = e.newCommits ? ` (${e.newCommits} كوميت)` : "";
      console.log(`  ${mark} ${e.at.slice(11, 16)}  ${e.state}${extra}  ${e.message.slice(0, 90)}`);
    } catch {
      /* سطر تالف */
    }
  }
}
