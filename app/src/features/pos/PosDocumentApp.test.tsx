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
    downloadSearchPage: vi.fn(),
    getRecord: vi.fn(),
    getRecordDocuments: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
    verifyRecord: vi.fn(),
    getIngestionJob: vi.fn(),
    uploadZip: vi.fn(),
  };
});

const mockCurrentUser = vi.mocked(api.getCurrentUser);
const mockLogout = vi.mocked(api.logout);
const mockSearch = vi.mocked(api.searchRecords);
const mockDownload = vi.mocked(api.downloadSearchPage);
const mockGetRecord = vi.mocked(api.getRecord);
const mockGetDocuments = vi.mocked(api.getRecordDocuments);
const mockUpdateRecord = vi.mocked(api.updateRecord);
const mockDeleteRecord = vi.mocked(api.deleteRecord);
const mockVerifyRecord = vi.mocked(api.verifyRecord);
const mockGetJob = vi.mocked(api.getIngestionJob);
const mockUpload = vi.mocked(api.uploadZip);

type SearchResult = Awaited<ReturnType<typeof api.searchRecords>>;

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

describe("search page download", () => {
  it("uses consultant and exact matching, retaining submitted criteria during paging", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({
      ok: true,
      results: { ...searchPage, totalPages: 2, totalElements: 21 },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Roles: USER, REVIEWER/);
    await userEvent.type(screen.getByLabelText("Search consultant"), "Avery Tan");
    await userEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await waitFor(() =>
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          consultantName: "Avery Tan",
          fuzzyName: false,
          page: 0,
        }),
      ),
    );
    await userEvent.clear(screen.getByLabelText("Search consultant"));
    await userEvent.type(screen.getByLabelText("Search consultant"), "unsent edit");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(mockSearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          consultantName: "Avery Tan",
          fuzzyName: false,
          page: 1,
        }),
      ),
    );
  });

  it("offers settled reviewer page IDs and reports archive errors", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    mockDownload.mockResolvedValue({
      ok: false,
      error: {
        status: 409,
        code: "PAGE_CHANGED",
        title: "Conflict",
        detail: "A displayed record is no longer available.",
      },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Roles: USER, REVIEWER/);
    expect(screen.queryByRole("button", { name: "Download all" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Download all" }));
    expect(mockDownload).toHaveBeenCalledWith([searchPage.items[0].id]);
    expect(await screen.findByText(/displayed record is no longer available/i)).toBeInTheDocument();
  });

  it("hides bulk action for USER and empty pages", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    const view = render(<PosDocumentApp />);
    await screen.findByText(/Roles: USER/);
    await userEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await screen.findByText("EREF-2026-00123");
    expect(screen.queryByRole("button", { name: "Download all" })).not.toBeInTheDocument();
    view.unmount();
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({
      ok: true,
      results: { ...searchPage, items: [], totalElements: 0, totalPages: 0 },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Roles: USER, REVIEWER/);
    await userEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    await screen.findByText(/No matching records/);
    expect(screen.queryByRole("button", { name: "Download all" })).not.toBeInTheDocument();
  });

  it("saves a completed ZIP and hides the action while a new search is pending", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValueOnce({ ok: true, results: searchPage });
    let completeSearch: (result: SearchResult) => void = () => {};
    mockSearch.mockImplementationOnce(
      () =>
        new Promise<SearchResult>((resolve) => {
          completeSearch = resolve;
        }),
    );
    const blob = new Blob(["ZIP"], { type: "application/zip" });
    mockDownload.mockResolvedValue({ ok: true, blob });
    const createObjectURL = vi.fn(() => "blob:test-download");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("pos-search-page.zip");
      expect(this.href).toBe("blob:test-download");
    });
    try {
      render(<PosDocumentApp />);
      await screen.findByText(/Roles: USER, REVIEWER/);
      await userEvent.click(screen.getByRole("button", { name: /^Search$/ }));
      await userEvent.click(await screen.findByRole("button", { name: "Download all" }));
      await waitFor(() => expect(click).toHaveBeenCalledOnce());
      expect(createObjectURL).toHaveBeenCalledWith(blob);
      await userEvent.click(screen.getByRole("button", { name: /^Search$/ }));
      expect(screen.queryByRole("button", { name: "Download all" })).not.toBeInTheDocument();
      completeSearch({ ok: true, results: searchPage });
      expect(await screen.findByRole("button", { name: "Download all" })).toBeInTheDocument();
    } finally {
      click.mockRestore();
    }
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
      documents: [
        {
          id: "doc-1",
          filename: "application.pdf",
          documentType: "UNKNOWN",
          processingStatus: "COMPLETED",
        },
      ],
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText(/EREF-2026-00123/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /view details/i }));
    expect(await screen.findByText(/Record details/i)).toBeInTheDocument();
    expect(screen.getByText(/application.pdf/)).toBeInTheDocument();
    expect(screen.queryByText(/Type:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Open PDF/)).not.toBeInTheDocument(); // USER cannot open PDFs
  });

  it("shows the filename and processing status on document rows", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    mockGetRecord.mockResolvedValue({ ok: true, record: { ...recordDetail, documents: [] } });
    mockGetDocuments.mockResolvedValue({
      ok: true,
      documents: [
        {
          id: "doc-1",
          filename: "application.pdf",
          documentType: "FA_PRUPLANNER_REPORT",
          processingStatus: "SKIPPED",
        },
      ],
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    expect(await screen.findByText("application.pdf | SKIPPED")).toBeInTheDocument();
  });

  it("REVIEWER sees Open PDF and Download original ZIP using relative URLs", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    const recordId = "11111111-1111-1111-1111-111111111111";
    mockGetRecord.mockResolvedValue({
      ok: true,
      record: {
        ...recordDetail,
        id: recordId,
        documents: [
          {
            id: "doc-1",
            filename: "application.pdf",
            documentType: "UNKNOWN",
            processingStatus: "COMPLETED",
          },
        ],
      },
    });
    mockGetDocuments.mockResolvedValue({
      ok: true,
      documents: [
        {
          id: "doc-1",
          filename: "application.pdf",
          documentType: "UNKNOWN",
          processingStatus: "COMPLETED",
        },
      ],
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

async function showReviewerRecord() {
  mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
  mockSearch.mockResolvedValue({ ok: true, results: searchPage });
  render(<PosDocumentApp />);
  await screen.findByText(/Search POS records/i);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
  await screen.findByRole("button", { name: "Edit" });
}

// Load a REVIEW_REQUIRED record for a reviewer so the Verify button is visible.
async function showReviewerReviewRequiredRecord() {
  mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
  mockSearch.mockResolvedValue({ ok: true, results: searchPage });
  mockGetRecord.mockResolvedValue({
    ok: true,
    record: { ...recordDetail, status: "REVIEW_REQUIRED" },
  });
  render(<PosDocumentApp />);
  await screen.findByText(/Search POS records/i);
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
  await screen.findByRole("button", { name: "Verify" });
}

// Build a search page of `count` results for a given zero-based page (size 20).
function makeSearchPage(count: number, page = 0, size = 20) {
  const items = [];
  for (let i = 0; i < Math.min(size, Math.max(0, count - page * size)); i += 1) {
    const globalIndex = page * size + i;
    items.push({
      id: `id-${globalIndex}`,
      erefNumber: `EREF-${globalIndex}`,
      policyNumber: `P${globalIndex}`,
      policyholderName: `Name ${globalIndex}`,
      consultantName: "Con",
      policyCreateDate: "2026-01-01",
      status: "COMPLETED",
      uploadedAt: "2026-01-02T00:00:00Z",
      updatedAt: "2026-01-03T00:00:00Z",
    });
  }
  return { items, page, size, totalElements: count, totalPages: Math.ceil(count / size) };
}

describe("reviewer record actions", () => {
  it("only offers editing for reviewable statuses", async () => {
    mockGetRecord.mockResolvedValue({
      ok: true,
      record: { ...recordDetail, status: "PROCESSING" },
    });
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    expect(await screen.findByText("PROCESSING")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("sends only changed fields and updates the displayed version", async () => {
    mockUpdateRecord.mockResolvedValue({
      ok: true,
      record: { ...recordDetail, policyNumber: "P999", version: 4 },
    });
    await showReviewerRecord();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();
    const policy = screen.getAllByLabelText("Policy number").at(-1) as HTMLInputElement;
    await userEvent.clear(policy);
    await userEvent.type(policy, "P999");
    await userEvent.click(save);
    expect(mockUpdateRecord).toHaveBeenCalledWith(recordDetail.id, {
      expectedVersion: 3,
      policyNumber: "P999",
    });
    expect(await screen.findByText("P999")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows a 412 error and reloads the latest record", async () => {
    mockGetRecord
      .mockResolvedValueOnce({ ok: true, record: recordDetail })
      .mockResolvedValueOnce({ ok: true, record: { ...recordDetail, version: 4 } });
    mockUpdateRecord.mockResolvedValue({
      ok: false,
      error: {
        status: 412,
        code: "POS_RECORD_VERSION_MISMATCH",
        title: "Version mismatch",
        detail: "",
      },
    });
    await showReviewerRecord();
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.type(screen.getByLabelText("Consultant name"), " Jr");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Version mismatch")).toBeInTheDocument();
    await waitFor(() => expect(mockGetRecord).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  it("requires confirmation and clears the detail after delete", async () => {
    mockDeleteRecord.mockResolvedValue({ ok: true });
    await showReviewerRecord();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(mockDeleteRecord).toHaveBeenCalledWith(recordDetail.id);
    await waitFor(() => expect(screen.queryByText("Record details")).not.toBeInTheDocument());
  });

  it("reloads after a delete conflict", async () => {
    mockDeleteRecord.mockResolvedValue({
      ok: false,
      error: { status: 409, code: "POS_RECORD_DELETE_CONFLICT", title: "Conflict", detail: "" },
    });
    await showReviewerRecord();
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
    expect(await screen.findByText("Record changed concurrently, try again.")).toBeInTheDocument();
    await waitFor(() => expect(mockGetRecord).toHaveBeenCalledTimes(2));
  });
});

describe("verify action", () => {
  it("shows Verify for a reviewer on a REVIEW_REQUIRED record", async () => {
    await showReviewerReviewRequiredRecord();
    expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();
  });

  it("hides Verify on a non-REVIEW_REQUIRED record", async () => {
    // recordDetail is COMPLETED, so Verify must not appear even for a reviewer.
    await showReviewerRecord();
    expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
  });

  it("hides Verify for a USER session", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    mockGetRecord.mockResolvedValue({
      ok: true,
      record: { ...recordDetail, status: "REVIEW_REQUIRED" },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    expect(await screen.findByText("REVIEW_REQUIRED")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();
  });

  it("verify success updates status/version and re-runs the current search", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    mockGetRecord.mockResolvedValue({
      ok: true,
      record: { ...recordDetail, status: "REVIEW_REQUIRED" },
    });
    mockVerifyRecord.mockResolvedValue({
      ok: true,
      record: { ...recordDetail, status: "COMPLETED", version: recordDetail.version + 1 },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    const searchesBefore = mockSearch.mock.calls.length;
    await userEvent.click(await screen.findByRole("button", { name: "Verify" }));
    expect(mockVerifyRecord).toHaveBeenCalledWith(recordDetail.id, recordDetail.version);
    expect(await screen.findByText(String(recordDetail.version + 1))).toBeInTheDocument();
    expect(screen.queryByText("REVIEW_REQUIRED")).not.toBeInTheDocument();
    await waitFor(() => expect(mockSearch.mock.calls.length).toBeGreaterThan(searchesBefore));
  });

  it("shows a banner with the API detail on a 409 verify conflict", async () => {
    mockVerifyRecord.mockResolvedValue({
      ok: false,
      error: {
        status: 409,
        code: "POS_RECORD_NOT_REVIEWABLE",
        title: "Not reviewable",
        detail: "status is COMPLETED",
      },
    });
    await showReviewerReviewRequiredRecord();
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Not reviewable")).toBeInTheDocument();
    expect(screen.getByText("status is COMPLETED")).toBeInTheDocument();
  });

  it("shows a banner and reloads the record on a 412 verify mismatch", async () => {
    mockGetRecord
      .mockResolvedValueOnce({ ok: true, record: { ...recordDetail, status: "REVIEW_REQUIRED" } })
      .mockResolvedValueOnce({
        ok: true,
        record: { ...recordDetail, status: "REVIEW_REQUIRED", version: 5 },
      });
    mockVerifyRecord.mockResolvedValue({
      ok: false,
      error: {
        status: 412,
        code: "POS_RECORD_VERSION_MISMATCH",
        title: "Version mismatch",
        detail: "",
      },
    });
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    await userEvent.click(await screen.findByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Version mismatch")).toBeInTheDocument();
    await waitFor(() => expect(mockGetRecord).toHaveBeenCalledTimes(2));
  });

  it("shows a banner with the API detail on a 422 prerequisite failure", async () => {
    mockVerifyRecord.mockResolvedValue({
      ok: false,
      error: {
        status: 422,
        code: "VERIFICATION_PREREQUISITES_UNMET",
        title: "Prerequisites unmet",
        detail: "consultantName is required",
      },
    });
    await showReviewerReviewRequiredRecord();
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByText("Prerequisites unmet")).toBeInTheDocument();
    expect(screen.getByText("consultantName is required")).toBeInTheDocument();
  });
});

describe("search pagination and freshness", () => {
  it("shows an always-visible indicator plus numbered and Previous/Next controls", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch.mockResolvedValue({ ok: true, results: makeSearchPage(40, 0) });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.type(screen.getByLabelText(/eref number/i), "EREF-X");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("40 results · page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
  });

  it("keeps the submitted filters when paging to a numbered page", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch.mockResolvedValue({ ok: true, results: makeSearchPage(40, 0) });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.type(screen.getByLabelText(/eref number/i), "EREF-X");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("40 results · page 1 of 2");
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => {
      const last = mockSearch.mock.calls.at(-1)?.[0];
      expect(last?.page).toBe(1);
      expect(last?.erefNumber).toBe("EREF-X");
    });
  });

  it("recovers to the last valid page when a requested page is out of range", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    mockSearch
      .mockResolvedValueOnce({ ok: true, results: makeSearchPage(40, 0) })
      // The next request (page 1) comes back empty because the total shrank.
      .mockResolvedValueOnce({
        ok: true,
        results: { items: [], page: 1, size: 20, totalElements: 15, totalPages: 1 },
      })
      // The recovery request for the last valid page (0) succeeds.
      .mockResolvedValueOnce({ ok: true, results: makeSearchPage(15, 0) });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("40 results · page 1 of 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => {
      const last = mockSearch.mock.calls.at(-1)?.[0];
      expect(last?.page).toBe(0);
    });
    expect(await screen.findByText("15 results · page 1 of 1")).toBeInTheDocument();
  });

  it("does not render a stale search response when a newer search is in flight", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({ ok: true, results: makeSearchPage(40, 0) });
    mockGetRecord.mockResolvedValue({ ok: true, record: recordDetail });
    mockGetDocuments.mockResolvedValue({ ok: true, documents: [] });
    mockDeleteRecord.mockResolvedValue({ ok: true });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("40 results · page 1 of 2")).toBeInTheDocument();
    // Select a record so it can be deleted (the delete will bump the refresh token).
    const viewDetails = await screen.findAllByRole("button", { name: /view details/i });
    await userEvent.click(viewDetails[0]);
    await screen.findByRole("button", { name: "Delete" });
    // A page-1 search (A) starts and stays in flight.
    let resolveA: (value: SearchResult) => void = () => {};
    const pendingA: Promise<SearchResult> = new Promise((resolve) => {
      resolveA = resolve;
    });
    mockSearch.mockReturnValueOnce(pendingA);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    // Deleting bumps the refresh token, firing search (B) at the same page while A is in flight.
    let resolveB: (value: SearchResult) => void = () => {};
    const pendingB: Promise<SearchResult> = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockSearch.mockReturnValueOnce(pendingB);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirm delete" }));
    await waitFor(() => expect(mockSearch.mock.calls.length).toBe(3));
    // The NEW search (B) resolves first.
    resolveB({ ok: true, results: makeSearchPage(25, 1) });
    await waitFor(() => expect(screen.getByText("25 results · page 2 of 2")).toBeInTheDocument());
    // The OLD search (A) resolves LAST and must be dropped.
    resolveA({ ok: true, results: makeSearchPage(100, 1) });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("25 results · page 2 of 2")).toBeInTheDocument();
    expect(screen.queryByText(/100 results/)).not.toBeInTheDocument();
  });

  it("delete -> reupload same eRef: search shows the new record and it opens without 404", async () => {
    const oldSummary = {
      id: "old-id",
      erefNumber: "EREF-A",
      policyNumber: "PA",
      policyholderName: "Holder Old",
      consultantName: "Con",
      policyCreateDate: "2026-01-01",
      status: "REVIEW_REQUIRED",
      uploadedAt: "2026-01-02T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    };
    const newSummary = { ...oldSummary, id: "new-id", policyholderName: "Holder New" };
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch
      .mockResolvedValueOnce({
        ok: true,
        results: { items: [oldSummary], page: 0, size: 20, totalElements: 1, totalPages: 1 },
      })
      // After the delete, the refreshed search lists the re-uploaded (new) record.
      .mockResolvedValue({
        ok: true,
        results: { items: [newSummary], page: 0, size: 20, totalElements: 1, totalPages: 1 },
      });
    mockGetRecord.mockResolvedValue({
      ok: true,
      record: { ...recordDetail, id: "new-id", erefNumber: "EREF-A" },
    });
    mockGetDocuments.mockResolvedValue({ ok: true, documents: [] });
    mockDeleteRecord.mockResolvedValue({ ok: true });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.type(screen.getByLabelText(/eref number/i), "EREF-A");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Holder Old")).toBeInTheDocument();
    // Open and delete the old record.
    await userEvent.click(screen.getByRole("button", { name: /view details/i }));
    await screen.findByRole("button", { name: "Delete" });
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirm delete" }));
    // The search refreshes: the stale old row is gone and the new record is listed.
    await waitFor(() => expect(mockSearch.mock.calls.length).toBe(2));
    expect(await screen.findByText("Holder New")).toBeInTheDocument();
    expect(screen.queryByText("Holder Old")).not.toBeInTheDocument();
    // Viewing the new record opens its detail without a 404.
    await userEvent.click(screen.getByRole("button", { name: /view details/i }));
    expect(await screen.findByText(/Record details/i)).toBeInTheDocument();
  });

  it("clears the selection silently when a record returns 404", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({
      ok: true,
      results: {
        items: [
          {
            id: "ghost-id",
            erefNumber: "EREF-GHOST",
            policyNumber: "PG",
            policyholderName: "Ghost",
            consultantName: "Con",
            policyCreateDate: "2026-01-01",
            status: "REVIEW_REQUIRED",
            uploadedAt: "2026-01-02T00:00:00Z",
            updatedAt: "2026-01-02T00:00:00Z",
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      },
    });
    mockGetRecord.mockResolvedValue({
      ok: false,
      error: { status: 404, code: "POS_RECORD_NOT_FOUND", title: "Not found", detail: "" },
    });
    mockGetDocuments.mockResolvedValue({ ok: true, documents: [] });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: /view details/i }));
    await waitFor(() => expect(screen.queryByText(/Record details/i)).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("windows numbered pages with ellipses when there are more than 7 pages", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: signedInUser });
    // 200 results = 10 pages; current zero-based page 3 ("4" of 10).
    mockSearch.mockResolvedValue({ ok: true, results: makeSearchPage(200, 3) });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("200 results · page 4 of 10")).toBeInTheDocument();
    // First page, window around the current page (2,3,4), last page — nothing else.
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "6" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "7" })).not.toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("re-runs the current search when an upload completes", async () => {
    mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
    mockSearch.mockResolvedValue({ ok: true, results: searchPage });
    mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
    mockGetJob.mockResolvedValue({
      ok: true,
      job: { id: "j-1", status: "COMPLETED", attemptCount: 1, errorCode: null, errorMessage: null },
    });
    render(<PosDocumentApp />);
    await screen.findByText(/Search POS records/i);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("1 result · page 1 of 1")).toBeInTheDocument();
    const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
    await userEvent.upload(fileInput, new File(["PK"], "archive.zip", { type: "application/zip" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(mockSearch.mock.calls.length).toBe(2));
  });

  it("re-runs the current search after a successful edit", async () => {
    await showReviewerRecord();
    expect(mockSearch.mock.calls.length).toBe(1);
    mockUpdateRecord.mockResolvedValue({
      ok: true,
      record: { ...recordDetail, policyNumber: "P777", version: recordDetail.version + 1 },
    });
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const policy = screen.getAllByLabelText("Policy number").at(-1) as HTMLInputElement;
    await userEvent.clear(policy);
    await userEvent.type(policy, "P777");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("P777")).toBeInTheDocument();
    await waitFor(() => expect(mockSearch.mock.calls.length).toBe(2));
  });
});

describe("record API transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends merge-patch content type and a fresh CSRF header", async () => {
    document.cookie = "XSRF-TOKEN=edit-token; Path=/";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...recordDetail, version: 4 }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const realApi = await vi.importActual<typeof import("./api")>("./api");
    await realApi.updateRecord(recordDetail.id, { expectedVersion: 3, policyNumber: "P999" });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/pos-records/${recordDetail.id}`,
      expect.objectContaining({
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/merge-patch+json",
          "X-XSRF-TOKEN": "edit-token",
        },
        body: JSON.stringify({ expectedVersion: 3, policyNumber: "P999" }),
      }),
    );
    document.cookie = "XSRF-TOKEN=; Max-Age=0";
  });

  it("sends CSRF on delete and parses the stored filename", async () => {
    document.cookie = "XSRF-TOKEN=delete-token; Path=/";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "doc-1",
              documentType: "UNKNOWN",
              processingStatus: "COMPLETED",
              storageObject: { originalFilename: "stored.pdf" },
            },
            { id: "doc-2", documentType: "UNKNOWN", processingStatus: "COMPLETED" },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const realApi = await vi.importActual<typeof import("./api")>("./api");
    expect(await realApi.deleteRecord(recordDetail.id)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/pos-records/${recordDetail.id}`,
      expect.objectContaining({ method: "DELETE", headers: { "X-XSRF-TOKEN": "delete-token" } }),
    );
    expect(await realApi.getRecordDocuments(recordDetail.id)).toMatchObject({
      ok: true,
      documents: [{ filename: "stored.pdf" }, { filename: "" }],
    });
    document.cookie = "XSRF-TOKEN=; Max-Age=0";
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
  it("stops polling on logout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
      mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
      mockGetJob.mockResolvedValue({
        ok: true,
        job: { id: "j-1", status: "RUNNING", attemptCount: 1, errorCode: null, errorMessage: null },
      });
      mockLogout.mockResolvedValue(undefined);
      render(<PosDocumentApp />);
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
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops polling on unmount while the job is still active", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
      mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
      mockGetJob.mockResolvedValue({
        ok: true,
        job: { id: "j-1", status: "RUNNING", attemptCount: 1, errorCode: null, errorMessage: null },
      });
      const { unmount } = render(<PosDocumentApp />);
      await screen.findByText(/Upload POS archive/i);
      const fileInput = screen.getByLabelText(/zip archive/i) as HTMLInputElement;
      await userEvent.upload(
        fileInput,
        new File(["PK"], "archive.zip", { type: "application/zip" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Upload" }));
      await waitFor(() => expect(mockGetJob).toHaveBeenCalledTimes(1));

      unmount();
      const callsAfterUnmount = mockGetJob.mock.calls.length;
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockGetJob.mock.calls.length).toBe(callsAfterUnmount);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps polling through RETRY_SCHEDULED with attempt counts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockCurrentUser.mockResolvedValue({ ok: true, user: reviewer });
      mockUpload.mockResolvedValue({ posRecordId: "r-1", jobId: "j-1" });
      mockGetJob
        .mockResolvedValueOnce({
          ok: true,
          job: {
            id: "j-1",
            status: "RUNNING",
            attemptCount: 1,
            errorCode: null,
            errorMessage: null,
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          job: {
            id: "j-1",
            status: "RETRY_SCHEDULED",
            attemptCount: 2,
            errorCode: "OCR_TIMEOUT",
            errorMessage: null,
          },
        })
        .mockResolvedValue({
          ok: true,
          job: {
            id: "j-1",
            status: "COMPLETED",
            attemptCount: 3,
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
      await waitFor(() => expect(mockGetJob).toHaveBeenCalledTimes(1));

      await vi.advanceTimersByTimeAsync(2100);
      await waitFor(() => expect(mockGetJob).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(/attempts: 2/)).toBeInTheDocument();

      await vi.advanceTimersByTimeAsync(2100);
      await waitFor(() => expect(screen.getByText(/Processing completed./i)).toBeInTheDocument());
      expect(mockGetJob).toHaveBeenCalledTimes(3);
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
          status: "RUNNING",
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
