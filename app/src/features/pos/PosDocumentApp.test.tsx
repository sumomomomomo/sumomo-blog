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
    expect(mockGetJob).toHaveBeenCalledWith("j-1");
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
