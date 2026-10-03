/**
 * EJAZ Transport — Account Registration, Review & Approval Service
 *
 * Creating an account in the application is NOT an automatic approval.
 * It is a formal registration request that must be reviewed and approved by the
 * administration before the account is activated.
 *
 * Official, non-overlapping request states:
 *   DRAFT             مسودة            — not submitted yet
 *   PENDING_REVIEW    جاري المراجعة     — submitted, awaiting the administration
 *   NEEDS_COMPLETION  يحتاج استكمال     — administration asked for more data/documents
 *   APPROVED          تمت الموافقة      — account activated
 *   REJECTED          مرفوض            — declined, with a mandatory reason
 *
 * Every administrative decision is written to the request's audit trail:
 * request number, type, user, previous state, new state, the reviewing employee,
 * the timestamp and the reason (for rejection / completion requests).
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import type { UserEntity } from "../db";
import bcrypt from "bcryptjs";
import { logAuditEvent } from "./auditService";
import { dispatchNotification } from "./notificationService";

/* ------------------------------------------------------------------ */
/* Domain model                                                        */
/* ------------------------------------------------------------------ */

export const REGISTRATION_TYPES = ["DRIVER", "CUSTOMER"] as const;
export type RegistrationType = (typeof REGISTRATION_TYPES)[number];

export const REGISTRATION_STATUSES = [
  "DRAFT",
  "PENDING_REVIEW",
  "NEEDS_COMPLETION",
  "APPROVED",
  "REJECTED",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

/** Arabic labels for the four account-approval states (used by every screen). */
export const REGISTRATION_STATUS_AR: Record<RegistrationStatus, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "جاري المراجعة",
  NEEDS_COMPLETION: "يحتاج استكمال",
  APPROVED: "تمت الموافقة",
  REJECTED: "مرفوض",
};

export const REGISTRATION_STATUS_EN: Record<RegistrationStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  NEEDS_COMPLETION: "Needs completion",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export interface FieldSpec {
  key: string;
  labelAr: string;
  labelEn: string;
  required: boolean;
  kind?: "text" | "tel" | "email" | "date" | "number" | "select" | "textarea";
  options?: string[];
}

/** Documents every applicant must attach, per account type. */
export interface DocumentSpec {
  kind: string;
  labelAr: string;
  labelEn: string;
}

const VEHICLE_TYPE_OPTIONS = ["سطحة", "براد", "جاف", "ستارة"];

export const REGISTRATION_FIELDS: Record<RegistrationType, FieldSpec[]> = {
  DRIVER: [
    { key: "fullName", labelAr: "الاسم الكامل", labelEn: "Full name", required: true },
    { key: "phone", labelAr: "رقم الجوال", labelEn: "Mobile number", required: true, kind: "tel" },
    { key: "email", labelAr: "البريد الإلكتروني", labelEn: "Email", required: true, kind: "email" },
    { key: "nationalId", labelAr: "رقم الهوية الوطنية", labelEn: "National ID", required: true },
    { key: "birthDate", labelAr: "تاريخ الميلاد", labelEn: "Date of birth", required: false, kind: "date" },
    { key: "city", labelAr: "المدينة", labelEn: "City", required: true },
    { key: "address", labelAr: "العنوان", labelEn: "Address", required: false, kind: "textarea" },
    { key: "licenseNumber", labelAr: "رقم رخصة القيادة", labelEn: "Driving licence number", required: true },
    { key: "licenseExpiry", labelAr: "تاريخ انتهاء الرخصة", labelEn: "Licence expiry", required: true, kind: "date" },
    { key: "licenseClass", labelAr: "فئة الرخصة", labelEn: "Licence class", required: false },
    { key: "experienceYears", labelAr: "سنوات الخبرة", labelEn: "Years of experience", required: false, kind: "number" },
    { key: "vehicleType", labelAr: "نوع الشاحنة", labelEn: "Truck type", required: true, kind: "select", options: VEHICLE_TYPE_OPTIONS },
    { key: "vehiclePlate", labelAr: "رقم لوحة الشاحنة", labelEn: "Truck plate", required: true },
    { key: "vehicleModel", labelAr: "موديل الشاحنة", labelEn: "Truck model", required: false },
    { key: "vehicleYear", labelAr: "سنة الصنع", labelEn: "Year", required: false, kind: "number" },
    { key: "notes", labelAr: "ملاحظات إضافية", labelEn: "Additional notes", required: false, kind: "textarea" },
  ],
  CUSTOMER: [
    { key: "fullName", labelAr: "اسم مسؤول التواصل", labelEn: "Contact person", required: true },
    { key: "companyName", labelAr: "اسم المنشأة", labelEn: "Company name", required: true },
    { key: "phone", labelAr: "رقم الجوال", labelEn: "Mobile number", required: true, kind: "tel" },
    { key: "email", labelAr: "البريد الإلكتروني", labelEn: "Email", required: true, kind: "email" },
    { key: "commercialReg", labelAr: "رقم السجل التجاري", labelEn: "Commercial registration", required: true },
    { key: "vatNumber", labelAr: "الرقم الضريبي", labelEn: "VAT number", required: true },
    { key: "city", labelAr: "المدينة", labelEn: "City", required: true },
    { key: "address", labelAr: "العنوان الوطني", labelEn: "National address", required: true, kind: "textarea" },
    { key: "activityType", labelAr: "نشاط المنشأة", labelEn: "Activity", required: false },
    { key: "notes", labelAr: "ملاحظات إضافية", labelEn: "Additional notes", required: false, kind: "textarea" },
  ],
};

