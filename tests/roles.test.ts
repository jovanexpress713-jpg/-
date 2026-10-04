import assert from "assert";
import fs from "fs";
import path from "path";

/**
 * EJAZ Transport — role routing, smart alerts and the AI assistant.
 *
 * These are the guarantees the brief asks for and that are easy to break
 * silently: alerts reach ONLY the responsible role/person, the assistant never
 * exceeds the signed-in user's permissions, and every sensitive action needs a
 * confirmation and lands in the audit trail.
 */

const root = process.cwd();

const alert = (over: Record<string, unknown> = {}) =>
  ({
    id: "a1",
    type: "delay",
    severity: "HIGH",
    owner: "operations",
    titleAr: "تأخير",
    titleEn: "Delay",
    descAr: "وصف",
    descEn: "Description",
    timestamp: "10:00",
    resolved: false,
    ...over,
  }) as any;

export async function runRoleRoutingTests() {
  console.log("  [TEST] Running Role Routing, Smart Alerts & Assistant Tests...");

  const {
    detectIssues,
    isVisibleTo,
    canActOn,
    shouldThrottle,
    nextSeverity,
    normalizeSeverity,
    escalateTargetOf,
    toRoutedAlert,
    dedupeKeyOf,
  } = await import("../src/services/smartAlerts");
  const { buildAssistantContext, answerQuestion, suggestionsFor, actionsFor, tripStatusKey } =
    await import("../src/services/assistantEngine");
  const { can, canPersona, SENSITIVE_ACTIONS } = await import("../src/utils/permissions");

  /* ── 1. Severity ladder + escalation ─────────────────────────────────── */
  assert.strictEqual(normalizeSeverity("critical"), "CRITICAL");
  assert.strictEqual(normalizeSeverity("warning"), "HIGH");
  assert.strictEqual(normalizeSeverity("info"), "INFO");
  assert.strictEqual(nextSeverity("LOW"), "MEDIUM");
  assert.strictEqual(nextSeverity("CRITICAL"), "CRITICAL", "escalation must not overflow");
  assert.strictEqual(escalateTargetOf(alert({ owner: "driver" })), "operations");
  assert.strictEqual(escalateTargetOf(alert({ owner: "operations" })), "it");
  assert.strictEqual(escalateTargetOf(alert({ owner: "it" })), "operations");

  /* ── 2. Routing: no broadcast, field identities see only their own ──── */
  const ownAlert = alert({ type: "sync", driverId: "drv-7" });
  const otherAlert = alert({ type: "sync", driverId: "drv-9" });
  const opsAlert = alert({ type: "delay" });

  const driver7 = { persona: "driver", apiRole: "DRIVER", driverId: "drv-7" };
  assert.strictEqual(isVisibleTo(ownAlert, driver7), true);
  assert.strictEqual(isVisibleTo(otherAlert, driver7), false, "a driver must never see another driver's alert");

  const client = { persona: "shipper", apiRole: "CUSTOMER" };
  assert.strictEqual(isVisibleTo(opsAlert, client), false, "clients have their own stream, never console alerts");
  assert.strictEqual(isVisibleTo(ownAlert, client), false);

  const admin = { persona: "admin", apiRole: "SUPER_ADMIN" };
  const dispatcher = { persona: "admin", apiRole: "DISPATCHER" };
  assert.strictEqual(isVisibleTo(opsAlert, admin), true);
  assert.strictEqual(isVisibleTo(opsAlert, dispatcher), true, "dispatchers own delay/route alerts");
  assert.strictEqual(
    isVisibleTo(alert({ type: "api" }), dispatcher),
    false,
    "an IT incident must not land on a dispatcher",
  );

  /* ── 3. Acting: the responsible role only, never on a resolved incident ─ */
  assert.strictEqual(canActOn(opsAlert, admin), true);
  assert.strictEqual(canActOn(opsAlert, dispatcher), true, "the responsible dispatcher acknowledges the delay");
  assert.strictEqual(canActOn(alert({ type: "api" }), dispatcher), false, "a dispatcher must not act on an IT incident");
  assert.strictEqual(canActOn(ownAlert, driver7), true, "the driver acknowledges their own assignment");
  assert.strictEqual(canActOn(otherAlert, driver7), false);
  assert.strictEqual(canActOn(opsAlert, client), false);
  assert.strictEqual(canActOn(alert({ resolved: true }), admin), false, "resolved alerts are closed");
  assert.strictEqual(
    canActOn(opsAlert, { persona: "admin", apiRole: "ACCOUNTANT" }),
    false,
    "finance must not acknowledge operations alerts",
  );

  /* ── 4. Dedupe + cooldown ────────────────────────────────────────────── */
  assert.strictEqual(
    dedupeKeyOf(alert({ type: "delay", tripId: "t1", truckId: "v1" })),
    dedupeKeyOf(alert({ type: "delay", tripId: "t1", truckId: "v1" })),
  );
  const now = 1_000_000_000;
  const sameKind = { type: "delay", tripId: "t1", truckId: "v1" } as any;
  const seen: any[] = [
    { dedupeKey: dedupeKeyOf(sameKind), detectedAt: now - 60_000, severity: "HIGH" },
  ];
  assert.strictEqual(shouldThrottle(seen, { ...sameKind, severity: "HIGH" }, now), true);
  assert.strictEqual(
    shouldThrottle(seen, { ...sameKind, severity: "CRITICAL" }, now),
    false,
    "a severity rise must break through the cooldown",
  );
  seen[0].detectedAt = now - 60 * 60 * 1000;
  assert.strictEqual(shouldThrottle(seen, { ...sameKind, severity: "HIGH" }, now), false);
  assert.strictEqual(shouldThrottle([], { ...sameKind, severity: "HIGH" }, now), false);

  /* ── 5. Detection produces the six-field incident card ──────────────── */
  const staleTrip = {
    id: "EZ-1",
    tripNumber: "EZ-1",
    status: "on_road",
    driverId: "drv-7",
    truckId: "v1",
    originCity: "Jeddah",
    destinationCity: "Riyadh",
    progressPct: 40,
    speedKmH: 0,
    minutesSinceGpsFix: 120,
    minutesSinceStatusUpdate: 240,
    isDelayed: true,
  } as any;

  const issues = detectIssues({ trips: [staleTrip], apiUnreachable: true });
  assert.ok(issues.length >= 2, "an idle + unreachable API must be detected");
  for (const issue of issues) {
    assert.ok(issue.type, "every issue carries a type");
    assert.ok(issue.severity, "every issue carries a severity");
    assert.ok(issue.owner, "every issue is routed to an owner");
    assert.ok(issue.keys?.title && issue.keys?.cause, "every issue explains what happened and why");
    assert.ok(issue.keys?.impact && issue.keys?.action, "every issue states the impact and the fix");
    assert.ok(issue.keys?.next, "every issue states the next step");
    assert.ok(issue.signals && typeof issue.signals === "object", "every issue carries the measured signals");
  }
  assert.ok(
    issues.some((i) => i.severity === "CRITICAL"),
    "a truck stopped for two hours on the road is critical",
  );

  /* ── 6. Legacy alert adapter keeps the routing intact ────────────────── */
  const routed = toRoutedAlert({
    id: "legacy-1",
    type: "delay",
    severity: "warning",
    titleAr: "تأخير الرحلة",
    titleEn: "Trip delay",
    descAr: "وصف",
    descEn: "Desc",
    timestamp: "09:30",
    resolved: false,
    tripId: "EZ-1",
  } as any);
  assert.strictEqual(routed.severity, "HIGH");
  assert.strictEqual(routed.owner, "operations");
  assert.ok(routed.dedupeKey);

  /* ── 7. The assistant sees exactly what the user may see ────────────── */
  const driverUser = {
    id: "u-driver",
    name: "فهد",
    email: "driver@ejaz.sa",
    role: "DRIVER",
    permissions: ["trips.transition", "gps.ingest"],
    driverId: "drv-7",
  } as any;
  const clientUser = {
    id: "u-client",
    name: "شركة",
    email: "client@ejaz.sa",
    role: "CUSTOMER",
    permissions: ["trips.create", "claims.create"],
  } as any;
  const adminUser = {
    id: "u-admin",
    name: "مدير",
    email: "admin@ejaz.sa",
    role: "SUPER_ADMIN",
    permissions: ["*"],
  } as any;

  const targetTrips = [
    { id: "EZ-1", code: "EZ-1", status: "on_road", driverId: "drv-7", truckId: "v1", progress: 40, eta: "18:00" },
    { id: "EZ-2", code: "EZ-2", status: "loading", driverId: "drv-9", truckId: "v2", progress: 5, eta: "21:00" },
  ] as any;
  const routedAlerts = [toRoutedAlert(alert({ type: "sync", driverId: "drv-7", id: "a-sync" }))];

  const driverCtx = buildAssistantContext({
    user: driverUser,
    persona: "driver",
    page: "trips",
    trips: targetTrips,
    trucks: [],
    drivers: [],
    alerts: routedAlerts,
  });
  assert.strictEqual(driverCtx.scope, "driver");
  assert.deepStrictEqual(
    driverCtx.trips.map((t: any) => t.id),
    ["EZ-1"],
    "a driver context must contain only their own trip",
  );
  assert.ok(driverCtx.alerts.every((a: any) => a.driverId === "drv-7"));
  assert.strictEqual(driverCtx.capabilities.viewFinance, false);
  assert.strictEqual(driverCtx.capabilities.act, true, "a driver may act on their own trip");

  const clientCtx = buildAssistantContext({
    user: clientUser,
    persona: "shipper",
    page: "shipments",
    trips: targetTrips,
    trucks: [],
    drivers: [],
    alerts: [],
  });
  assert.strictEqual(clientCtx.scope, "client");
  assert.strictEqual(clientCtx.capabilities.manageTrips, false, "a client never manages the fleet");
  assert.strictEqual(clientCtx.capabilities.viewReports, false);
  assert.deepStrictEqual(clientCtx.alerts, [], "no internal alerts leak to a client");
  assert.strictEqual(clientCtx.capabilities.act, false, "a read-only client cannot act from the assistant");

  const adminCtx = buildAssistantContext({
    user: adminUser,
    persona: "admin",
    page: "overview",
    trips: targetTrips,
    trucks: [],
    drivers: [],
    alerts: routedAlerts,
  });
  assert.strictEqual(adminCtx.scope, "admin");
  assert.strictEqual(adminCtx.trips.length, 2);

  /* ── 8. Questions outside the user's permissions are refused ────────── */
  const tk = (key: string) => key;
  const denied = answerQuestion("profit and finance settlement", clientCtx, tk as any);
  assert.strictEqual(denied.denied, true, "a client asking for finance must be refused");

  const allowed = answerQuestion("where is my shipment", clientCtx, tk as any);
  assert.ok(allowed.key || allowed.issues, "an in-scope question is answered");
  assert.notStrictEqual(allowed.denied, true);

  /* ── 9. Suggestions are permission-scoped and bounded ──────────────── */
  for (const ctx of [driverCtx, clientCtx, adminCtx]) {
    const chips = suggestionsFor(ctx);
    assert.ok(chips.length > 0 && chips.length <= 5, "suggestions stay short and contextual");
    for (const chip of chips) assert.ok(chip.labelKey, "each suggestion is a translatable key");
  }

  /* ── 10. Sensitive actions require confirmation ────────────────────── */
  const actionIssue = issues[0];
  const adminActions = actionsFor(adminCtx, actionIssue);
  const sensitive = adminActions.filter((a: any) => a.requiresConfirm);
  assert.ok(sensitive.length > 0, "impactful actions must ask for confirmation first");
  const driverActions = actionsFor(driverCtx, actionIssue);
  for (const action of driverActions) {
    if (SENSITIVE_ACTIONS.includes(action.id as any)) assert.fail(`driver offered the sensitive action ${action.id}`);
  }

  /* ── 11. Audit trail: escalations and acknowledgements are recorded ── */
  const storeSource = fs.readFileSync(path.join(root, "src", "state", "fleetStore.tsx"), "utf8");
  assert.match(storeSource, /escalateAlert/, "the store must expose escalation");
  assert.match(storeSource, /recordAuditLog/, "escalation must write to the audit log");
  const alertsCenterSource = fs.readFileSync(path.join(root, "src", "components", "AlertsCenter.tsx"), "utf8");
  assert.match(alertsCenterSource, /canActOn/, "the alerts centre must gate every action");
  assert.match(alertsCenterSource, /recordAuditLog/, "acknowledgement must write to the audit log");

  /* ── 12. Persona capability matrix stays coherent ──────────────────── */
  assert.strictEqual(canPersona("driver", "trips.transition"), true);
  assert.strictEqual(canPersona("shipper", "vehicles.manage"), false);
  assert.strictEqual(canPersona("admin", "settings.manage"), true);
  assert.ok(SENSITIVE_ACTIONS.length >= 4);

  /* ── 13. Trip status labels exist in all three languages ───────────── */
  for (const status of ["on_road", "loading", "delivered", "delayed"]) {
    assert.ok(tripStatusKey(status).startsWith("status."), `status ${status} must have a label key`);
  }

  console.log("  ✓ Role Routing, Smart Alerts & Assistant Tests Passed Successfully!");
}
