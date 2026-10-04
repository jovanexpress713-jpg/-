/** Live RBAC probe against the running dev server (port 3000). */
const BASE = "http://127.0.0.1:3000";
let pass = 0, fail = 0;

async function api(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data; const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, body: data };
}
function check(label, cond, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}  ${detail}`); }
}
async function login(email, password) {
  const r = await api("POST", "/api/auth/login", null, { email, password });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

const admin = await login("admin@ejaz.sa", "Ejaz@2026Admin");
const ops = await login("ops@ejaz.sa", "Ejaz@2026Admin");
const acct = await login("finance@ejaz.sa", "Ejaz@2026Admin");
const client = await login("client@ejaz.sa", "Ejaz@2026Client");
console.log("— sessions —");
check("4 roles signed in", !!admin.token && !!ops.token && !!acct.token && !!client.token);
check("ops token carries no finance.view", !(ops.user.permissions || []).includes("finance.view"));

console.log("\n— 1. baseline visibility per role —");
let me = await api("GET", "/api/permissions/me", ops.token);
check("ops sees fleet + trips", me.body.pages.includes("fleet") && me.body.pages.includes("trips"), JSON.stringify(me.body.pages));
check("ops has no permissions page", !me.body.pages.includes("permissions"));
check("ops cannot manage permissions", me.body.canManagePermissions === false);
const meA = await api("GET", "/api/permissions/me", admin.token);
check("admin wildcard + canManagePermissions", meA.body.wildcard === true && meA.body.canManagePermissions === true);

console.log("\n— 2. revoking a page removes it AND blocks the API (same token) —");
let v = await api("GET", "/api/vehicles", ops.token);
check("ops reads /api/vehicles before", v.status === 200, `status=${v.status}`);
const opsGrant = (await api("GET", "/api/permissions/roles/OPERATIONS_MANAGER", admin.token)).body.role.permissions;
const vBefore = await api("GET", "/api/permissions/changes", ops.token);
const rev = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", admin.token, {
  permissions: opsGrant.filter(k => !k.startsWith("vehicles.")),
  reason: "إخفاء الشاحنات عن مدير العمليات — فحص حي",
});
check("admin save 200", rev.status === 200, JSON.stringify(rev.body));
check("diff reports removal", (rev.body.removed || []).includes("vehicles.view"), JSON.stringify(rev.body.removed));
v = await api("GET", "/api/vehicles", ops.token);
check("ops /api/vehicles now 403 (live, same token)", v.status === 403, `status=${v.status} ${JSON.stringify(v.body).slice(0,120)}`);
me = await api("GET", "/api/permissions/me", ops.token);
check("fleet page gone from /me", !me.body.pages.includes("fleet"));
check("vehicle-assets page gone too", !me.body.pages.includes("vehicle-assets"));
check("trips page still there", me.body.pages.includes("trips"));
const vAfter = await api("GET", "/api/permissions/changes", ops.token);
check("registry version moved (clients can detect it)", vAfter.body.version > vBefore.body.version, `${vBefore.body.version} -> ${vAfter.body.version}`);

console.log("\n— 3. granting it back restores access —");
const grant = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", admin.token, { permissions: opsGrant, reason: "إعادة الشاحنات" });
check("save 200", grant.status === 200);
v = await api("GET", "/api/vehicles", ops.token);
check("ops /api/vehicles 200 again", v.status === 200, `status=${v.status}`);

console.log("\n— 4. function-level: view stays, edit goes —");
const g2 = (await api("GET", "/api/permissions/roles/OPERATIONS_MANAGER", admin.token)).body.role.permissions;
await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", admin.token, { permissions: g2.filter(k => k !== "trips.edit") });
me = await api("GET", "/api/permissions/me", ops.token);
check("trips.view kept", me.body.permissions.includes("trips.view"));
check("trips.edit dropped", !me.body.permissions.includes("trips.edit"));
check("trips page still visible", me.body.pages.includes("trips"));
await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", admin.token, { permissions: g2 });

console.log("\n— 5. privilege escalation is refused —");
const selfEsc = await api("PUT", "/api/permissions/roles/OPERATIONS_MANAGER", ops.token, { permissions: ["*"] });
check("ops cannot grant itself", selfEsc.status === 403, `status=${selfEsc.status}`);
const readCat = await api("GET", "/api/permissions/catalog", ops.token);
check("ops cannot read catalogue", readCat.status === 403, `status=${readCat.status}`);
const acctEsc = await api("PUT", "/api/permissions/roles/ACCOUNTANT", acct.token, { permissions: ["*"] });
check("accountant cannot edit roles", acctEsc.status === 403, `status=${acctEsc.status}`);
const lockSelf = await api("PUT", "/api/permissions/roles/SUPER_ADMIN", admin.token, { permissions: [] });
check("SUPER_ADMIN locked (409)", lockSelf.status === 409 && lockSelf.body.code === "ROLE_LOCKED", JSON.stringify(lockSelf.body));

console.log("\n— 6. audit trail —");
const audit = await api("GET", "/api/permissions/audit", admin.token);
const opsEntries = audit.body.entries.filter(e => e.entityId === "OPERATIONS_MANAGER");
check("audit has OPS entries", opsEntries.length >= 3, `count=${opsEntries.length}`);
const newest = opsEntries[0];
check("newest entry first", opsEntries[0].timestamp >= opsEntries[opsEntries.length - 1].timestamp);
check("entry names the actor", !!newest.actorName, JSON.stringify(newest).slice(0, 200));
check("entry keeps old + new grants", Array.isArray(newest.oldValues?.permissions) && Array.isArray(newest.newValues?.permissions));
check("entry has action + timestamp", newest.action === "ROLE_PERMISSIONS_UPDATED" && !!newest.timestamp);
const auditDenied = await api("GET", "/api/permissions/audit", ops.token);
check("audit is admin-only", auditDenied.status === 403);

console.log("\n— 7. financial data separation (req 18) —");
const opsTrips = await api("GET", "/api/trips", ops.token);
const acctTrips = await api("GET", "/api/trips", acct.token);
check("ops told financials withheld", opsTrips.body.financialsVisible === false);
check("ops sees no tripPrice", opsTrips.body.trips.every(t => t.tripPrice === undefined), JSON.stringify(opsTrips.body.trips[0] || {}).slice(0, 160));
check("ops payload marked redacted", opsTrips.body.trips.every(t => t.financialsRedacted === true));
check("accountant sees financials", acctTrips.body.financialsVisible === true);
check("accountant receives tripPrice", acctTrips.body.trips.some(t => typeof t.tripPrice === "number"));

console.log("\n— 8. object-level data scoping (req 12) —");
const all = await api("GET", "/api/trips", admin.token);
const foreign = all.body.trips.find(t => t.customerId !== "cust-1");
if (foreign) {
  const peek = await api("GET", `/api/trips/${foreign.id}`, client.token);
  check("client cannot open another client's trip by id", peek.status === 403, `status=${peek.status} trip=${foreign.tripNumber}`);
  const byNum = await api("GET", `/api/trips/${foreign.tripNumber}`, client.token);
  check("client cannot open it by trip number either", byNum.status === 403, `status=${byNum.status}`);
} else {
  console.log("  ! no foreign trip available to test with");
}
const own = await api("GET", "/api/client/trips", client.token);
check("client list only own shipments", own.body.trips.every(t => t.customerId === "cust-1"));

console.log("\n— 9. persistence + teardown —");
const fs = await import("fs");
check("overrides persisted to data/role-permissions.json", fs.existsSync("data/role-permissions.json"));
const reset = await api("POST", "/api/permissions/roles/OPERATIONS_MANAGER/reset", admin.token);
check("reset 200", reset.status === 200);
v = await api("GET", "/api/vehicles", ops.token);
check("ops back to defaults", v.status === 200);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
