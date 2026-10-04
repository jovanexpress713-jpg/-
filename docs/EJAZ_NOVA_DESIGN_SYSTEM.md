# NOVA Logistics — Navy & Orange Edition · Implementation Record

**Applied:** ٢٠٢٦/١٠/٠٤
**Verification:** `npm run lint` exit 0 · `npm test` **14/14 suites** · `npm run build` exit 0

This records what the brief asked for, what shipped, and — explicitly — the two
places where the shipped value differs from the spec and why.

---

## ١ · Colour system (spec §1) — applied verbatim

Every literal from the brief is now a token in `src/index.css`, and the existing
role tokens are **aliases onto them**. That matters: roughly 410 `bg-surface-*`
and ~1000 `text-text-*` call sites re-skinned without being edited one by one,
because `--color-surface-3` now resolves to `var(--color-bg-card)` → `#0e2142`.

| Spec token | Value | Alias used by the product |
|---|---|---|
| `--bg-deep` | `#050B18` | `--color-surface-0` |
| `--bg-main` | `#08152B` | `--color-surface-1` |
| `--bg-input` | `#0B1B37` | `--color-surface-2` |
| `--bg-card` | `#0E2142` | `--color-surface-3`, `.card` |
| `--bg-card-2` | `#12294F` | `--color-surface-4`, card hover |
| `--border-soft` | `#1B3663` | `--color-border-subtle`, `--color-surface-6` |
| `--border-strong` | `#254780` | `--color-border-focus`, `--color-surface-7` |
| `--orange-primary` | `#FF6B1A` | `--color-brand` |
| `--orange-soft` | `#FF8A3D` | `--color-brand-soft` |
| `--orange-glow` | `#FFB077` | `--color-brand-glow` |
| `--success / --warning / --danger / --info / --ai` | `#22C55E / #FFB020 / #FF3B30 / #38BDF8 / #A855F7` | `--color-status-*` |
| `--text-1 / --text-2` | `#F1F5F9 / #B8C4DA` | `--color-text-primary / -secondary` |

The old `--color-accent-2` (`#2F80FF`) is now an alias of `--color-info`, which
enforces the brief's rule that light blue is informational only and never a
primary.

The daylight theme was re-derived onto the same roles rather than left behind.

---

## ٢ · Two deliberate deviations — read these

Both are contrast failures in the spec, measured with WCAG 2.1 relative
luminance. Both are guarded by an assertion in `tests/novaDesign.test.ts`, so
neither can drift back silently.

### 2.1 `--text-3` is `#7E8DAD`, not the spec's `#6C7A99`

| | on `--bg-card` `#0E2142` |
|---|---|
| spec `#6C7A99` | **3.71:1 — fails AA (needs 4.5:1)** |
| shipped `#7E8DAD` | **4.79:1 — passes** |

`#6C7A99` is the label colour, i.e. the smallest text in the product. The
codebase already carried a comment about having once lifted a muted grey for
exactly this reason, so shipping the spec value would have undone a documented
accessibility fix. `#7E8DAD` is the nearest step that clears the floor.

### 2.2 White on the bright orange is not used for body text

| Pairing | Ratio |
|---|---|
| `#FFFFFF` on `#FF6B1A` | **2.85:1 — fails AA, and fails even the large-text 3:1 floor** |
| `#0A1931` (navy ink) on `#FF6B1A` | **6.16:1 — passes** |
| `#FFFFFF` on `#FF6B1A → #D2470A` gradient | **≥4.52:1 — passes** |

Roughly 30 existing call sites are written `bg-brand text-on-brand`. Setting
`--color-on-brand` to white would have broken all of them at once. Instead:

- **`--color-on-brand` stays navy ink** — body-size text on the bright primary.
- **`--color-on-orange` is white**, used only on the deep end of the orange
  gradient: the active sidebar entry, outgoing chat bubbles, and the
  route-efficiency card. The gradient idiom is the spec's own (§4.6).

If the literal spec is wanted regardless, flipping `--color-on-brand` to
`#ffffff` in one line does it — the test that guards it will fail and name the
ratio, which is the point.

---

## ٣ · The card system (spec §2) — `.card`

`.card` previously had an `inset` 1px ring and **no drop shadow at all**, which
is why every surface read as flat against the navy. It now carries the full
spec recipe, as tokens so the light theme can retune it:

