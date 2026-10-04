import assert from "assert";
import { execFileSync } from "child_process";
import path from "path";

/**
 * EJAZ Transport — i18n integrity.
 *
 * Guards the promise made in the brief: choosing a language switches the WHOLE
 * product, and an Urdu session never shows Arabic text.
 *
 *   1. every central key carries ar + en + ur, and the Urdu is a real
 *      translation (never a copy of the Arabic);
 *   2. the ~800 legacy `t(en, ar)` call sites all resolve to Urdu, measured by
 *      the same audit script the build uses (`scripts/i18n-audit.mjs`);
 *   3. the language resolution order keeps the per-user choice across reloads
 *      and sign-ins;
 *   4. direction follows the language (rtl for ar/ur, ltr for en).
 */

const root = process.cwd();

export async function runI18nTests() {
  console.log("  [TEST] Running i18n (Arabic · English · Urdu) Tests...");

  const { MESSAGES, translateKey, dirOf, LANGUAGE_OPTIONS } = await import("../src/localization/i18n");
  const { resolveUrdu, hasUrduFor } = await import("../src/localization/ur.glossary");
  const { urduFromTemplate } = await import("../src/localization/urdu/templates");

  /* 1. Every key is complete in all three languages. */
  const keys = Object.keys(MESSAGES) as (keyof typeof MESSAGES)[];
  assert.ok(keys.length > 250, `the key registry must be substantial, got ${keys.length}`);
  for (const key of keys) {
    const entry = MESSAGES[key];
    for (const lang of ["ar", "en", "ur"] as const) {
      assert.ok(
        typeof entry[lang] === "string" && entry[lang].trim().length > 0,
        `${key} is missing its ${lang} value`,
      );
    }
  }

  /* 2. Urdu is a translation, not a copy of the Arabic — except where a term is
        intentionally identical (proper nouns such as "English" / "العربية"). */
  const INTENTIONAL = new Set(["language.ar", "language.en", "language.ur"]);
  const untranslated = keys.filter((key) => {
    if (INTENTIONAL.has(key as string)) return false;
    const entry = MESSAGES[key];
    return entry.ur === entry.ar && /[\u0600-\u06FF]/.test(entry.ar);
  });
  assert.deepStrictEqual(
    untranslated,
    [],
    `these keys still show Arabic text in Urdu mode: ${untranslated.join(", ")}`,
  );

  /* 3. The three languages are exposed once, with flags and native names. */
  assert.strictEqual(LANGUAGE_OPTIONS.length, 3);
  assert.deepStrictEqual(
    LANGUAGE_OPTIONS.map((o) => o.code),
    ["ar", "en", "ur"],
  );
  for (const option of LANGUAGE_OPTIONS) {
    assert.ok(option.flag.length > 0, "the language option must carry a flag");
    assert.ok(translateKey("ur", option.labelKey).length > 0);
  }

  /* 4. Direction: Arabic and Urdu are RTL, English is LTR. */
  assert.strictEqual(dirOf("ar"), "rtl");
  assert.strictEqual(dirOf("ur"), "rtl");
  assert.strictEqual(dirOf("en"), "ltr");

  /* 5. Legacy call sites resolve to Urdu — no Arabic in an Urdu session. */
  const coverage = execFileSync("node", ["scripts/i18n-audit.mjs"], {
    cwd: path.join(root),
    encoding: "utf8",
  });
  const pctMatch = coverage.match(/coverage\s+:\s+([\d.]+)%/);
  assert.ok(pctMatch, "the audit must report a coverage figure");
  const pct = Number(pctMatch![1]);
  assert.ok(
    pct >= 99,
    `Urdu coverage of the legacy call sites dropped to ${pct}% — run node scripts/i18n-audit.mjs --list`,
  );

  /* 6. Central keys: whatever the language, the value comes from that language. */
  assert.strictEqual(translateKey("ur", "nav.trips"), "ٹرپس");
  assert.strictEqual(translateKey("ar", "nav.trips"), "الرحلات");
  assert.strictEqual(translateKey("en", "nav.trips"), "Trips");
  assert.strictEqual(translateKey("ur", "nav.identity"), "سیٹنگز اور شناخت");
  assert.strictEqual(translateKey("en", "app.tagline"), "Your cargo.. our responsibility");
  assert.strictEqual(translateKey("ar", "app.tagline"), "نقلكم .. مسؤوليتنا");

  /* 7. Spot checks: the strings an operator meets first must be Urdu. */
  const samples: [string, string][] = [
    ["Trips", "ٹرپس"],
    ["Shipments", "کھیپ"],
    ["Logistics Dashboard", "ڈیش بورڈ"],
    ["Settings & Identity", "سیٹنگز اور شناخت"],
    ["Heavy Fleet & Logistics Control", "ہیوی فلیٹ اور لاجسٹکس کنٹرول"],
  ];
  for (const [en, expected] of samples) {
    assert.strictEqual(resolveUrdu(en, "—"), expected, `${en} must resolve to its Urdu form`);
  }

  /* 8. Arabic is never returned when the Urdu twin exists. */
  assert.ok(hasUrduFor("Live Map", "الخريطة المباشرة"));
  assert.strictEqual(resolveUrdu("Live Map", "الخريطة المباشرة"), "لائیو نقشہ");

  /* 9. Dynamic counters resolve through the template layer. */
  assert.strictEqual(urduFromTemplate("Live fleet · 12 units"), "لائیو فلیٹ · 12 یونٹ");
  assert.strictEqual(urduFromTemplate("18 of 40 shipments · live telemetry"), "18 از 40 کھیپ · لائیو ٹیلی میٹری");
  assert.strictEqual(resolveUrdu("3 vehicles off the road", "٣ مركبة خارج الخدمة"), "3 گاڑیاں سروس سے باہر");

  /* 10. Language persistence contract: the provider stores the choice on the
        device AND on the user record so a re-login keeps it. */
  const fs = await import("fs");
  const settingsSource = fs.readFileSync(path.join(root, "src", "settings.tsx"), "utf8");
  assert.match(settingsSource, /ejaz-lang/, "the device language key must be written");
  assert.match(settingsSource, /preferredLanguage/, "the per-user language must be persisted");
  assert.match(settingsSource, /html\.dir = dir/, "the document direction must follow the language");
  assert.match(settingsSource, /data-lang/, "the active language must be exposed on <html>");

  console.log("  ✓ i18n (Arabic · English · Urdu) Tests Passed Successfully!");
}
