/**
 * API client for the POS document backend.
 *
 * Shapes follow `sumomomomo/pos-doc-backend` OpenAPI contract
 * (openapi/pos-document-api.openapi.yaml).
 *
 * All requests use relative `/api/v1/...` URLs so the browser only ever talks
 * to the public origin. LAN addresses must never appear in this file or in
 * any browser-facing code.
 */
import { csrfHeaders } from "./csrf";

const API_BASE = "/api/v1";

export type Role = "USER" | "REVIEWER";

export interface CurrentUser {
  email: string;
  displayName: string;
  roles: Role[];
}

export interface ApiError {
  status: number;
  code: string;
  title: string;
  detail: string;
}

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiError).status === "number" &&
    typeof (value as ApiError).code === "string"
  );
}

const MAX_STRING_LENGTHS = {
  policyNumber: 256,
  erefNumber: 256,
  policyholderName: 256,
};

/** Parse any error response (including application/problem+json) into a safe UI error. */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  const status = response.status;
  let code = "unknown_error";
  let title = "Request failed";
  let detail = "";
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null) {
      const record = body as Record<string, unknown>;
      if (typeof record.code === "string") code = record.code;
      if (typeof record.title === "string") title = record.title;
      if (typeof record.detail === "string") detail = record.detail;
    }
  } catch {
    // Non-JSON body: keep defaults.
  }
  // Sanitize: strip anything that looks like internal infrastructure.
  const sanitized = detail
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
  return { status, code, title, detail: sanitized };
}

export function networkError(): ApiError {
  return {
    status: 0,
    code: "network_error",
    title: "Backend unavailable",
    detail: "The backend could not be reached.",
  };
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
  });
}

export async function getCurrentUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; error: ApiError }
> {
  try {
    const response = await request("/auth/me");
    if (!response.ok) {
      return { ok: false, error: await parseErrorResponse(response) };
    }
    const body: unknown = await response.json();
    const record = (body ?? {}) as Record<string, unknown>;
    const user: CurrentUser = {
      email: typeof record.email === "string" ? record.email : "",
      displayName: typeof record.displayName === "string" ? record.displayName : "",
      roles: Array.isArray(record.roles)
        ? record.roles.filter((r): r is Role => r === "USER" || r === "REVIEWER")
        : [],
    };
    return { ok: true, user };
  } catch {
    return { ok: false, error: networkError() };
  }
}

export async function logout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST", headers: csrfHeaders() });
  } catch {
    // Best-effort; the UI clears local state regardless.
  }
}

// --- Search ---

export interface SearchCriteria {
  erefNumber?: string;
  policyNumber?: string;
  policyholderName?: string;
  fuzzyName?: boolean;
  page?: number;
}