export const REGISTRATION_DOCUMENTS: Record<RegistrationType, DocumentSpec[]> = {
  DRIVER: [
    { kind: "nationalId", labelAr: "صورة الهوية الوطنية", labelEn: "National ID copy" },
    { kind: "drivingLicense", labelAr: "صورة رخصة القيادة", labelEn: "Driving licence copy" },
    { kind: "vehicleRegistration", labelAr: "رخصة سير الشاحنة", labelEn: "Truck registration" },
    { kind: "vehiclePhoto", labelAr: "صورة الشاحنة", labelEn: "Truck photograph" },
  ],
  CUSTOMER: [
    { kind: "commercialRegistration", labelAr: "السجل التجاري", labelEn: "Commercial registration" },
    { kind: "vatCertificate", labelAr: "شهادة الضريبة", labelEn: "VAT certificate" },
    { kind: "nationalAddress", labelAr: "العنوان الوطني", labelEn: "National address document" },
  ],
};

export interface RegistrationDocument {
  id: string;
  kind: string;
  labelAr: string;
  labelEn: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  /** Authenticated endpoint; never a public static URL. */
  url: string;
  uploadedAt: string;
}

export type RegistrationAction =
  | "CREATED"
  | "SUBMITTED"
  | "RESUBMITTED"
  | "APPROVED"
  | "NEEDS_COMPLETION"
  | "REJECTED";

export interface RegistrationHistoryEntry {
  id: string;
  at: string;
  action: RegistrationAction;
  fromStatus: RegistrationStatus | null;
  toStatus: RegistrationStatus;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  reason?: string;
  /** Items the administration asked the applicant to complete. */
  missingItems?: string[];
}

export interface RegistrationRequest {
  id: string;
  type: RegistrationType;
  status: RegistrationStatus;
  userId?: string;
  fullName: string;
  email: string;
  phone: string;
  fields: Record<string, string>;
  documents: RegistrationDocument[];
  /** Items flagged by the administration on a NEEDS_COMPLETION decision. */
  completionRequests: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  decidedAt?: string;
  reviewerId?: string;
  reviewerName?: string;
  decisionReason?: string;
  accountCreated: boolean;
  history: RegistrationHistoryEntry[];
}

export interface ValidationResult {
  complete: boolean;
  missingFields: { key: string; labelAr: string; labelEn: string }[];
  missingDocuments: { kind: string; labelAr: string; labelEn: string }[];
  invalidFields: { key: string; labelAr: string; reasonAr: string }[];
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const REQUEST_ID_PATTERN = /^EJ-REG-\d{4}-\d{6}$/;
const DOCUMENT_ID_PATTERN = /^regd-[0-9a-f-]{36}$/i;

function privateRuntimePath(target: string): string {
  const resolved = path.resolve(target);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    throw registrationError("Registration data must be stored outside the public directory", 500, "INSECURE_STORAGE_CONFIG");
  }
  return resolved;
}

function storePath(): string {
  return privateRuntimePath(
    process.env.REGISTRATION_STORE_PATH || path.resolve(process.cwd(), "data", "registration-requests.json")
  );
}

/** Identity and company documents are private data: keep them outside /public. */
function uploadRoot(): string {
  return privateRuntimePath(
    process.env.REGISTRATION_UPLOAD_ROOT || path.resolve(process.cwd(), "data", "registration-uploads")
  );
}

function registrationError(message: string, status = 400, code = "INVALID_REGISTRATION") {
  return Object.assign(new Error(message), { status, code });
}