```
radius        20px            --ds-radius-card
padding       18px            --ds-card-pad
border        1px border-soft
shadow        0 8px 32px rgba(0,0,0,.35)      --ds-card-shadow
inner glow    inset 0 1px 0 rgba(255,255,255,.03)   --ds-card-inner
hover         translateY(-2px) + border-strong + 0 0 24px rgba(255,107,26,.08)
transition    220ms ease, on transform/background/border/shadow only
```

Companions added: `.card-hover`, `.card-selected` (§4.4), `.card-accent` (§4.6),
`.map-card` (§4.3), `.card-title`, `.num` / `.num-md` / `.num-lg`, `.label-sm`,
`.pill-*`, `.badge-brand`, `.progress`, `.bubble-in` / `.bubble-out`.

The three surviving `transition: all` declarations in `.chip`, `.field` and
`.nav-item` were removed — the file already documented that only cheap
properties may animate, then contradicted itself.

---

## ٤ · Capacity truck (spec §3) — `src/components/CapacityTruck.tsx`

New component, and the single canonical rendering: both
`overview/TruckCapacity` and `CapacityGauge` (details panel) mount it, so the
two screens can no longer drift apart.

- Cargo box **is** the bar. The fill is a full-height rect translated down by
  `h × (1 − pct/100)` — `transform` rather than the `y`/`height` attributes,
  because CSS transitions on SVG geometry attributes are not reliable across
  engines. Animated over `--ds-fill` (600ms ease-out).
- Fill thresholds exactly as specified: `<60%` → `--color-orange-soft`,
  `60–89%` → `--color-brand`, `≥90%` → vertical gradient `#FF3B30 → #FF6B1A`.
- The figure renders **inside** the box, 40px mono bold, with
  `drop-shadow(0 2px 12px rgba(0,0,0,.5))`.
- `≥90%` adds `.alarm-glow` — a 2s orange-red halo (`alarm-glow` keyframe).
- Wheels turn only while `moving` is true; the spoke rotation is per-wheel.
- Cabin is outline-only `#1B3663`, glass `#254780` at 40%; wheels `#0B1B37`
  with a `#254780` rim.

**One addition beyond the spec:** a navy plate at 74% opacity sits behind the
numeral. White directly on the `#FF6B1A` fill measures 2.85:1; on the plate it
clears 12:1 while still reading as "inside the cargo box".

`loadPct` thresholds, the fill-drop geometry and the alarm cutoff are exported
pure functions (`capacityFill`, `capacityFillDrop`, `CAPACITY_ALARM_AT`) and are
asserted directly in the test suite.

---

## ٥ · Everything else

| Spec | Where | What changed |
|---|---|---|
| §4.1 KPI | `overview/KpiCards.tsx` | 2px orange rule at 40% width, 36px mono figure, 11px label, delta line, 40ms entrance cascade |
| §4.2 Alerts | `AlertsCenter.tsx` | 8px status dot (was a 32px icon tile), 14px title, 12px desc, 11px mono timestamp; severity moved off the card background |
| §4.3 Live map | `InteractiveMap.tsx`, `LiveOperationsCenter.tsx` | Route/accents resolved from tokens — they were painting the retired `#FF7A00` and `#2FD08A`; `.map-card` frosted surface |
| §4.4 Shipment | `ShipmentCard.tsx` | `.card` recipe, `.card-selected`, 4px `.progress` rail that turns red and pulses when late |
| §4.6 Efficiency | `overview/RouteEfficiency.tsx` | **New.** The one orange card, with threshold marker and sparkline |
| §4.7 Chat | `DispatchChatCenter.tsx`, `DetailsPanel.tsx` | `.bubble-out` orange / `.bubble-in` card-2 |
| §4.8 Sidebar | `Sidebar.tsx` | Orange gradient active pill with halo, `badge-brand` count pills, grouped headings |
| §4.9 Create | `Sidebar.tsx` | 1.5px dashed orange, `bg-brand/5`, 16px radius, 36px orange `+` |
| §4.10 Analytics | `AnalyticsReports.tsx` | All chart strokes/fills moved to tokens |
| §5 Icons | — | Existing icons already stroke at 1.75–1.8px; colour now resolves through `--color-text-secondary` / `--color-brand` |
| §6 Motion | `index.css` | `--ds-stagger` 40ms, `--ds-fill` 600ms, `--ds-count` 400ms, `--ds-danger-pulse` 2s, `card-in` keyframe |
| §7 Type | `index.html`, `index.css` | IBM Plex Sans Arabic (prose) + IBM Plex Mono (figures) loaded and wired |