export interface PosRecordSummary {
  id: string;
  erefNumber: string | null;
  policyNumber: string | null;
  policyholderName: string | null;
  consultantName: string | null;
  policyCreateDate: string | null;
  status: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface SearchPage {
  items: PosRecordSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function searchRecords(
  criteria: SearchCriteria,
): Promise<{ ok: true; results: SearchPage } | { ok: false; error: ApiError }> {
  const payload: Record<string, unknown> = {};
  if (criteria.erefNumber) payload.erefNumber = criteria.erefNumber;
  if (criteria.policyNumber) payload.policyNumber = criteria.policyNumber;
  if (criteria.policyholderName) payload.policyholderName = criteria.policyholderName;
  if (criteria.fuzzyName) payload.fuzzyName = true;
  if (typeof criteria.page === "number") payload.page = criteria.page;
  try {
    const response = await request("/pos-records/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { ok: false, error: await parseErrorResponse(response) };
    }
    const body: unknown = await response.json();
    const record = (body ?? {}) as Record<string, unknown>;
    const items = Array.isArray(record.items) ? record.items : [];
    return {
      ok: true,
      results: {
        items: items as PosRecordSummary[],
        page: typeof record.page === "number" ? record.page : 0,
        size: typeof record.size === "number" ? record.size : 20,
        totalElements:
          typeof record.totalElements === "number" ? record.totalElements : items.length,
        totalPages: typeof record.totalPages === "number" ? record.totalPages : 0,
      },
    };
  } catch {
    return { ok: false, error: networkError() };
  }
}

// --- Record detail ---

export interface PosRecordDetail {
  id: string;
  erefNumber: string | null;
  policyNumber: string | null;
  policyholderName: string | null;
  consultantName: string | null;
  policyCreateDate: string | null;
  status: string;
  uploadedAt: string;
  updatedAt: string;
  version: number;
  documents: PosDocument[];
}

export type PosRecordChanges = Partial<
  Pick<
    PosRecordDetail,
    "erefNumber" | "policyNumber" | "policyholderName" | "consultantName" | "policyCreateDate"
  >
>;

export type PosRecordPatch = { expectedVersion: number } & PosRecordChanges;

function parseRecordDetail(body: unknown, fallbackId: string): PosRecordDetail {
  const record = (body ?? {}) as Record<string, unknown>;
  const str = (key: string): string | null =>
    typeof record[key] === "string" ? (record[key] as string) : null;
  return {
    id: typeof record.id === "string" ? record.id : fallbackId,
    erefNumber: str("erefNumber"),
    policyNumber: str("policyNumber"),
    policyholderName: str("policyholderName"),
    consultantName: str("consultantName"),
    policyCreateDate: str("policyCreateDate"),
    status: typeof record.status === "string" ? record.status : "",
    uploadedAt: typeof record.uploadedAt === "string" ? record.uploadedAt : "",
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
    version: typeof record.version === "number" ? record.version : 0,
    documents: [],
  };
}

export function documentContentUrl(posRecordId: string, documentId: string): string {
  return `${API_BASE}/pos-records/${encodeURIComponent(posRecordId)}/documents/${encodeURIComponent(documentId)}/content`;
}

export function sourceArchiveUrl(posRecordId: string): string {
  return `${API_BASE}/pos-records/${encodeURIComponent(posRecordId)}/source-archive/content`;
}

export async function getRecord(
  posRecordId: string,
): Promise<{ ok: true; record: PosRecordDetail } | { ok: false; error: ApiError }> {
  try {
    const response = await request(`/pos-records/${encodeURIComponent(posRecordId)}`);
    if (!response.ok) {
      return { ok: false, error: await parseErrorResponse(response) };
    }
    return { ok: true, record: parseRecordDetail(await response.json(), posRecordId) };
  } catch {
    return { ok: false, error: networkError() };
  }
}

export async function updateRecord(
  posRecordId: string,
  patch: PosRecordPatch,
): Promise<{ ok: true; record: PosRecordDetail } | { ok: false; error: ApiError }> {
  try {
    const response = await request(`/pos-records/${encodeURIComponent(posRecordId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/merge-patch+json", ...csrfHeaders() },
      body: JSON.stringify(patch),
    });
    if (!response.ok) return { ok: false, error: await parseErrorResponse(response) };
    return { ok: true, record: parseRecordDetail(await response.json(), posRecordId) };
  } catch {
    return { ok: false, error: networkError() };
  }
}

export async function deleteRecord(
  posRecordId: string,
): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  try {
    const response = await request(`/pos-records/${encodeURIComponent(posRecordId)}`, {
      method: "DELETE",
      headers: csrfHeaders(),
    });
    if (!response.ok) return { ok: false, error: await parseErrorResponse(response) };
    return { ok: true };
  } catch {
    return { ok: false, error: networkError() };
  }
}

export interface PosDocument {
  id: string;
  filename: string;
  documentType: string;
  processingStatus: string;
}

export async function getRecordDocuments(
  posRecordId: string,
): Promise<{ ok: true; documents: PosDocument[] } | { ok: false; error: ApiError }> {
  try {
    const response = await request(`/pos-records/${encodeURIComponent(posRecordId)}/documents`);
    if (!response.ok) {
      return { ok: false, error: await parseErrorResponse(response) };
    }
    const body: unknown = await response.json();
    const list = Array.isArray(body) ? body : [];
    const documents: PosDocument[] = list.map((item) => {
      const record = (item ?? {}) as Record<string, unknown>;
      return {
        id: typeof record.id === "string" ? record.id : "",
        filename:
          typeof record.storageObject === "object" &&
          record.storageObject !== null &&
          typeof (record.storageObject as Record<string, unknown>).originalFilename === "string"
            ? (record.storageObject as Record<string, string>).originalFilename
            : "",
        documentType: typeof record.documentType === "string" ? record.documentType : "",
        processingStatus:
          typeof record.processingStatus === "string" ? record.processingStatus : "",
      };
    });
    return { ok: true, documents };
  } catch {
    return { ok: false, error: networkError() };
  }
}

// --- Ingestion job polling ---

export interface IngestionJob {
  id: string;
  status: JobStatus;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
}

export type JobStatus = "QUEUED" | "RUNNING" | "RETRY_SCHEDULED" | "COMPLETED" | "FAILED";

export async function getIngestionJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<{ ok: true; job: IngestionJob } | { ok: false; error: ApiError }> {
  try {
    const response = await request(`/ingestion-jobs/${encodeURIComponent(jobId)}`, { signal });
    if (!response.ok) {
      return { ok: false, error: await parseErrorResponse(response) };
    }
    const body: unknown = await response.json();
    const record = (body ?? {}) as Record<string, unknown>;
    return {
      ok: true,
      job: {
        id: typeof record.id === "string" ? record.id : jobId,
        status: (typeof record.status === "string" ? record.status : "QUEUED") as JobStatus,
        attemptCount: typeof record.attemptCount === "number" ? record.attemptCount : 0,
        errorCode: typeof record.errorCode === "string" ? record.errorCode : null,
        errorMessage: typeof record.errorMessage === "string" ? record.errorMessage : null,
      },
    };
  } catch {
    return { ok: false, error: networkError() };
  }
}

// --- Upload (XMLHttpRequest for progress) ---

export interface UploadResult {
  posRecordId: string;
  jobId: string;
}

export interface UploadOptions {
  file: File;
  policyNumber?: string;
  onProgress?: (percent: number | null) => void;
  signal: AbortSignal;
}

export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB per OpenAPI contract

export function uploadZip(options: UploadOptions): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/pos-records`);
    xhr.withCredentials = true;
    xhr.responseType = "json";

    const onAbort = () => xhr.abort();
    options.signal.addEventListener("abort", onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      options.signal.removeEventListener("abort", onAbort);
      if (xhr.status === 202) {
        const body = (xhr.response ?? {}) as Record<string, unknown>;
        resolve({
          posRecordId: typeof body.posRecordId === "string" ? body.posRecordId : "",
          jobId: typeof body.jobId === "string" ? body.jobId : "",
        });
        return;
      }
      // responseType is "json", so read xhr.response (responseText would throw
      // InvalidStateError). It is null when the body is not valid JSON.
      let code = "unknown_error";
      let title = "Upload failed";
      let detail = "";
      const parsed: unknown = xhr.response;
      if (typeof parsed === "object" && parsed !== null) {
        const record = parsed as Record<string, unknown>;
        if (typeof record.code === "string") code = record.code;
        if (typeof record.title === "string") title = record.title;
        if (typeof record.detail === "string") detail = record.detail;
      }
      reject({
        status: xhr.status,
        code,
        title,
        detail: detail.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "").trim(),
      } satisfies ApiError);
    };

    xhr.onerror = () => {
      options.signal.removeEventListener("abort", onAbort);
      reject(networkError());
    };

    xhr.onabort = () => {
      options.signal.removeEventListener("abort", onAbort);
      reject(new UploadCancelledError());
    };

    const formData = new FormData();
    formData.append("file", options.file);
    if (options.policyNumber) {
      formData.append("policyNumber", options.policyNumber);
    }
    // Send the CSRF header without setting the multipart boundary manually.
    for (const [name, value] of Object.entries(csrfHeaders())) {
      xhr.setRequestHeader(name, value);
    }
    xhr.send(formData);
  });
}

export { MAX_STRING_LENGTHS };