interface StoreShape {
  version: number;
  updatedAt: string;
  sequence: number;
  requests: RegistrationRequest[];
}

let cache: StoreShape | null = null;

function readStore(): StoreShape {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    cache = {
      version: parsed.version ?? 1,
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      sequence: parsed.sequence ?? parsed.requests?.length ?? 0,
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
    };
  } catch {
    cache = { version: 1, updatedAt: new Date().toISOString(), sequence: 0, requests: [] };
  }
  return cache;
}

function writeStore(store: StoreShape) {
  store.updatedAt = new Date().toISOString();
  const target = storePath();
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, target);
  try {
    fs.chmodSync(target, 0o600);
  } catch {
    /* The file remains usable on filesystems without POSIX permission support. */
  }
  cache = store;
}

/** Test/ops hook: drops the in-memory cache so the file is re-read. */
export function reloadRegistrationStore() {
  cache = null;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export function validateSubmission(
  type: RegistrationType,
  fields: Record<string, string> = {},
  documents: { kind: string }[] = []
): ValidationResult {
  const specs = REGISTRATION_FIELDS[type] ?? [];
  const docSpecs = REGISTRATION_DOCUMENTS[type] ?? [];
  const attached = new Set((documents || []).map((d) => d.kind));

  const missingFields = specs
    .filter((spec) => spec.required && !String(fields[spec.key] ?? "").trim())
    .map(({ key, labelAr, labelEn }) => ({ key, labelAr, labelEn }));

  const missingDocuments = docSpecs
    .filter((spec) => !attached.has(spec.kind))
    .map(({ kind, labelAr, labelEn }) => ({ kind, labelAr, labelEn }));

  const invalidFields: ValidationResult["invalidFields"] = [];
  const email = String(fields.email ?? "").trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) {
    invalidFields.push({ key: "email", labelAr: "البريد الإلكتروني", reasonAr: "صيغة البريد الإلكتروني غير صحيحة" });
  }
  const phone = String(fields.phone ?? "").trim();
  if (phone && phone.replace(/\D/g, "").length < 9) {
    invalidFields.push({ key: "phone", labelAr: "رقم الجوال", reasonAr: "رقم الجوال غير مكتمل" });
  }

  return {
    complete: missingFields.length === 0 && missingDocuments.length === 0 && invalidFields.length === 0,
    missingFields,
    missingDocuments,
    invalidFields,
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function nextRequestNumber(store: StoreShape): string {
  store.sequence += 1;
  return `EJ-REG-2026-${String(store.sequence).padStart(6, "0")}`;
}

interface NormalizedDocumentInput {
  kind: string;
  fileName: string;
  mimeType: string;
  extension: string;
  buffer: Buffer;
}

function normalizeDocumentInputs(
  type: RegistrationType,
  documents: { kind: string; fileName?: string; data: string }[] = []
): NormalizedDocumentInput[] {
  if (!Array.isArray(documents)) throw registrationError("قائمة المستندات غير صالحة");
  const specs = REGISTRATION_DOCUMENTS[type] || [];
  const seen = new Set<string>();
  return documents.map((document) => {
    if (!document || typeof document.kind !== "string" || !specs.some((item) => item.kind === document.kind)) {
      throw registrationError("نوع المستند غير مدعوم", 400, "INVALID_DOCUMENT_KIND");
    }
    if (seen.has(document.kind)) throw registrationError("لا يمكن إرفاق النوع نفسه من المستند أكثر من مرة", 400, "DUPLICATE_DOCUMENT_KIND");
    seen.add(document.kind);

    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(String(document.data || ""));
    if (!match) throw registrationError("صيغة المستند غير صالحة", 400, "INVALID_DOCUMENT_DATA");
    const mimeType = match[1].toLowerCase();
    const extension = MIME_EXTENSIONS[mimeType];
    if (!extension) throw registrationError("يسمح فقط بصور PNG أو JPEG أو WebP وملفات PDF", 400, "UNSUPPORTED_DOCUMENT_TYPE");

    const encoded = match[2];
    if (!encoded || encoded.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 4) {
      throw registrationError("حجم المستند يتجاوز الحد المسموح (١٢ ميجابايت)", 413, "DOCUMENT_TOO_LARGE");
    }
    const buffer = Buffer.from(encoded, "base64");
    if (!buffer.length || buffer.length > MAX_DOCUMENT_BYTES || buffer.toString("base64") !== encoded) {
      throw registrationError("محتوى المستند غير صالح أو يتجاوز ١٢ ميجابايت", buffer.length > MAX_DOCUMENT_BYTES ? 413 : 400, "INVALID_DOCUMENT_DATA");
    }

    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    const isPdf = buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
    const signatureMatches =
      (mimeType === "image/png" && isPng) ||
      (mimeType === "image/jpeg" && isJpeg) ||
      (mimeType === "image/webp" && isWebp) ||
      (mimeType === "application/pdf" && isPdf);
    if (!signatureMatches) throw registrationError("نوع الملف لا يطابق محتواه", 400, "DOCUMENT_MIME_MISMATCH");

    const rawName = String(document.fileName || `${document.kind}${extension}`).replace(/\\/g, "/").split("/").pop() || "";
    const fileName = rawName.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) || `${document.kind}${extension}`;
    return { kind: document.kind, fileName, mimeType, extension, buffer };
  });
}

function persistDocument(requestId: string, documentId: string, document: NormalizedDocumentInput): { url: string; sizeBytes: number } {
  if (!REQUEST_ID_PATTERN.test(requestId) || !DOCUMENT_ID_PATTERN.test(documentId)) {
    throw registrationError("معرّف المستند غير صالح", 400, "INVALID_DOCUMENT_ID");
  }
  const root = path.resolve(uploadRoot());
  const dir = path.resolve(root, requestId);
  const file = path.resolve(dir, `${documentId}${document.extension}`);
  if (!dir.startsWith(`${root}${path.sep}`) || !file.startsWith(`${dir}${path.sep}`)) {
    throw registrationError("مسار تخزين المستند غير صالح", 400, "INVALID_DOCUMENT_PATH");
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, document.buffer, { mode: 0o600 });
  return {
    url: `/api/registrations/${encodeURIComponent(requestId)}/documents/${encodeURIComponent(documentId)}`,
    sizeBytes: document.buffer.length,
  };
}

function attachDocuments(request: RegistrationRequest, documents: NormalizedDocumentInput[]) {
  for (const document of documents) {
    const id = `regd-${randomUUID()}`;
    const saved = persistDocument(request.id, id, document);
    const spec = REGISTRATION_DOCUMENTS[request.type].find((item) => item.kind === document.kind)!;
    const entry: RegistrationDocument = {
      id,
      kind: document.kind,
      labelAr: spec.labelAr,
      labelEn: spec.labelEn,
      fileName: document.fileName,
      sizeBytes: saved.sizeBytes,
      mimeType: document.mimeType,
      url: saved.url,
      uploadedAt: new Date().toISOString(),
    };
    request.documents = request.documents.filter((item) => item.kind !== document.kind).concat(entry);
  }
}

function historyEntry(
  action: RegistrationAction,
  fromStatus: RegistrationStatus | null,
  toStatus: RegistrationStatus,
  actor?: { id?: string; name?: string; role?: string },
  reason?: string,
  missingItems?: string[]
): RegistrationHistoryEntry {
  return {
    id: `regh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    action,
    fromStatus,
    toStatus,
    actorId: actor?.id,
    actorName: actor?.name,
    actorRole: actor?.role,
    reason: reason || undefined,
    missingItems: missingItems && missingItems.length ? missingItems : undefined,
  };
}

function findUserByEmail(email: string): UserEntity | undefined {
  const target = String(email || "").trim().toLowerCase();
  return Array.from(db.users.values()).find((u) => u.email.toLowerCase() === target);
}

/* ------------------------------------------------------------------ */
/* Public API — applicant side                                         */
/* ------------------------------------------------------------------ */

export interface SubmitInput {
  type: RegistrationType;
  fields: Record<string, string>;
  password?: string;
  documents?: { kind: string; fileName?: string; data: string }[];
  submit?: boolean;
}

export interface SubmitResult {
  request: RegistrationRequest;
  validation: ValidationResult;
  accountCreated: boolean;
}

/**
 * Creates (or updates) a registration request. With `submit: true` the request
 * is validated and moved to PENDING_REVIEW; an incomplete submission is
 * rejected with the exact list of missing data and documents.
 */
export function submitRegistration(input: SubmitInput): SubmitResult {
  const type = (REGISTRATION_TYPES as readonly string[]).includes(input.type)
    ? (input.type as RegistrationType)
    : null;
  if (!type) throw registrationError("نوع الطلب غير مدعوم", 400, "INVALID_TYPE");

  const fields: Record<string, string> = {};
  for (const spec of REGISTRATION_FIELDS[type]) {
    const value = String(input.fields?.[spec.key] ?? "").trim();
    if (value) fields[spec.key] = value;
  }
  const email = String(fields.email ?? "").trim().toLowerCase();
  if (!email) throw registrationError("البريد الإلكتروني مطلوب", 400, "EMAIL_REQUIRED");
  fields.email = email;

  const shouldSubmit = input.submit !== false;
  const password = String(input.password ?? "");
  if (shouldSubmit && (Buffer.byteLength(password, "utf8") < 8 || Buffer.byteLength(password, "utf8") > 72)) {
    throw registrationError("يجب أن تكون كلمة المرور بين ٨ و٧٢ بايت", 400, "INVALID_PASSWORD_LENGTH");
  }
  const preparedDocuments = normalizeDocumentInputs(type, input.documents ?? []);
  const phone = String(fields.phone ?? "");
  const fullName = String(fields.fullName ?? "");
  const store = readStore();

  // A public submission can only update an unclaimed draft. Existing accounts,
  // submitted requests, and rejected applications must be handled by sign-in.
  const existingRequest = store.requests.find((request) => request.email.toLowerCase() === email);
  let request: RegistrationRequest | undefined;
  if (existingRequest) {
    if (existingRequest.type !== type) {
      throw registrationError("هذا البريد مرتبط بطلب من نوع آخر", 409, "EMAIL_ALREADY_IN_USE");
    }
    if (existingRequest.status !== "DRAFT" || existingRequest.userId || existingRequest.accountCreated) {
      throw registrationError("يوجد طلب سابق لهذا البريد؛ سجّل الدخول لمتابعته", 409, "EXISTING_REQUEST");
    }
    request = existingRequest;
  }

  if (findUserByEmail(email)) {
    throw registrationError("يوجد حساب بهذا البريد بالفعل؛ سجّل الدخول لمتابعة طلبك", 409, "EMAIL_ALREADY_REGISTERED");
  }

  if (!request) {
    request = {
      id: nextRequestNumber(store),
      type,
      status: "DRAFT",
      fullName,
      email,
      phone,
      fields: {},
      documents: [],
      completionRequests: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accountCreated: false,
      history: [],
    };
    request.history.push(historyEntry("CREATED", null, "DRAFT", { name: fullName, role: type }, "إنشاء طلب تسجيل"));
    store.requests.push(request);
  }

  request.fullName = fullName || request.fullName;
  request.phone = phone || request.phone;
  request.fields = { ...request.fields, ...fields };
  attachDocuments(request, preparedDocuments);

  const validation = validateSubmission(type, request.fields, request.documents);
  if (shouldSubmit && !validation.complete) {
    request.updatedAt = new Date().toISOString();
    writeStore(store);
    return { request, validation, accountCreated: false };
  }

  let accountCreated = false;
  if (shouldSubmit) {
    const previous = request.status;
    const submissionAction = previous === "DRAFT" ? "SUBMITTED" : "RESUBMITTED";
    request.status = "PENDING_REVIEW";
    request.submittedAt = new Date().toISOString();
    request.updatedAt = request.submittedAt;
    request.decisionReason = undefined;
    request.completionRequests = [];
    request.history.push(
      historyEntry(submissionAction, previous, "PENDING_REVIEW", {
        name: request.fullName,
        role: type,
      }, "إرسال طلب التسجيل")
    );

    const userId = `u-reg-${randomUUID()}`;
    const account: UserEntity = {
      id: userId,
      email: request.email,
      fullName: request.fullName || request.email,
      phone: request.phone,
      role: type,
      passwordHash: bcrypt.hashSync(password, 10),
      isActive: true,
      createdAt: new Date().toISOString(),
      registrationId: request.id,
      registrationStatus: "PENDING_REVIEW",
    };
    db.users.set(userId, account);
    request.userId = userId;
    request.accountCreated = true;
    accountCreated = true;

    dispatchNotification({
      targetRole: "SUPER_ADMIN",
      titleAr: "طلب تسجيل جديد",
      titleEn: "New registration request",
      messageAr: `${type === "DRIVER" ? "طلب تسجيل سائق" : "طلب تسجيل عميل"} — ${request.fullName} (${request.id}) بانتظار المراجعة.`,
      messageEn: `${type === "DRIVER" ? "Driver" : "Customer"} registration ${request.id} from ${request.fullName} awaits review.`,
      type: "INFO",
      entityType: "registration",
      entityId: request.id,
    });

    logAuditEvent({
      actorId: request.userId,
      actorName: request.fullName,
      actorRole: type,
      action: "REGISTRATION_SUBMITTED",
      entity: "registrations",
      entityId: request.id,
      newValues: { type, status: "PENDING_REVIEW" },
    });
  } else {
    request.updatedAt = new Date().toISOString();
  }

  writeStore(store);
  return { request, validation, accountCreated };
}

export function getRequest(requestId: string): RegistrationRequest | undefined {
  return readStore().requests.find((r) => r.id === String(requestId));
}

/** Resolve a document path only after the caller has authorized the owning request. */
export function getRegistrationDocumentFile(requestId: string, documentId: string) {
  if (!REQUEST_ID_PATTERN.test(requestId) || !DOCUMENT_ID_PATTERN.test(documentId)) return null;
  const request = getRequest(requestId);
  const document = request?.documents.find((item) => item.id === documentId);
  const extension = document ? MIME_EXTENSIONS[document.mimeType] : undefined;
  if (!request || !document || !extension) return null;

  const root = path.resolve(uploadRoot());
  const requestRoot = path.resolve(root, request.id);
  const filePath = path.resolve(requestRoot, `${document.id}${extension}`);
  if (!requestRoot.startsWith(`${root}${path.sep}`) || !filePath.startsWith(`${requestRoot}${path.sep}`)) return null;
  try {
    if (!fs.statSync(filePath).isFile()) return null;
  } catch {
    return null;
  }
  return { filePath, mimeType: document.mimeType, fileName: document.fileName, request, document };
}

export function getRequestForUser(userId?: string, email?: string): RegistrationRequest | undefined {
  const store = readStore();
  const byId = userId ? store.requests.find((r) => r.userId === userId) : undefined;
  if (byId) return byId;
  const target = String(email || "").toLowerCase();
  return target
    ? store.requests
        .filter((r) => r.email.toLowerCase() === target)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]
    : undefined;
}

export function listRequests(filter: { status?: string; type?: string } = {}): RegistrationRequest[] {
  return readStore()
    .requests.filter((r) => (filter.status ? r.status === filter.status : true))
    .filter((r) => (filter.type ? r.type === filter.type : true))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/* ------------------------------------------------------------------ */
/* Public API — administration side                                    */
/* ------------------------------------------------------------------ */

export interface DecisionInput {
  action: "APPROVE" | "NEEDS_COMPLETION" | "REJECT";
  reason?: string;
  missingItems?: string[];
  reviewer?: { id?: string; name?: string; role?: string };
}

export function decideRequest(requestId: string, input: DecisionInput): RegistrationRequest {
  const store = readStore();
  const request = store.requests.find((r) => r.id === String(requestId));
  if (!request) throw Object.assign(new Error("طلب التسجيل غير موجود"), { status: 404, code: "NOT_FOUND" });

  if (request.status === "APPROVED") {
    throw Object.assign(new Error("تمت الموافقة على هذا الطلب مسبقًا"), { status: 409, code: "ALREADY_APPROVED" });
  }
  if (request.status === "DRAFT") {
    throw Object.assign(new Error("لم يتم إرسال الطلب بعد، لا يمكن مراجعته"), { status: 409, code: "NOT_SUBMITTED" });
  }

  const reviewer = input.reviewer;
  const reason = String(input.reason ?? "").trim();

  if (input.action === "REJECT" && !reason) {
    throw Object.assign(new Error("سبب الرفض إلزامي"), { status: 400, code: "REASON_REQUIRED" });
  }
  if (input.action === "NEEDS_COMPLETION" && !reason && !(input.missingItems || []).length) {
    throw Object.assign(new Error("يجب تحديد البيانات أو المستندات الناقصة"), { status: 400, code: "REASON_REQUIRED" });
  }

  const previous = request.status;

  if (input.action === "APPROVE") {
    request.status = "APPROVED";
    request.decidedAt = new Date().toISOString();
    request.reviewerId = reviewer?.id;
    request.reviewerName = reviewer?.name;
    request.decisionReason = undefined;
    request.completionRequests = [];
    request.history.push(historyEntry("APPROVED", previous, "APPROVED", reviewer, reason || "اعتماد الحساب"));
    activateAccount(request);
    dispatchNotification({
      userId: request.userId,
      targetRole: request.type,
      titleAr: "تمت الموافقة على طلبك",
      titleEn: "Your request has been approved",
      messageAr: `تمت الموافقة على طلب تسجيلك بنجاح. يمكنك الآن استخدام حسابك والاستفادة من الخدمات المتاحة لك. (${request.id})`,
      messageEn: `Your registration ${request.id} has been approved. You can now use your account.`,
      type: "SUCCESS",
      entityType: "registration",
      entityId: request.id,
    });
  } else if (input.action === "NEEDS_COMPLETION") {
    const missing = (input.missingItems || []).map((item) => {
      const byField = REGISTRATION_FIELDS[request.type].find((f) => f.key === item);
      if (byField) return byField.labelAr;
      const byDoc = REGISTRATION_DOCUMENTS[request.type].find((d) => d.kind === item);
      if (byDoc) return byDoc.labelAr;
      return item;
    });
    request.status = "NEEDS_COMPLETION";
    request.completionRequests = missing;
    request.decisionReason = reason || `يجب استكمال: ${missing.join("، ")}`;
    request.reviewerId = reviewer?.id;
    request.reviewerName = reviewer?.name;
    request.history.push(
      historyEntry("NEEDS_COMPLETION", previous, "NEEDS_COMPLETION", reviewer, request.decisionReason, missing)
    );
    dispatchNotification({
      userId: request.userId,
      targetRole: request.type,
      titleAr: "طلبك يحتاج إلى استكمال بعض البيانات",
      titleEn: "Your request needs more information",
      messageAr: `طلبك يحتاج إلى استكمال بعض البيانات: ${missing.join("، ") || request.decisionReason}`,
      messageEn: `Registration ${request.id} needs completion: ${missing.join(", ") || request.decisionReason}`,
      type: "WARNING",
      entityType: "registration",
      entityId: request.id,
    });
  } else {
    request.status = "REJECTED";
    request.decidedAt = new Date().toISOString();
    request.decisionReason = reason;
    request.reviewerId = reviewer?.id;
    request.reviewerName = reviewer?.name;
    request.completionRequests = [];
    request.history.push(historyEntry("REJECTED", previous, "REJECTED", reviewer, reason));
    dispatchNotification({
      userId: request.userId,
      targetRole: request.type,
      titleAr: "تم رفض طلبك",
      titleEn: "Your request was rejected",
      messageAr: `تم رفض طلبك. السبب: ${reason}`,
      messageEn: `Registration ${request.id} was rejected. Reason: ${reason}`,
      type: "ALERT",
      entityType: "registration",
      entityId: request.id,
    });
  }

  request.updatedAt = new Date().toISOString();
  writeStore(store);

  logAuditEvent({
    actorId: reviewer?.id,
    actorName: reviewer?.name,
    actorRole: reviewer?.role,
    action: `REGISTRATION_${input.action}`,
    entity: "registrations",
    entityId: request.id,
    oldValues: { status: previous },
    newValues: { status: request.status, reason: request.decisionReason },
    reason: request.decisionReason,
  });

  return request;
}

/**
 * Approves the account: activates the login, links the operational profile and
 * grants the privileges of the account type (driver / customer).
 */
function activateAccount(request: RegistrationRequest) {
  const user = request.userId ? db.users.get(request.userId) : findUserByEmail(request.email);
  if (!user) return;

  user.registrationStatus = "APPROVED";
  user.registrationId = request.id;
  user.isActive = true;
  if (!user.phone) user.phone = request.phone;
  if (!user.fullName && request.fullName) user.fullName = request.fullName;
  if (!user.passwordHash) user.passwordHash = "";

  const f = request.fields;
  if (request.type === "DRIVER" && !user.driverId) {
    const driverId = `d-reg-${request.id.slice(-6)}`;
    db.drivers.set(driverId, {
      id: driverId,
      fullName: request.fullName || f.fullName || user.fullName,
      phone: request.phone,
      nationalId: f.nationalId || "",
      licenseNumber: f.licenseNumber || "",
      licenseExpiry: f.licenseExpiry || "",
      status: "available",
      rating: 5,
      totalTrips: 0,
    });
    user.driverId = driverId;
  }

  if (request.type === "CUSTOMER" && !user.customerId) {
    const customerId = `cust-reg-${request.id.slice(-6)}`;
    db.customers.set(customerId, {
      id: customerId,
      name: f.companyName || request.fullName || user.fullName,
      contactPerson: f.fullName || request.fullName,
      phone: request.phone,
      email: request.email,
      commercialReg: f.commercialReg || "",
      vatNumber: f.vatNumber || "",
      city: f.city || "",
      address: f.address || "",
    });
    user.customerId = customerId;
  }

  db.users.set(user.id, user);
}

/** Applicant re-submits after a NEEDS_COMPLETION decision. */
export function resubmitRegistration(
  requestId: string,
  patch: { fields?: Record<string, string>; documents?: { kind: string; fileName?: string; data: string }[]; note?: string },
  applicant: { userId?: string; email?: string } = {}
): SubmitResult {
  const store = readStore();
  const request = store.requests.find((item) => item.id === String(requestId));
  if (!request) throw registrationError("طلب التسجيل غير موجود", 404, "NOT_FOUND");
  if (!request.userId || request.userId !== applicant.userId || request.email.toLowerCase() !== String(applicant.email || "").toLowerCase()) {
    throw registrationError("لا تملك صلاحية تعديل هذا الطلب", 403, "FORBIDDEN");
  }
  if (request.status !== "NEEDS_COMPLETION" && request.status !== "REJECTED") {
    throw registrationError("لا يمكن تعديل الطلب في حالته الحالية", 409, "INVALID_STATE");
  }
  const account = db.users.get(request.userId);
  if (
    !account ||
    account.email.toLowerCase() !== request.email.toLowerCase() ||
    account.role !== request.type ||
    account.registrationId !== request.id
  ) {
    throw registrationError("تعذّر العثور على الحساب المرتبط بطلب التسجيل", 409, "ACCOUNT_LINK_MISMATCH");
  }

  const incomingEmail = String(patch.fields?.email ?? request.email).trim().toLowerCase();
  if (incomingEmail !== request.email.toLowerCase()) {
    throw registrationError("لا يمكن تغيير البريد الإلكتروني المرتبط بالحساب", 400, "EMAIL_IMMUTABLE");
  }
  const fields: Record<string, string> = { ...request.fields };
  for (const spec of REGISTRATION_FIELDS[request.type]) {
    if (spec.key === "email") continue;
    const value = String(patch.fields?.[spec.key] ?? fields[spec.key] ?? "").trim();
    if (value) fields[spec.key] = value;
  }
  fields.email = request.email;

  const preparedDocuments = normalizeDocumentInputs(request.type, patch.documents ?? []);
  request.fields = fields;
  request.fullName = fields.fullName || request.fullName;
  request.phone = fields.phone || request.phone;
  attachDocuments(request, preparedDocuments);

  const validation = validateSubmission(request.type, request.fields, request.documents);
  if (!validation.complete) {
    request.updatedAt = new Date().toISOString();
    writeStore(store);
    return { request, validation, accountCreated: false };
  }

  const previous = request.status;
  request.status = "PENDING_REVIEW";
  request.submittedAt = new Date().toISOString();
  request.updatedAt = request.submittedAt;
  request.decidedAt = undefined;
  request.reviewerId = undefined;
  request.reviewerName = undefined;
  request.decisionReason = undefined;
  request.completionRequests = [];
  request.history.push(historyEntry("RESUBMITTED", previous, "PENDING_REVIEW", {
    id: request.userId,
    name: request.fullName,
    role: request.type,
  }, String(patch.note || "إعادة إرسال الطلب بعد الاستكمال")));

  account.registrationStatus = "PENDING_REVIEW";
  db.users.set(account.id, account);

  dispatchNotification({
    targetRole: "SUPER_ADMIN",
    titleAr: "إعادة إرسال طلب تسجيل",
    titleEn: "Registration request resubmitted",
    messageAr: `${request.fullName} (${request.id}) أعاد إرسال بياناته للمراجعة.`,
    messageEn: `${request.fullName} resubmitted registration ${request.id} for review.`,
    type: "INFO",
    entityType: "registration",
    entityId: request.id,
  });
  logAuditEvent({
    actorId: account.id,
    actorName: request.fullName,
    actorRole: request.type,
    action: "REGISTRATION_RESUBMITTED",
    entity: "registrations",
    entityId: request.id,
    oldValues: { status: previous },
    newValues: { status: "PENDING_REVIEW" },
  });

  writeStore(store);
  return { request, validation, accountCreated: false };
}

/** Resolves the applicant's own request from an authenticated session. */
export function statusForUser(user: { userId?: string; email?: string }) {
  const request = getRequestForUser(user.userId, user.email);
  if (!request) return null;
  return {
    request,
    status: request.status,
    statusAr: REGISTRATION_STATUS_AR[request.status],
    approved: request.status === "APPROVED",
    canUseAccount: request.status === "APPROVED",
  };
}

/** Arabic label of a form field, so screens can describe what is missing. */
export function labelForField(type: RegistrationType, key: string): string {
  return REGISTRATION_FIELDS[type]?.find((f) => f.key === key)?.labelAr ?? key;
}

/** Arabic label of a required document. */
export function labelForDocument(type: RegistrationType, kind: string): string {
  const spec = REGISTRATION_DOCUMENTS[type]?.find((d) => d.kind === kind);
  return spec ? spec.labelAr : kind;
}

export const REGISTRATION_LIMITS = {
  MAX_DOCUMENT_BYTES,
  MIME_TYPES: Object.keys(MIME_EXTENSIONS),
};