### Route efficiency is computed, not decorative

```
required   = distanceRemainingKm / (etaMinutes / 60)
efficiency = min(100, round(speedKmH / required × 100))
```

100% means the ETA holds at the current speed. A delivered trip scores 100.
Division by zero is guarded. Asserted in the test suite.

---

## ٦ · Defects found and fixed on the way

The visual audit (`EJAZ_CONSOLE_VISUAL_AUDIT.md`) listed these; they were in
scope of the rewrite and are now closed.

1. **Quick-create was unreachable on touch** — `opacity-0` + `group-hover`
   only. Now permanently rendered above the create card.
2. **Three "التحليلات" children all dispatched `onSelect("analysis")`** — three
   labels, one behaviour. Collapsed to a single honest entry.
3. **The "الطلبات" subgroup duplicated top-level destinations** (`trucks` →
   `fleet`, `cargos` → `shipments`). Removed; 23 flat entries became 4 labelled
   groups. Legacy keys still highlight their parent via `KEY_ALIAS`.
4. **Nine legacy hex values were hard-coded in the two canvases** and in the
   3D scene, shipper portal and signature pad — so those surfaces kept painting
   the pre-NOVA palette after the tokens moved. `src/utils/palette.ts` now
   resolves them from the custom properties, cached per theme.
5. **Branding defaults still shipped `#FF7A00` / `#0A1931`** in
   `data/branding.json`, `brandingRoutes.ts`, `brandingStore.tsx`,
   `BrandingSettings.tsx`, `Logo.tsx` and the pre-React boot surface — so the
   logo and splash were the old orange. Updated to `#FF6B1A` / `#050B18`.

A regression guard in `tests/novaDesign.test.ts` walks `src/` and fails if any
of the six retired hex values reappears outside `utils/palette.ts`.

---

## ٧ · Test coverage added

`tests/novaDesign.test.ts` — two suites, registered in `tests/runAllTests.ts`:

**NOVA Stylesheet & Contrast** — the spec literals verbatim, the surface alias
chain, the `.card` recipe, absence of `transition: all`, the stale-palette walk,
the motion tokens, the webfont wiring, and the contrast floors computed live
from the hex values in the file.

**NOVA Component** — real jsdom mounts of `CapacityTruck`, `TruckCapacity`,
`RouteEfficiency`, `KpiCards` and `Sidebar`: fill geometry at 0/50/86/100%,
clamping, the three fill thresholds, the alarm class appearing only at ≥90%,
wheel spin gated on `moving`, the efficiency maths including the divide-by-zero
case, the 40% KPI rule, and the two sidebar defects from §6 above.

---

## Addendum A — Truck Capacity: strict reconstruction, then photographic asset

The sections above describe the original vector `CapacityTruck`. Two later
briefs supersede it for this one component (the rest of NOVA is untouched):

**A.1 Strict visual reconstruction.** The truck was rebuilt to the written
reference: long-haul semi facing LEFT, cabin ≈24% of length, trailer ≈75%,
four wheels in the 1+1+2 heavy arrangement, capacity painted INSIDE the
trailer as a horizontal fill anchored at the FRONT, figure centred inside the
blue region. Electric blue `#2F67FF→#245BFF` deliberately overrides NOVA's
orange-only rule for this component; the ≥90% alarm flash and wheel spin were
dropped with that rewrite (`.alarm-glow` / `.wheel-spin` CSS is now dead).

**A.2 Photographic asset (current).** The user then supplied a real photograph
of the truck (white cab-over + white box trailer, facing LEFT) and asked for
THAT truck with the percentage on top of it. The asset ships at
`public/images/trucks/official/capacity-truck-left.png` (1408×768, keyed out of
a chroma backdrop). `CapacityTruck` now renders the photograph via `<image>`
and paints the meter on top of the trailer box. Every exported constant
(`TRUCK`, `CABIN`, `TRAILER`, `OVERLAY`, `WHEELS`, `WHEEL_D`, `WHEEL_CY`) was
measured from the asset's pixels; `tests/novaDesign.test.ts` §B asserts those
proportions, the asset's presence/PNG signature, the fill math, and a live
mount. If the exact user file is ever dropped at the same path with the same
dimensions, the component picks it up unchanged.
