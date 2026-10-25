#!/usr/bin/env node
/**
 * EJAZ — متابعة دورية مستمرة لفرع التطوير (مع نبض حياة وإعادة تشغيل ذاتية).
 *
 * يشغّل scripts/sync-branch.mjs كل فترة قصيرة، ويكتب نبضة في .sync/heartbeat.json
 * حتى تعرف أن المتابعة حيّة، ويستمر مهما حدث (لا يتوقف إلا بإشارة إيقاف صريحة).
 *
 * المتغيرات:
 *   SYNC_INTERVAL_SECONDS   الفترة بين الدورات (افتراضي 60 ثانية، الحد الأدنى 30)
 *   RUN_TESTS               1 لتشغيل الاختبارات في كل دورة فيها جديد
 *   TRACK_BRANCH            الفرع المتتبَّع
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const INTERVAL = Math.max(30, Number(process.env.SYNC_INTERVAL_SECONDS || 60));
const LOG_DIR = path.resolve(REPO, process.env.SYNC_LOG_DIR || ".sync");
const HEARTBEAT = path.join(LOG_DIR, "heartbeat.json");
const WATCH_LOG = path.join(LOG_DIR, "watch.log");

fs.mkdirSync(LOG_DIR, { recursive: true });

function stamp() {
  return new Date().toISOString();
}

function writeHeartbeat(patch) {
  let previous = {};
  try {
    previous = JSON.parse(fs.readFileSync(HEARTBEAT, "utf8"));
  } catch {
    previous = {};
  }
  const beat = {
    pid: process.pid,
    intervalSeconds: INTERVAL,
    trackBranch: process.env.TRACK_BRANCH || "redesign/ejaz-reality-command-center",
    startedAt: previous.startedAt || stamp(),
    lastBeat: stamp(),
    rounds: previous.rounds || 0,
    lastResult: previous.lastResult || null,
    ...patch,
  };
  fs.writeFileSync(HEARTBEAT, JSON.stringify(beat, null, 2) + "\n");
  return beat;
}

function say(line) {
  const text = `[${stamp()}] ${line}`;
  console.log(text);
  try {
    fs.appendFileSync(WATCH_LOG, text + "\n");
  } catch {
    /* السجل ليس حرجًا */
  }
}

let round = 0;
let stopping = false;
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    stopping = true;
    writeHeartbeat({ lastBeat: stamp(), state: "stopping" });
    say(`إيقاف المتابعة (${sig}) بعد ${round} دورة.`);
    process.exit(0);
  });
}

/* خطأ غير متوقع خلال دورة لا يجوز أن يقتل المراقب: نسجّله ونكمل. */
for (const evt of ["uncaughtException", "unhandledRejection"]) {
  process.on(evt, (err) => {
    say(`خطأ غير متوقع (${evt}) — المتابعة مستمرة: ${String(err && err.stack ? err.stack : err).slice(0, 500)}`);
    writeHeartbeat({ lastBeat: stamp(), lastError: String(err).slice(0, 300) });
  });
}

function cycle() {
  round += 1;
  writeHeartbeat({ rounds: round, state: "running", lastBeat: stamp() });
  say(`دورة #${round} — بدأت.`);
  let exitCode = null;
  try {
    const r = spawnSync(process.execPath, [path.join(REPO, "scripts/sync-branch.mjs")], {
      cwd: REPO,
      encoding: "utf8",
      timeout: Math.max(INTERVAL * 20, 900) * 1000,
      env: process.env,
    });
    exitCode = r.status;
    const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
    let state = "unknown";
    let message = "";
    try {
      const report = JSON.parse(out.slice(out.indexOf("{")));
      state = report.state || state;
      message = report.message || "";
    } catch {
      message = out.split("\n").slice(-4).join(" | ");
    }
    writeHeartbeat({
      rounds: round,
      state,
      lastBeat: stamp(),
      lastResult: { exitCode, state, message: message.slice(0, 400), at: stamp() },
    });
    say(`دورة #${round} — انتهت (exit=${exitCode}) · ${state} · ${message.slice(0, 220)}`);
  } catch (err) {
    writeHeartbeat({
      rounds: round,
      state: "error",
      lastBeat: stamp(),
      lastResult: { exitCode, state: "error", message: String(err).slice(0, 300), at: stamp() },
    });
    say(`دورة #${round} — استثناء: ${String(err).slice(0, 300)}`);
  }
}

say(`متابعة ${process.env.TRACK_BRANCH || "redesign/ejaz-reality-command-center"} كل ${INTERVAL} ثانية — pid ${process.pid}.`);
cycle();

setInterval(() => {
  if (!stopping) cycle();
}, INTERVAL * 1000);

/* أبقِ العملية حيّة حتى لو أفرغت الحلقة الدورية كل مؤقتاتها. */
setInterval(() => {}, 1 << 30);
