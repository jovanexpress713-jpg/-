/**
 * Urdu templates for the handful of *interpolated* legacy call sites.
 *
 * Eighteen `t(\`…${n}…\`, \`…\`)` call sites build their text at render time, so an
 * exact-string glossary can never match them. Each pattern below recognises the
 * rendered English string, captures its figures and emits the Urdu sentence, so
 * an Urdu session shows no English counters either.
 */
export interface UrTemplate {
  match: RegExp;
  /** `$1`, `$2` … refer to the capture groups of `match`. */
  urdu: string;
}

export const UR_TEMPLATES: UrTemplate[] = [
  { match: /^(\d+) of (\d+) shipments · live telemetry$/, urdu: "$1 از $2 کھیپ · لائیو ٹیلی میٹری" },
  { match: /^Message (.+)…$/, urdu: "پیغام بھیجیں: $1…" },
  { match: /^Encrypted dispatch session opened for Trip (.+)$/, urdu: "ٹرپ $1 کے لیے محفوظ ڈسپیچ سیشن کھل گیا" },
  { match: /^Type operational directive to (.+)\.\.\.$/, urdu: "$1 کو ہدایت لکھیں..." },
  { match: /^Route from (.+) to (.+)$/, urdu: "راستہ $1 سے $2 تک" },
  { match: /^Tracking (\d+) active consignments across Saudi corridors$/, urdu: "سعودی کوریڈورز پر $1 فعال کھیپ کی ٹریکنگ" },
  { match: /^Image is larger than (.+)\.$/, urdu: "تصویر $1 سے بڑی ہے۔" },
  { match: /^Model is larger than (.+)\.$/, urdu: "ماڈل $1 سے بڑا ہے۔" },
  { match: /^(\d+) shipments exported to CSV$/, urdu: "$1 کھیپ CSV میں برآمد ہوئیں" },
  { match: /^([\d,.]+) km covered$/, urdu: "$1 کلومیٹر طے شدہ" },
  { match: /^([\d,.]+) km covered across active trips$/, urdu: "فعال ٹرپس میں $1 کلومیٹر طے شدہ" },
  { match: /^Truck load (\d+) percent of (.+) tonnes$/, urdu: "ٹرک لوڈ $1 فیصد از $2 ٹن" },
  { match: /^(\d+)h (\d+)m$/, urdu: "$1 گھنٹے $2 منٹ" },
  { match: /^(\d+)m$/, urdu: "$1 منٹ" },
  { match: /^([\d,.]+) miles still to run$/, urdu: "$1 میل باقی" },
  { match: /^(\d+) vehicles in the fleet$/, urdu: "فلیٹ میں $1 گاڑیاں" },
  { match: /^(\d+) vehicles off the road$/, urdu: "$1 گاڑیاں سروس سے باہر" },
  { match: /^Live fleet · (\d+) units$/, urdu: "لائیو فلیٹ · $1 یونٹ" },
];

/** Apply the first matching template, or return `null` when none applies. */
export function urduFromTemplate(en: string): string | null {
  for (const template of UR_TEMPLATES) {
    if (template.match.test(en)) return en.replace(template.match, template.urdu);
  }
  return null;
}
