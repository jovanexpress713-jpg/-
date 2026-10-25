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
 *   SYNC_AUTOFIX      0 لتعطيل الطيّ التلقائي لمقياس التصميم (افتراضي 1)
 *   SYNC_CONFLICT_STRATEGY  theirs (افتراضي) أو abort عند تعارض الدمج
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
const AUTOFIX = process.env.SYNC_AUTOFIX !== "0";
const CONFLICT_STRATEGY = process.env.SYNC_CONFLICT_STRATEGY || "theirs";
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
  autofix: "skipped",
  radar: [],
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
  // سجل تاريخي: سطر JSON لكل دورة، لمعرفة إيقاع الفرع ونشاطه عبر الوقت.
  try {
    fs.appendFileSync(
      path.join(LOG_DIR, "history.jsonl"),
      JSON.stringify({
        at: report.checkedAt,
        state,
        newCommits: report.newCommits?.length ?? 0,
        subjects: report.newCommits || [],
        merge: report.merge,
        autofix: report.autofix,
        typecheck: report.typecheck,
        tests: report.tests,
        pushed: report.pushed,
        message,
      }) + "\n",
    );
  } catch {
    /* السجل ليس حرجًا */
  }
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
const fetchResult = git("fetch", "origin", "+refs/heads/*:refs/remotes/all/*", "--prune");
if (!fetchResult.ok) finish("error", `فشل الجلب من GitHub: ${fetchResult.out.slice(0, 400)}`);

// 3.5) رادار الفروع: نظرة معلوماتية على بقية الفروع النشطة (لا دمج، لا دفع).
// الفروع التي نُشطت في آخر ٣ أيام فقط، حتى لا تكون هناك كلفة على الفروع القديمة.
function buildRadar() {
  const out = git(
    "for-each-ref",
    "--sort=-committerdate",
    "--format=%(refname:short)|%(committerdate:iso8601)|%(contents:subject)|%(objectname:short)",
    "refs/remotes/all",
  );
  if (!out.ok) return [];
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  return out.out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [ref, date, subject, sha] = line.split("|");
      const branch = ref.replace(/^all\//, "").replace(/^origin\//, "");
      return { branch, date, subject, sha };
    })
    .filter((b) => b.branch && b.branch !== TRACK_BRANCH && b.branch !== "HEAD")
    .filter((b) => {
      const when = Date.parse(b.date);
      return Number.isFinite(when) && Date.now() - when < threeDaysMs;
    })
    .slice(0, 8)
    .map((b) => {
      const ahead = git("rev-list", "--count", `HEAD..all/${b.branch}`);
      return { ...b, aheadOfSession: Number(ahead.out.trim() || 0) };
    });
}

// 4) هل هناك جديد؟
const incoming = git("log", "--oneline", `HEAD..${TRACK_REF}`);
if (!incoming.ok) finish("error", `تعذّر حساب الفروق: ${incoming.out}`);
report.newCommits = incoming.out ? incoming.out.split("\n").filter(Boolean) : [];
report.radar = buildRadar();

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
  // استراتيجية التعارض: إن كانت الملفات المتعارضة ملفات طيّ مقياس فقط، فالأفضل
  // أخذ نسخة الفرع (هي الأحدث والأشمل) ثم إعادة تشغيل الكودمود والتحقق. لا ندفع
  // إلا بعد نجاح فحص الأنواع (والاختبارات إن كانت مفعّلة)؛ وإلا نرجّع الفرع كما كان.
  const conflicted = git("diff", "--name-only", "--diff-filter=U").out.split("\n").filter(Boolean);
  if (CONFLICT_STRATEGY === "theirs" && conflicted.length) {
    log(`تعارض في ${conflicted.length} ملف — أخذ نسخة ${TRACK_BRANCH} ثم التحقق: ${conflicted.join(", ")}`);
    for (const f of conflicted) git("checkout", "--theirs", "--", f);
    git("add", "-A");
    const resolved = git("commit", "-m", `sync: resolve conflicts in favour of ${TRACK_BRANCH}`);
    if (resolved.ok) {
      report.conflictResolution = conflicted.join(", ");
      report.merge = git("rev-parse", "--short", "HEAD").out.trim();
    } else {
      git("reset", "--hard", before);
      report.merge = "conflict";
      finish("conflict", `تعارض لم يُحل — أُرجع الفرع كما كان: ${conflicted.join(", ")}`);
    }
  } else {
    git("merge", "--abort");
    report.merge = "conflict";
    finish("conflict", `تعارض دمج في (${conflicted.join(", ")}) — أُلغي الدمج وبقي فرعك كما هو.`);
  }
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

// 6.5) إصلاح تلقائي لمقياس التصميم.
// أكثر ما يكسر CI بعد كل اندماج: الفرع يكتب أدوات Tailwind الافتراضية
// (text-sm / rounded-3xl / sm:text-4xl) وكودمود المشروع يعرف كيف يطويها إلى
// الخطوات المعتمدة. نفحص أولًا، ولا نكتب شيئًا إن لم يكن هناك ما يحتاج طيًّا.
if (AUTOFIX) {
  const guard = run("node", ["scripts/migrate-design-tokens.mjs", "--check"]);
  if (guard.ok) {
    report.autofix = "clean";
  } else {
    log("مقياس التصميم يحتاج طيّ التحجيمات — تشغيل الكودمود…");
    const fold = run("node", ["scripts/migrate-design-tokens.mjs"]);
    if (!fold.ok) {
      report.autofix = "failed";
      report.autofixError = fold.out.slice(-400);
    } else {
      const touched = git("status", "--porcelain");
      const files = touched.out.split("\n").filter(Boolean);
      if (files.length) {
        git("add", "-A");
        const commit = git(
          "commit",
          "-m",
          `chore(sync): fold design tokens after merging ${TRACK_BRANCH}`,
        );
        report.autofix = commit.ok ? `folded ${files.length} file(s)` : "commit-failed";
      } else {
        report.autofix = "clean";
      }
    }
  }
} else {
  report.autofix = "off";
}

// 7) فحص الأنواع
log("فحص الأنواع (tsc --noEmit)…");
const tsc = run("npx", ["tsc", "--noEmit"], { timeout: 600_000 });
report.typecheck = tsc.ok ? "ok" : "failed";
if (!tsc.ok) report.typecheckErrors = tsc.out.split("\n").slice(0, 20).join("\n");
if (!tsc.ok && report.conflictResolution) {
  git("reset", "--hard", before);
  report.merge = "rolled-back";
  finish("conflict", `الدمج كسر فحص الأنواع — أُرجع الفرع كما كان (${report.conflictResolution}).`);
}

// 8) الاختبارات (اختياري)
if (RUN_TESTS) {
  log("تشغيل الاختبارات (npm test)…");
  const tests = run("npm", ["test"], { timeout: 1_500_000 });
  report.tests = tests.ok ? "ok" : "failed";
  if (!tests.ok) report.testErrors = tests.out.split("\n").slice(-25).join("\n");
  if (!tests.ok && report.conflictResolution) {
    git("reset", "--hard", before);
    report.merge = "rolled-back";
    finish("conflict", `الدمج أسقط الاختبارات — أُرجع الفرع كما كان (${report.conflictResolution}).`);
  }
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
  ["clean", "off", "skipped"].includes(report.autofix) ? null : `autofix=${report.autofix}`,
]
  .filter(Boolean)
  .join(" · ");

if (report.typecheck !== "ok" || report.tests === "failed" || (DO_PUSH && !report.pushed)) {
  finish("attention", summary);
}
finish("synced", summary);
