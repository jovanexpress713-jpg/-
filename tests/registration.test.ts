import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import type { AddressInfo } from "net";

/**
 * EJAZ Transport — Registration, Review & Approval tests.
 *
 * Proves the core rule: creating an account from the application is a REQUEST.
 * Only an administration decision activates the account and its privileges.
 *
 * Covered end to end:
 *   1. incomplete submission is rejected and reports exactly what is missing
 *   2. a complete submission becomes PENDING_REVIEW and lands in the queue
 *   3. the account can sign in but receives no account privileges yet
 *   4. NEEDS_COMPLETION with the missing items → applicant resubmits → PENDING_REVIEW
 *   5. rejection requires a reason and the reason reaches the applicant
 *   6. approval activates the account (driver profile linked, privileges granted)
 *   7. every decision is written to the audit trail with actor, states and reason
 */

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "ejaz-registrations-"));
process.env.REGISTRATION_STORE_PATH = path.join(SANDBOX, "registration-requests.json");
process.env.REGISTRATION_UPLOAD_ROOT = path.join(SANDBOX, "uploads", "registrations");

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/1e4WAAAAAElFTkSuQmCC";

let server: http.Server | null = null;
let baseUrl = "";

async function api(method: string, url: string, options: { token?: string; body?: any } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const res = await fetch(baseUrl + url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { status: res.status, body, contentType: res.headers.get("content-type") || "" };
}

const DRIVER_FIELDS = {
  fullName: "سعود بن مبارك الحربي",
  phone: "+966555123456",
  email: "saud.driver@example.com",
  nationalId: "1098765432",
  city: "الرياض",
  licenseNumber: "DL-778899",
  licenseExpiry: "2028-05-01",
  vehicleType: "ستارة",
  vehiclePlate: "RJD 7788",
};

const DRIVER_DOCUMENTS = [
  { kind: "nationalId", fileName: "id.png", data: TINY_PNG },
  { kind: "drivingLicense", fileName: "license.png", data: TINY_PNG },
  { kind: "vehicleRegistration", fileName: "registration.png", data: TINY_PNG },
  { kind: "vehiclePhoto", fileName: "truck.png", data: TINY_PNG },
];

export async function runRegistrationTests() {
  console.log("  [TEST] Running Registration, Review & Approval Tests...");

  const { createServerApp } = await import("../src/server/app");
  server = http.createServer(createServerApp());
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Public signup must not mutate an existing account or accept a path-like document kind.
  const existingAccountRequest = await api("POST", "/api/registrations", {
    body: {
      type: "DRIVER",
      password: "Password-2026",
      fields: { fullName: "Attempted takeover", email: "driver@ejaz.sa", phone: "+966500000001" },
      documents: [],
    },
  });
  assert.strictEqual(existingAccountRequest.status, 409, "public registration cannot attach to an existing account");
  assert.strictEqual(existingAccountRequest.body.code, "EMAIL_ALREADY_REGISTERED");

  const traversal = await api("POST", "/api/registrations", {
    body: {
      type: "DRIVER",
      password: "Password-2026",
      fields: { fullName: "Invalid document", email: "invalid.document@example.com", phone: "+966500000009" },
      documents: [{ kind: "../../../../outside", fileName: "x.png", data: TINY_PNG }],
    },
  });
  assert.strictEqual(traversal.status, 400, "document kinds are allow-listed before any file is written");
  assert.strictEqual(traversal.body.code, "INVALID_DOCUMENT_KIND");

  // ---------------------------------------------------------------- 1
  const incomplete = await api("POST", "/api/registrations", {
    body: {
      type: "DRIVER",
      password: "Ejaz@2027Driver",
      fields: { fullName: "خالد ناقص", email: DRIVER_FIELDS.email, phone: "+966500000001" },
      documents: [],
      submit: true,
    },
  });
  assert.strictEqual(incomplete.status, 422, "an incomplete submission must not be accepted");
  assert.strictEqual(incomplete.body.code, "INCOMPLETE_SUBMISSION");
  const missingKeys = incomplete.body.validation.missingFields.map((f: any) => f.key);
  assert.ok(missingKeys.includes("nationalId"), "the missing fields must be reported to the applicant");
  assert.strictEqual(incomplete.body.validation.missingDocuments.length, 4, "all required driver documents must be listed");
  assert.strictEqual(incomplete.body.request.status, "DRAFT", "an incomplete request stays a draft");

  // ---------------------------------------------------------------- 2
  const submitted = await api("POST", "/api/registrations", {
    body: {
      type: "DRIVER",
      password: "Ejaz@2027Driver",
      fields: DRIVER_FIELDS,
      documents: DRIVER_DOCUMENTS,
      submit: true,
    },
  });
  assert.strictEqual(submitted.status, 201);
  assert.strictEqual(submitted.body.request.status, "PENDING_REVIEW", "a complete request becomes PENDING_REVIEW");
  assert.match(submitted.body.request.id, /^EJ-REG-\d{4}-\d{6}$/, "every request receives an official number");
  assert.match(submitted.body.messageAr, /تم استلام طلبك بنجاح/, "the applicant gets the official acknowledgement");
  assert.strictEqual(submitted.body.request.documents.length, 4, "the four documents are stored with the request");
  const initialSubmissionActions = submitted.body.request.history.map((entry: any) => entry.action);
  assert.ok(initialSubmissionActions.includes("SUBMITTED"), "completing an existing draft is recorded as its first submission");
  assert.ok(!initialSubmissionActions.includes("RESUBMITTED"), "a draft is not misclassified as a resubmission");
  assert.ok(
    submitted.body.request.documents.every((d: any) =>
      fs.existsSync(path.join(SANDBOX, "uploads", "registrations", submitted.body.request.id, `${d.id}.png`))
    ),
    "documents are written to the private upload directory"
  );
  assert.ok(
    submitted.body.request.documents.every((d: any) => d.url.startsWith(`/api/registrations/${submitted.body.request.id}/documents/`)),
    "document URLs use the authenticated API rather than a public static path"
  );

  // the request is already visible to the administration
  const adminLogin = await api("POST", "/api/auth/login", {
    body: { email: "admin@ejaz.sa", password: "Ejaz@2026Admin" },
  });
  const adminToken = adminLogin.body.token;
  assert.ok(adminToken, "administrator session required for the review queue");

  const firstDocument = submitted.body.request.documents[0];
  const anonymousDocument = await api("GET", firstDocument.url);
  assert.strictEqual(anonymousDocument.status, 401, "private registration files require authentication");
  const legacyPublicDocument = await api(
    "GET",
    `/uploads/registrations/${submitted.body.request.id}/${firstDocument.kind}.png`
  );
  assert.strictEqual(legacyPublicDocument.status, 404, "the static upload mount must never expose registration documents");
  const adminDocument = await api("GET", firstDocument.url, { token: adminToken });
  assert.strictEqual(adminDocument.status, 200, "authorized reviewers can open an application document");
  assert.ok(adminDocument.contentType.startsWith("image/png"));

  const queue = await api("GET", "/api/registrations", { token: adminToken });
  assert.strictEqual(queue.status, 200);
  assert.ok(queue.body.requests.some((r: any) => r.id === submitted.body.request.id), "the request reaches the control panel");
  assert.ok(queue.body.pending >= 1);

  // ---------------------------------------------------------------- 3
  const driverLogin = await api("POST", "/api/auth/login", {
    body: { email: DRIVER_FIELDS.email, password: "Ejaz@2027Driver" },
  });
  assert.strictEqual(driverLogin.status, 200, "the applicant can sign in to follow the request");
  assert.strictEqual(driverLogin.body.user.registrationStatus, "PENDING_REVIEW");
  assert.strictEqual(driverLogin.body.user.accountApproved, false);
  assert.deepStrictEqual(
    driverLogin.body.user.permissions,
    ["registration.status_own"],
    "an unapproved account receives no account privileges"
  );

  const ownStatus = await api("GET", "/api/registrations/me", { token: driverLogin.body.token });
  assert.strictEqual(ownStatus.body.status, "PENDING_REVIEW");
  assert.strictEqual(ownStatus.body.statusAr, "جاري المراجعة");

  const pendingTripAccess = await api("GET", "/api/trips", { token: driverLogin.body.token });
  assert.strictEqual(pendingTripAccess.status, 403, "the pending applicant cannot use operational API permissions");
  assert.strictEqual(pendingTripAccess.body.code, "ACCOUNT_PENDING_APPROVAL");
  const applicantDocument = await api("GET", firstDocument.url, { token: driverLogin.body.token });
  assert.strictEqual(applicantDocument.status, 200, "an applicant can read only their own uploaded document");

  // ---------------------------------------------------------------- 4
  const askCompletion = await api("POST", `/api/registrations/${submitted.body.request.id}/decision`, {
    token: adminToken,
    body: { action: "NEEDS_COMPLETION", reason: "صورة رخصة القيادة غير واضحة", missingItems: ["drivingLicense"] },
  });
  assert.strictEqual(askCompletion.status, 200);
  assert.strictEqual(askCompletion.body.request.status, "NEEDS_COMPLETION");

  const { db } = await import("../src/server/db");
  const { getRequest, resubmitRegistration } = await import("../src/server/services/registrationService");
  const linkedAccount = db.users.get(driverLogin.body.user.id);
  assert.ok(linkedAccount, "the applicant account is linked to the registration request");
  const originalRegistrationId = linkedAccount.registrationId;
  const requestSnapshot = JSON.parse(JSON.stringify(getRequest(submitted.body.request.id)));
  const storedFiles = fs.readdirSync(path.join(SANDBOX, "uploads", "registrations", submitted.body.request.id)).sort();
  linkedAccount.registrationId = "EJ-REG-2026-999999";
  try {
    assert.throws(
      () => resubmitRegistration(
        submitted.body.request.id,
        { fields: { fullName: "Tampered applicant" }, documents: [{ kind: "drivingLicense", fileName: "tampered.png", data: TINY_PNG }] },
        { userId: linkedAccount.id, email: linkedAccount.email }
      ),
      (err: any) => err.code === "ACCOUNT_LINK_MISMATCH",
      "resubmission rejects a mismatched account link before touching the request"
    );
  } finally {
    linkedAccount.registrationId = originalRegistrationId;
    db.users.set(linkedAccount.id, linkedAccount);
  }
  const requestAfterMismatch = getRequest(submitted.body.request.id);
  assert.strictEqual(requestAfterMismatch?.fullName, requestSnapshot.fullName);
  assert.deepStrictEqual(requestAfterMismatch?.documents.map((document) => document.id), requestSnapshot.documents.map((document: any) => document.id));
  assert.deepStrictEqual(
    fs.readdirSync(path.join(SANDBOX, "uploads", "registrations", submitted.body.request.id)).sort(),
    storedFiles,
    "a rejected resubmission does not leave new document files behind"
  );

  const afterCompletionRequest = await api("GET", "/api/registrations/me", { token: driverLogin.body.token });
  assert.strictEqual(afterCompletionRequest.body.status, "NEEDS_COMPLETION", "the applicant sees the new state");
  assert.ok(
    afterCompletionRequest.body.request.completionRequests.includes("صورة رخصة القيادة"),
    "the administration's requested item reaches the applicant"
  );

  const resubmitted = await api("POST", "/api/registrations/me/resubmit", {
    token: driverLogin.body.token,
    body: { documents: [{ kind: "drivingLicense", fileName: "license-clear.png", data: TINY_PNG }] },
  });
  assert.strictEqual(resubmitted.status, 200);
  assert.strictEqual(resubmitted.body.request.status, "PENDING_REVIEW", "NEEDS_COMPLETION → PENDING_REVIEW after resubmission");

  // ---------------------------------------------------------------- 5
  const rejectionWithoutReason = await api("POST", `/api/registrations/${submitted.body.request.id}/decision`, {
    token: adminToken,
    body: { action: "REJECT" },
  });
  assert.strictEqual(rejectionWithoutReason.status, 400, "a rejection without a reason must be refused");
  assert.strictEqual(rejectionWithoutReason.body.code, "REASON_REQUIRED");

  // A second applicant is used to prove the rejection path end to end.
  const customerSubmission = await api("POST", "/api/registrations", {
    body: {
      type: "CUSTOMER",
      password: "Ejaz@2027Client",
      fields: {
        fullName: "نورة العتيبي",
        companyName: "شركة نماء اللوجستية",
        phone: "+966500000002",
        email: "noura@nama-logistics.example",
        commercialReg: "1010555021",
        vatNumber: "300155502100003",
        city: "جدة",
        address: "المنطقة الصناعية الثانية",
      },
      documents: [
        { kind: "commercialRegistration", fileName: "cr.png", data: TINY_PNG },
        { kind: "vatCertificate", fileName: "vat.png", data: TINY_PNG },
        { kind: "nationalAddress", fileName: "address.png", data: TINY_PNG },
      ],
      submit: true,
    },
  });
  assert.strictEqual(customerSubmission.body.request.status, "PENDING_REVIEW");
  const foreignDocument = await api("GET", customerSubmission.body.request.documents[0].url, { token: driverLogin.body.token });
  assert.strictEqual(foreignDocument.status, 403, "an applicant cannot read another applicant's identity documents");

  const rejected = await api("POST", `/api/registrations/${customerSubmission.body.request.id}/decision`, {
    token: adminToken,
    body: { action: "REJECT", reason: "الوثائق المرفقة غير مكتملة" },
  });
  assert.strictEqual(rejected.body.request.status, "REJECTED");

  const customerLogin = await api("POST", "/api/auth/login", {
    body: { email: "noura@nama-logistics.example", password: "Ejaz@2027Client" },
  });
  const customerStatus = await api("GET", "/api/registrations/me", { token: customerLogin.body.token });
  assert.strictEqual(customerStatus.body.status, "REJECTED");
  assert.strictEqual(
    customerStatus.body.request.decisionReason,
    "الوثائق المرفقة غير مكتملة",
    "the rejection reason is shown to the applicant"
  );
  const rejectedAccountAccess = await api("GET", "/api/trips", { token: customerLogin.body.token });
  assert.strictEqual(rejectedAccountAccess.status, 403, "a rejected application does not receive customer API access");

  // ---------------------------------------------------------------- 6
  const approved = await api("POST", `/api/registrations/${submitted.body.request.id}/decision`, {
    token: adminToken,
    body: { action: "APPROVE" },
  });
  assert.strictEqual(approved.body.request.status, "APPROVED");

  const approvedLogin = await api("POST", "/api/auth/login", {
    body: { email: DRIVER_FIELDS.email, password: "Ejaz@2027Driver" },
  });
  assert.strictEqual(approvedLogin.body.user.accountApproved, true, "the account is activated after approval");
  assert.strictEqual(approvedLogin.body.user.registrationStatus, "APPROVED");
  assert.ok(
    approvedLogin.body.user.permissions.includes("trips.transition"),
    "the driver receives the privileges of a driver account"
  );
  assert.ok(approvedLogin.body.user.driverId, "the driver profile is linked to the account");
  const oldSessionAfterApproval = await api("GET", "/api/trips", { token: driverLogin.body.token });
  assert.strictEqual(oldSessionAfterApproval.status, 200, "the live approval state unlocks an existing applicant session");

  const notifications = await api("GET", "/api/notifications", { token: approvedLogin.body.token });
  assert.ok(
    notifications.body.notifications.some((n: any) => /تمت الموافقة على طلبك/.test(n.titleAr)),
    "an approval notification is delivered inside the application"
  );

  // ---------------------------------------------------------------- 7
  const audit = await api("GET", `/api/registrations/${submitted.body.request.id}`, { token: adminToken });
  const history = audit.body.history as any[];
  const actions = history.map((h) => h.action);
  ["CREATED", "SUBMITTED", "NEEDS_COMPLETION", "RESUBMITTED", "APPROVED"].forEach((action) => {
    assert.ok(actions.includes(action), `the audit trail must record ${action} — got ${actions.join(", ")}`);
  });

  const completionEntry = history.find((h) => h.action === "NEEDS_COMPLETION");
  assert.strictEqual(completionEntry.fromStatus, "PENDING_REVIEW", "the previous state is recorded");
  assert.strictEqual(completionEntry.toStatus, "NEEDS_COMPLETION", "the new state is recorded");
  assert.ok(completionEntry.actorName, "the reviewing employee is recorded");
  assert.ok(completionEntry.at, "the decision timestamp is recorded");
  assert.ok(completionEntry.missingItems.includes("صورة رخصة القيادة"), "the requested items are recorded");

  // Role separation: only the administration may review.
  const forbidden = await api("GET", "/api/registrations", { token: driverLogin.body.token });
  assert.strictEqual(forbidden.status, 403, "an applicant cannot read the review queue");

  server.close();
  server = null;
  console.log("  ✓ Registration, Review & Approval Tests Passed Successfully!");
}
