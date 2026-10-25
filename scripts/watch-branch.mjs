#!/usr/bin/env node
/**
 * EJAZ — متابعة دورية لفرع التطوير.
 *
 * يشغّل scripts/sync-branch.mjs كل فترة، ويسجّل النتيجة، ويستمر رغم الأخطاء
 * أو التعارضات (لا يوقفه إلا خطأ فادح في نفسه).
 *
 * المتغيرات:
 *   SYNC_INTERVAL_SECONDS   الفترة بين الدورات (افتراضي 300 = 5 دقائق)
 *   RUN_TESTS               1 لتشغيل الاختبارات في كل دورة (افتراضي 0)
 *   TRACK_BRANCH            الفرع المتتبَّع
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const INTERVAL = Math.max(30, Number(process.env.SYNC_INTERVAL_SECONDS || 300));
const LOG_DIR = path.resolve(REPO, process.env.SYNC_LOG_DIR || ".sync");

function stamp() {
  return new Date().toISOString();
}

console.log(`[${stamp()}] متابعة ${process.env.TRACK_BRANCH || "redesign/ejaz-reality-command-center"} كل ${INTERVAL} ثانية.`);

let round = 0;
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    stopping = true;
    console.log(`[${stamp()}] إيقاف المتابعة (${sig}).`);
    process.exit(0);
  });
}

function cycle() {
  round += 1;
  console.log(`[${stamp()}] دورة #${round} — بدأت.`);
  const r = spawnSync(process.execPath, [path.join(REPO, "scripts/sync-branch.mjs")], {
    cwd: REPO,
    encoding: "utf8",
    timeout: INTERVAL * 4 * 1000,
    env: process.env,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  const tail = out.split("\n").slice(-6).join("\n");
  console.log(`[${stamp()}] دورة #${round} — انتهت (exit=${r.status}).\n${tail}`);
}

cycle();
const timer = setInterval(() => {
  if (!stopping) cycle();
}, INTERVAL * 1000);
timer.unref?.();
// أبقِ العملية حيّة
setInterval(() => {}, 1 << 30);

void LOG_DIR;
