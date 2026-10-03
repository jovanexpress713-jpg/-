/**
 * Live end-to-end proof of the registration → review → approval flow against a
 * running server, exactly as the mobile app and the control panel use it.
 *
 * Usage: start the server, then `npm run verify:registration`.
 */
const BASE = "http://127.0.0.1:3000";
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/1e4WAAAAAElFTkSuQmCC";

const call = async (method, url, { token, body } = {}) => {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* raw */
  }
  return { status: res.status, body: parsed };
};

const stamp = Date.now();
const email = `verify.driver.${stamp}@example.com`;

console.log("1) incomplete request is refused with the exact missing items");
const incomplete = await call("POST", "/api/registrations", {
  body: { type: "DRIVER", password: "Ejaz@2027Driver", fields: { fullName: "مقدم طلب", email, phone: "+966500000123" }, documents: [] },
});
console.log(`   HTTP ${incomplete.status} · fields missing: ${incomplete.body?.validation?.missingFields?.length} · documents missing: ${incomplete.body?.validation?.missingDocuments?.length}`);

console.log("2) complete request → PENDING_REVIEW");
const submitted = await call("POST", "/api/registrations", {
  body: {
    type: "DRIVER",
    password: "Ejaz@2027Driver",
    fields: {
      fullName: "مقدم طلب للتحقق",
      phone: "+966500000123",
      email,
      nationalId: "1010101010",
      city: "الرياض",
      licenseNumber: "DL-100200",
      licenseExpiry: "2029-01-01",
      vehicleType: "سطحة",
      vehiclePlate: "RJD 1002",
    },
    documents: [
      { kind: "nationalId", fileName: "id.png", data: TINY_PNG },
      { kind: "drivingLicense", fileName: "lic.png", data: TINY_PNG },
      { kind: "vehicleRegistration", fileName: "reg.png", data: TINY_PNG },
      { kind: "vehiclePhoto", fileName: "truck.png", data: TINY_PNG },
    ],
    submit: true,
  },
});
console.log(`   ${submitted.body?.request?.id} → ${submitted.body?.status} · ${submitted.body?.messageAr}`);

console.log("3) the applicant can sign in but holds no account privileges");
const applicant = await call("POST", "/api/auth/login", { body: { email, password: "Ejaz@2027Driver" } });
console.log(`   ${applicant.body?.user?.registrationStatusAr} · approved=${applicant.body?.user?.accountApproved} · permissions=${JSON.stringify(applicant.body?.user?.permissions)}`);

console.log("4) the request appears in the control panel");
const admin = await call("POST", "/api/auth/login", { body: { email: "admin@ejaz.sa", password: "Ejaz@2026Admin" } });
const adminToken = admin.body?.token;
const queue = await call("GET", "/api/registrations?status=PENDING_REVIEW", { token: adminToken });
console.log(`   queue: ${queue.body?.total} pending · contains our request: ${queue.body?.requests?.some((r) => r.id === submitted.body.request.id)}`);

console.log("5) the administration asks for completion");
const completion = await call("POST", `/api/registrations/${submitted.body.request.id}/decision`, {
  token: adminToken,
  body: { action: "NEEDS_COMPLETION", reason: "صورة رخصة القيادة غير واضحة", missingItems: ["drivingLicense"] },
});
console.log(`   status=${completion.body?.status} · requested=${JSON.stringify(completion.body?.request?.completionRequests)}`);

console.log("6) rejection without a reason is blocked");
const badReject = await call("POST", `/api/registrations/${submitted.body.request.id}/decision`, {
  token: adminToken,
  body: { action: "REJECT" },
});
console.log(`   HTTP ${badReject.status} · ${badReject.body?.error}`);

console.log("7) the applicant completes and re-sends → back to review");
const resubmit = await call("POST", "/api/registrations/me/resubmit", {
  token: applicant.body.token,
  body: { documents: [{ kind: "drivingLicense", fileName: "lic-clear.png", data: TINY_PNG }] },
});
console.log(`   status=${resubmit.body?.status} · ${resubmit.body?.messageAr}`);

console.log("8) approval activates the account");
const approved = await call("POST", `/api/registrations/${submitted.body.request.id}/decision`, { token: adminToken, body: { action: "APPROVE" } });
const after = await call("POST", "/api/auth/login", { body: { email, password: "Ejaz@2027Driver" } });
console.log(`   request=${approved.body?.status} · account approved=${after.body?.user?.accountApproved} · driverId=${after.body?.user?.driverId} · permissions=${after.body?.user?.permissions?.length}`);

console.log("9) notifications + audit trail");
const notifs = await call("GET", "/api/notifications", { token: after.body.token });
console.log(`   notifications: ${notifs.body?.notifications?.map((n) => n.titleAr).slice(0, 3).join(" | ")}`);
const detail = await call("GET", `/api/registrations/${submitted.body.request.id}`, { token: adminToken });
console.log(`   audit trail: ${detail.body?.history?.map((h) => h.action).join(" → ")}`);
console.log(`   reviewed by: ${detail.body?.history?.find((h) => h.action === "APPROVED")?.actorName}`);

const ok =
  incomplete.status === 422 &&
  submitted.body?.status === "PENDING_REVIEW" &&
  applicant.body?.user?.accountApproved === false &&
  badReject.status === 400 &&
  resubmit.body?.status === "PENDING_REVIEW" &&
  after.body?.user?.accountApproved === true &&
  (detail.body?.history || []).some((h) => h.action === "APPROVED");
console.log(ok ? "\n✅ REGISTRATION → REVIEW → APPROVAL VERIFIED LIVE" : "\n❌ VERIFICATION FAILED");
process.exit(ok ? 0 : 1);
