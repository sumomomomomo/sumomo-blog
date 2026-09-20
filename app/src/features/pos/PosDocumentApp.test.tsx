/// <reference types="@testing-library/jest-dom/vitest" />
/**
 * Mock-backed frontend tests for the POS document MVP.
 * No test contacts Google, Cloudflare, or any LAN machine: all backend
 * requests are intercepted at the module boundary.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PosDocument, Role } from "./api";
import PosDocumentApp from "./PosDocumentApp";

const api = await import("./api");

vi.mock("./api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api")>();
  return {
    ...actual,
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    searchRecords: vi.fn(),
    getRecord: vi.fn(),
    getRecordDocuments: vi.fn(),
    getIngestionJob: vi.fn(),
    uploadZip: vi.fn(),
  };
});

const mockCurrentUser = vi.mocked(api.getCurrentUser);
const mockLogout = vi.mocked(api.logout);
const mockSearch = vi.mocked(api.searchRecords);
const mockGetRecord = vi.mocked(api.getRecord);
const mockGetDocuments = vi.mocked(api.getRecordDocuments);
const mockGetJob = vi.mocked(api.getIngestionJob);
const mockUpload = vi.mocked(api.uploadZip);

const signedInUser = {
  email: "user@example.com",
  displayName: "Test User",
  roles: ["USER"] as Role[],
};

const reviewer = {
  email: "reviewer@example.com",
  displayName: "Test Reviewer",
  roles: ["USER", "REVIEWER"] as Role[],
};

const searchPage = {
  items: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      erefNumber: "EREF-2026-00123",
      policyNumber: "P12345678",
      policyholderName: "Jane Sample",
      consultantName: "Con Sul",
      policyCreateDate: "2026-01-01",
      status: "COMPLETED",
      uploadedAt: "2026-01-02T00:00:00Z",
      updatedAt: "2026-01-03T00:00:00Z",
    },
  ],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

const recordDetail = {
  ...searchPage.items[0],
  version: 3,
  documents: [] as PosDocument[],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRecord.mockResolvedValue({ ok: true, record: recordDetail });
  mockGetDocuments.mockResolvedValue({ ok: true, documents: [] });
});

afterEach(() => {
  cleanup();
});

describe("auth shell", () => {
  it("shows the loading state first", async () => {
    mockCurrentUser.mockReturnValue(new Promise(() => {}));
    render(<PosDocumentApp />);
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument();
  });

  it("shows sign-in on 401", async () => {
    mockCurrentUser.mockResolvedValue({
      ok: false,
      error: { status: 401, code: "unauthorized", title: "Unauthorized", detail: "" },
    });
    render(<PosDocumentApp />);
    expect(await screen.findByRole("link", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("sign-in navigates to the backend OAuth start URL", async () => {
    mockCurrentUser.mockResolvedValue({
      ok: false,
      error: { status: 401, code: "unauthorized", title: "Unauthorized", detail: "" },
    });
    render(<PosDocumentApp />);
    const link = await screen.findByRole("link", { name: /sign in with google/i });
    expect(link.getAttribute("href")).toBe("/api/v1/oauth2/authorization/google");
  });

  it("shows user info when signed in", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    render(<PosDocumentApp />);
    expect(await screen.findByText(/Test User/)).toBeInTheDocument();
    expect(screen.getByText(/Roles: USER/)).toBeInTheDocument();
  });

  it("shows backend-unavailable on network error without claiming signed out", async () => {
    mockCurrentUser.mockResolvedValue({
      ok: false,
      error: api.networkError(),
    });
    render(<PosDocumentApp />);
    expect(await screen.findByText(/backend unavailable/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in with google/i })).not.toBeInTheDocument();
  });
});

describe("roles", () => {
  it("hides upload panel for USER", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    render(<PosDocumentApp />);
    await screen.findByText(/Roles: USER/);
    expect(screen.queryByText(/Upload POS archive/i)).not.toBeInTheDocument();
  });

  it("shows upload panel for REVIEWER", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    render(<PosDocumentApp />);
    expect(await screen.findByText(/Upload POS archive/i)).toBeInTheDocument();
  });
});

describe("upload and polling", () => {
  it("sends multipart data and validates a .zip file", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    render(<PosDocumentApp />);
    await screen.findByText(/Upload POS archive/i);

    // Non-zip file rejected client-side.
    const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
    await userEvent.upload(fileInput, new File(["x"], "data.txt", { type: "text/plain" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(screen.getByText(/choose a zip file|must be a \.zip archive/i)).toBeInTheDocument(),
    );
    expect(mockUpload).not.toHaveBeenCalled();

    await userEvent.upload(fileInput, new File(["PK"], "archive.zip", { type: "application/zip" }));
    mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
    mockGetJob.mockResolvedValue({
      ok: true,
      job: { id: "j-1", status: "COMPLETED", attemptCount: 1, errorCode: null, errorMessage: null },
    });
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    const options = mockUpload.mock.calls[0][0];
    expect(options.file.name).toBe("archive.zip");
    // CSRF header comes from the csrf helper via the XHR path.
    expect(api.uploadZip).toHaveBeenCalled();
  });

  it("polls the job and shows completion, then loads the record", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
    mockGetJob.mockResolvedValue({
      ok: true,
      job: { id: "j-1", status: "COMPLETED", attemptCount: 2, errorCode: null, errorMessage: null },
    });
    mockGetRecord.mockResolvedValue({ ok: true, record: recordDetail });
    mockGetDocuments.mockResolvedValue({ ok: true, documents: [] });

    render(<PosDocumentApp />);
    await screen.findByText(/Upload POS archive/i);
    const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
    await userEvent.upload(fileInput, new File(["PK"], "archive.zip", { type: "application/zip" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    await waitFor(() => expect(screen.getByText(/Processing completed./i)).toBeInTheDocument());
    expect(mockGetJob).toHaveBeenCalledWith("j-1", expect.any(AbortSignal));
    expect(mockGetRecord).toHaveBeenCalledWith("r-1");
    expect(mockGetDocuments).toHaveBeenCalledWith("r-1");
  });

  it("stops polling on FAILED status", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
    mockGetJob.mockResolvedValue({
      ok: true,
      job: {
        id: "j-1",
        status: "FAILED",
        attemptCount: 3,
        errorCode: "OCR_FAILED",
        errorMessage: null,
      },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Upload POS archive/i);
    const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
    await userEvent.upload(fileInput, new File(["PK"], "archive.zip", { type: "application/zip" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() =>
      expect(screen.getByText(/Processing failed \(OCR_FAILED\)/i)).toBeInTheDocument(),
    );
    expect(mockGetJob).toHaveBeenCalledTimes(1);
  });

  it("clears data on logout", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    render(<PosDocumentApp />);
    await screen.findByText(/Test User/);
    mockLogout.mockResolvedValue(undefined);
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(mockLogout).toHaveBeenCalled();
    expect(await screen.findByRole("link", { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByText(/Test User/)).not.toBeInTheDocument();
  });
});

describe("search and detail", () => {
  it("sends only non-empty fields", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.type(screen.getByLabelText(/eref number/i), "EREF-1");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(mockSearch).toHaveBeenCalled());
    const criteria = mockSearch.mock.calls[0][0];
    expect(criteria.erefNumber).toBe("EREF-1");
    expect(criteria.policyNumber).toBeUndefined();
    expect(criteria.policyholderName).toBeUndefined();
  });

  it("renders results and detail on selection", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    mockGetRecord.mockResolvedValue({ ok: true, record: recordDetail });
    mockGetDocuments.mockResolvedValue({
      ok: true,
      documents: [{ id: "doc-1", documentType: "APPLICATION", processingStatus: "COMPLETED" }],
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText(/EREF-2026-00123/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /view details/i }));
    expect(await screen.findByText(/Record details/i)).toBeInTheDocument();
    expect(screen.getByText(/APPLICATION/)).toBeInTheDocument();
    expect(screen.queryByText(/Open PDF/)).not.toBeInTheDocument(); // USER cannot open PDFs
  });

  it("REVIEWER sees Open PDF and Download original ZIP using relative URLs", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    const recordId = "11111111-1111-1111-1111-111111111111";
    mockGetRecord.mockResolvedValue({
      ok: true,
      record: {
        ...recordDetail,
        id: recordId,
        documents: [{ id: "doc-1", documentType: "APPLICATION", processingStatus: "COMPLETED" }],
      },
    });
    mockGetDocuments.mockResolvedValue({
      ok: true,
      documents: [{ id: "doc-1", documentType: "APPLICATION", processingStatus: "COMPLETED" }],
    });
    render(<PosDocumentApp />);
    await screen.findByText(/POS document portal/i);
    // Load detail directly through App state via search flow.
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    const pdfLink = await screen.findByRole("link", { name: /open pdf/i });
    expect(pdfLink.getAttribute("href")).toBe(
      `/api/v1/pos-records/${recordId}/documents/doc-1/content`,
    );
    expect(pdfLink.getAttribute("rel")).toContain("noopener");
    const zipLink = screen.getByRole("link", { name: /download original zip/i });
    expect(zipLink.getAttribute("href")).toBe(
      `/api/v1/pos-records/${recordId}/source-archive/content`,
    );
  });

  it("clears data when a later request returns 401", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch.mockResolvedValue({
      ok: false,
      error: { status: 401, code: "unauthorized", title: "Unauthorized", detail: "" },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("link", { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByText(/Test User/)).not.toBeInTheDocument();
  });
});

describe("uploadZip over real XHR (mocked transport)", () => {
  class FakeXHR {
    static instances: FakeXHR[] = [];
    static onload = () => {};
    open = vi.fn();
    send = vi.fn();
    setRequestHeader = vi.fn();
    abort = vi.fn();
    withCredentials = false;
    responseType = "";
    response: unknown = null;
    upload = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    constructor() {
      FakeXHR.instances.push(this);
    }
  }
  beforeEach(() => {
    FakeXHR.instances = [];
    document.cookie = "XSRF-TOKEN=token-abc; Path=/";
    window.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  });
  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; Max-Age=0";
  });

  it("sends multipart FormData, withCredentials, and the CSRF header", async () => {
    const realApi = await vi.importActual<typeof import("./api")>("./api");
    const controller = new AbortController();
    const promise = realApi.uploadZip({
      file: new File(["PK"], "archive.zip", { type: "application/zip" }),
      policyNumber: "P123",
      signal: controller.signal,
    });
    const xhr = FakeXHR.instances[0];
    expect(xhr.open).toHaveBeenCalledWith("POST", "/api/v1/pos-records");
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.setRequestHeader).toHaveBeenCalledWith("X-XSRF-TOKEN", "token-abc");
    const formData = xhr.send.mock.calls[0][0] as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("file")).toBeInstanceOf(File);
    expect(formData.get("policyNumber")).toBe("P123");
    // Resolve the request as a 202.
    xhr.response = { posRecordId: "r-9", jobId: "j-9" };
    Object.defineProperty(xhr, "status", { value: 202 });
    xhr.onload?.();
    await expect(promise).resolves.toEqual({ posRecordId: "r-9", jobId: "j-9" });
  });

  it("parses RFC 7807 error bodies from xhr.response (not responseText)", async () => {
    const realApi = await vi.importActual<typeof import("./api")>("./api");
    const promise = realApi.uploadZip({
      file: new File(["PK"], "archive.zip", { type: "application/zip" }),
      signal: new AbortController().signal,
    });
    const xhr = FakeXHR.instances[0];
    xhr.response = { title: "Conflict", detail: "DUPLICATE_POLICY_NUMBER at 192.168.1.35" };
    Object.defineProperty(xhr, "status", { value: 409 });
    xhr.onload?.();
    await expect(promise).rejects.toMatchObject({
      status: 409,
      title: "Conflict",
      // IP address is stripped from the detail.
      detail: "DUPLICATE_POLICY_NUMBER at",
    });
  });
});

describe("polling lifecycle", () => {
  it("stops polling on logout and unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
      mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
      mockGetJob.mockResolvedValue({
        ok: true,
        job: {
          id: "j-1",
          status: "IN_PROGRESS",
          attemptCount: 1,
          errorCode: null,
          errorMessage: null,
        },
      });
      mockLogout.mockResolvedValue(undefined);
      const { unmount } = render(<PosDocumentApp />);
      await screen.findByText(/Upload POS archive/i);
      const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
      await userEvent.upload(
        fileInput,
        new File(["PK"], "archive.zip", { type: "application/zip" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Upload" }));
      await waitFor(() => expect(mockGetJob).toHaveBeenCalledTimes(1));

      await userEvent.click(screen.getByRole("button", { name: /log out/i }));
      const callsAfterLogout = mockGetJob.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockGetJob.mock.calls.length).toBe(callsAfterLogout);

      // Unmount also stops any future polling.
      unmount();
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockGetJob.mock.calls.length).toBe(callsAfterLogout);
    } finally {
      vi.useRealTimers();
    }
  });

  it("times out after 5 minutes and offers a manual Refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
      mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
      mockGetJob.mockResolvedValue({
        ok: true,
        job: {
          id: "j-1",
          status: "IN_PROGRESS",
          attemptCount: 5,
          errorCode: null,
          errorMessage: null,
        },
      });
      render(<PosDocumentApp />);
      await screen.findByText(/Upload POS archive/i);
      const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
      await userEvent.upload(
        fileInput,
        new File(["PK"], "archive.zip", { type: "application/zip" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Upload" }));
      await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
      expect(await screen.findByText(/polling timed out/i)).toBeInTheDocument();

      mockGetJob.mockResolvedValue({
        ok: true,
        job: {
          id: "j-1",
          status: "COMPLETED",
          attemptCount: 6,
          errorCode: null,
          errorMessage: null,
        },
      });
      await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await waitFor(() => expect(screen.getByText(/Processing completed./i)).toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops polling and signs out when the job endpoint returns 401", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
    mockGetJob.mockResolvedValue({
      ok: false,
      error: { status: 401, code: "unauthorized", title: "Unauthorized", detail: "" },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Upload POS archive/i);
    const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
    await userEvent.upload(fileInput, new File(["PK"], "archive.zip", { type: "application/zip" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByRole("link", { name: /sign in with google/i })).toBeInTheDocument();
    expect(mockGetJob).toHaveBeenCalledTimes(1);
  });
});

describe("401 clears previously visible PII", () => {
  it("removes visible record data and returns to signed-out", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockGetRecord.mockResolvedValue({ ok: true, record: recordDetail });
    mockGetDocuments.mockResolvedValue({ ok: true, documents: [] });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);

    // Make record PII visible.
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    expect((await screen.findAllByText(/Jane Sample/)).length).toBeGreaterThan(0);

    // A later request returns 401.
    mockSearch.mockResolvedValue({
      ok: false,
      error: { status: 401, code: "unauthorized", title: "Unauthorized", detail: "" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("link", { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByText(/Jane Sample/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Test User/)).not.toBeInTheDocument();
  });
});

describe("LAN safety", () => {
  it("frontend source contains no LAN addresses", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const collect = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) return collect(full);
        if (full.endsWith(".test.tsx") || full.endsWith(".test.ts")) return [];
        return [full];
      });
    const files = [...collect("src/features/pos"), ...collect("src/pages/pos")];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, file).not.toMatch(/192\.168\.1\.(34|35)/);
      expect(content, file).not.toMatch(/18080|:8080/);
    }
  });
});
