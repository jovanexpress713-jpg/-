#!/usr/bin/env node
/**
 * EJAZ — دورة مزامنة واحدة مع فرع التطوير.
 *
 * يسحب آخر ما نزل على الفرع المتتبَّع، يدمجه في فرع الجلسة، يثبّت الحزم عند
 * الحاجة، يشغّل فحص الأنواع (والاختبارات اختياريًا)، ثم يدفع النتيجة.
 *
 * الاستخدام:
 *   node scripts/sync-branch.mjs                 # دورة واحدة
 *   RUN_TESTS=1 node scripts/sync-branch.mjs     # دورة مع الاختبارات
 *   node scripts/watch-branch.mjs                # متابعة دورية مستمرة
 *
 * المتغيرات:
 *   TRACK_BRANCH      الفرع المتتبَّع (افتراضي: redesign/ejaz-reality-command-center)
 *   SYNC_PUSH         1 لدفع فرع الجلسة بعد الدمج الناجح (افتراضي 1)
 *   SYNC_INSTALL      1 لتثبيت الحزم عند تغيّر package.json (افتراضي 1)
 *   RUN_TESTS         1 لتشغيل npm test (افتراضي 0 — يستغرق وقتًا)
 *   SYNC_LOG_DIR      مجلد السجلّات (افتراضي .sync)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TRACK_BRANCH = process.env.TRACK_BRANCH || "redesign/ejaz-reality-command-center";
const TRACK_REF = `refs/remotes/all/${TRACK_BRANCH}`;
const SESSION_BRANCH = process.env.SESSION_BRANCH || "arena/e25f790d-repo";
const DO_PUSH = process.env.SYNC_PUSH !== "0";
const DO_INSTALL = process.env.SYNC_INSTALL !== "0";
const RUN_TESTS = process.env.RUN_TESTS === "1";
const LOG_DIR = path.resolve(REPO, process.env.SYNC_LOG_DIR || ".sync");
const STATUS_FILE = path.join(LOG_DIR, "status.json");
const LOG_FILE = path.join(LOG_DIR, "sync.log");

fs.mkdirSync(LOG_DIR, { recursive: true });

function run(cmd, args, { timeout = 600_000 } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: REPO,
    encoding: "utf8",
    timeout,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });
  return {
    ok: r.status === 0,
    status: r.status,
    out: `${r.stdout || ""}${r.stderr || ""}`.trim(),
  };
}

function git(...args) {
  return run("git", args);
}

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  fs.appendFileSync(LOG_FILE, stamped + "\n");
  console.log(stamped);
}

const report = {
  checkedAt: new Date().toISOString(),
  trackBranch: TRACK_BRANCH,
  sessionBranch: SESSION_BRANCH,
  state: "unknown",
  newCommits: [],
  merge: "skipped",
  depsChanged: false,
  typecheck: "skipped",
  tests: RUN_TESTS ? "skipped" : "off",
  pushed: false,
  message: "",
  durationMs: 0,
};

function finish(state, message) {
  report.state = state;
  report.message = message;
  fs.writeFileSync(STATUS_FILE, JSON.stringify(report, null, 2) + "\n");
  log(`STATE=${state} :: ${message}`);
  console.log(JSON.stringify(report, null, 2));
  process.exit(state === "error" ? 1 : 0);
}

const startedAt = Date.now();

// 1) تأكيد أننا على فرع الجلسة
const head = git("rev-parse", "--abbrev-ref", "HEAD");
if (!head.ok || head.out.trim() !== SESSION_BRANCH) {
  finish("error", `فرع العمل الحالي «${head.out.trim()}» وليس «${SESSION_BRANCH}» — أوقفت المزامنة.`);
}

// 2) شجرة عمل نظيفة؟
const dirty = git("status", "--porcelain");
if (!dirty.ok) finish("error", `تعذّر قراءة حالة الشجرة: ${dirty.out}`);
if (dirty.out) {
  finish("blocked", `توجد تعديلات غير محفوظة (${dirty.out.split("\n").length} ملف) — لن أدمج فوق عمل جارٍ.`);
}

// 3) جلب آخر ما نزل على الفرع المتتبَّع
const fetchResult = git(
  "fetch",
  "origin",
  `+refs/heads/${TRACK_BRANCH}:${TRACK_REF}`,
  "+refs/heads/main:refs/remotes/all/main",
);
if (!fetchResult.ok) finish("error", `فشل الجلب من GitHub: ${fetchResult.out.slice(0, 400)}`);

// 4) هل هناك جديد؟
const incoming = git("log", "--oneline", `HEAD..${TRACK_REF}`);
if (!incoming.ok) finish("error", `تعذّر حساب الفروق: ${incoming.out}`);
report.newCommits = incoming.out ? incoming.out.split("\n").filter(Boolean) : [];

if (report.newCommits.length === 0) {
  report.durationMs = Date.now() - startedAt;
  report.merge = "up-to-date";
  finish("up-to-date", `لا جديد — ${SESSION_BRANCH} يحوي كل ما على ${TRACK_BRANCH}.`);
}

// 5) الدمج
const before = git("rev-parse", "HEAD").out.trim();
const mergeResult = git(
  "merge",
  "--no-ff",
  TRACK_REF,
  "-m",
  `sync: merge ${TRACK_BRANCH} (${report.newCommits.length} commit)`,
);
if (!mergeResult.ok) {
  git("merge", "--abort");
  report.merge = "conflict";
  finish("conflict", `تعارض دمج — أُلغي الدمج وبقي فرعك كما هو: ${mergeResult.out.slice(0, 600)}`);
}
report.merge = git("rev-parse", "--short", "HEAD").out.trim();

// 6) هل تغيّرت الحزم؟
const changed = git("diff", "--name-only", `${before}..HEAD`).out.split("\n").filter(Boolean);
report.changedFiles = changed.length;
report.depsChanged = changed.some(
  (f) => f === "package.json" || f === "package-lock.json" || f === "npm-shrinkwrap.json",
);

if (!DO_INSTALL) {
  report.install = "off";
} else if (report.depsChanged || !fs.existsSync(path.join(REPO, "node_modules"))) {
  log("تثبيت الحزم (npm install)…");
  const install = run("npm", ["install", "--no-audit", "--no-fund"], { timeout: 900_000 });
  report.install = install.ok ? "ok" : "failed";
  if (!install.ok) {
    finish("error", `فشل تثبيت الحزم: ${install.out.slice(-500)}`);
  }
} else {
  report.install = "unchanged";
}

// 7) فحص الأنواع
log("فحص الأنواع (tsc --noEmit)…");
const tsc = run("npx", ["tsc", "--noEmit"], { timeout: 600_000 });
report.typecheck = tsc.ok ? "ok" : "failed";
if (!tsc.ok) report.typecheckErrors = tsc.out.split("\n").slice(0, 20).join("\n");

// 8) الاختبارات (اختياري)
if (RUN_TESTS) {
  log("تشغيل الاختبارات (npm test)…");
  const tests = run("npm", ["test"], { timeout: 1_500_000 });
  report.tests = tests.ok ? "ok" : "failed";
  if (!tests.ok) report.testErrors = tests.out.split("\n").slice(-25).join("\n");
}

// 9) الدفع
if (DO_PUSH && report.typecheck === "ok") {
  const push = git("push", "origin", `HEAD:refs/heads/${SESSION_BRANCH}`);
  report.pushed = push.ok;
  if (!push.ok) report.pushError = push.out.slice(0, 400);
}

report.durationMs = Date.now() - startedAt;
const summary = [
  `دُمج ${report.newCommits.length} كوميت`,
  `typecheck=${report.typecheck}`,
  RUN_TESTS ? `tests=${report.tests}` : null,
  DO_PUSH ? `push=${report.pushed ? "ok" : "failed"}` : null,
  report.depsChanged ? "الحزم تغيّرت (أعد تشغيل السيرفر)" : null,
]
  .filter(Boolean)
  .join(" · ");

if (report.typecheck !== "ok" || report.tests === "failed" || (DO_PUSH && !report.pushed)) {
  finish("attention", summary);
}
finish("synced", summary);
