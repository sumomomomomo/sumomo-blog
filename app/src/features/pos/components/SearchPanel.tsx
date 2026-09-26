import { useEffect, useRef, useState } from "react";
import {
  type ApiError,
  downloadSearchPage,
  MAX_STRING_LENGTHS,
  type PosRecordSummary,
  type SearchCriteria,
  type SearchPage,
  searchRecords,
} from "../api";

interface Props {
  onUnauthorized: () => void;
  onResults: (page: SearchPage | null) => void;
  onSelectRecord: (posRecordId: string) => void;
  /** Bumped by the parent after a mutation so the last submitted search re-runs. */
  refreshToken: number;
  isReviewer: boolean;
}

function orNotAvailable(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "Not available";
}

type PageItem = { type: "page"; page: number } | { type: "ellipsis"; id: string };

// Show every page when there are few, otherwise first/last plus a window around the current page.
function windowedPages(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      type: "page" as const,
      page: index,
    }));
  }
  const items: PageItem[] = [{ type: "page", page: 0 }];
  const start = Math.max(1, current - 1);
  const end = Math.min(totalPages - 2, current + 1);
  if (start > 1) items.push({ type: "ellipsis", id: "before-window" });
  for (let page = start; page <= end; page += 1) items.push({ type: "page", page });
  if (end < totalPages - 2) items.push({ type: "ellipsis", id: "after-window" });
  items.push({ type: "page", page: totalPages - 1 });
  return items;
}

function ResultRow({
  record,
  onSelect,
}: {
  record: PosRecordSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <li className="rounded border border-stone-300 p-3 dark:border-slate-600">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <dt className="font-medium">eRef</dt>
          <dd>{orNotAvailable(record.erefNumber)}</dd>
        </div>
        <div>
          <dt className="font-medium">Policy number</dt>
          <dd>{orNotAvailable(record.policyNumber)}</dd>
        </div>
        <div>
          <dt className="font-medium">Policyholder</dt>
          <dd>{orNotAvailable(record.policyholderName)}</dd>
        </div>
        <div>
          <dt className="font-medium">Consultant</dt>
          <dd>{orNotAvailable(record.consultantName)}</dd>
        </div>
        <div>
          <dt className="font-medium">Policy created</dt>
          <dd>{orNotAvailable(record.policyCreateDate)}</dd>
        </div>
        <div>
          <dt className="font-medium">Status</dt>
          <dd>{record.status}</dd>
        </div>
        <div>
          <dt className="font-medium">Updated</dt>
          <dd>{orNotAvailable(record.updatedAt)}</dd>
        </div>
      </dl>
      <button
        type="button"
        className="mt-2 rounded border border-stone-400 px-3 py-1 text-sm hover:bg-stone-100 dark:hover:bg-slate-700"
        onClick={() => onSelect(record.id)}
      >
        View details
      </button>
    </li>
  );
}

export default function SearchPanel({
  onUnauthorized,
  onResults,
  onSelectRecord,
  refreshToken,
  isReviewer,
}: Props) {
  const [erefNumber, setErefNumber] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [policyholderName, setPolicyholderName] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [fuzzyName, setFuzzyName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [results, setLocalResults] = useState<SearchPage | null>(null);
  const [searched, setSearched] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<ApiError | null>(null);

  // Request-sequence guard: only the newest search response is applied.
  const searchSeq = useRef(0);
  const lastPage = useRef(0);
  const hasSearched = useRef(false);
  const firstRefresh = useRef(true);
  const submitted = useRef<SearchCriteria | null>(null);

  const runSearch = async (targetPage: number, useSubmitted = false) => {
    const criteria =
      useSubmitted && submitted.current
        ? submitted.current
        : {
            erefNumber: erefNumber.trim() || undefined,
            policyNumber: policyNumber.trim() || undefined,
            policyholderName: policyholderName.trim() || undefined,
            consultantName: consultantName.trim() || undefined,
            fuzzyName,
          };
    submitted.current = criteria;
    const seq = ++searchSeq.current;
    lastPage.current = targetPage;
    hasSearched.current = true;
    setLoading(true);
    setError(null);
    setDownloadError(null);
    setLocalResults(null);
    const outcome = await searchRecords({
      ...criteria,
      page: targetPage,
    });
    // Drop stale responses: a newer search has since been requested.
    if (seq !== searchSeq.current) return;
    setLoading(false);
    setSearched(true);
    if (outcome.ok) {
      const page = outcome.results;
      // Out-of-range recovery: the requested page is empty but results exist
      // (e.g. the total shrank), so jump to the last valid page.
      if (page.items.length === 0 && page.totalElements > 0 && targetPage > 0) {
        const lastValid = Math.max(0, Math.ceil(page.totalElements / page.size) - 1);
        if (lastValid !== targetPage) {
          void runSearch(lastValid, true);
          return;
        }
      }
      setLocalResults(page);
      onResults(page);
    } else if (outcome.error.status === 401) {
      onUnauthorized();
    } else {
      setError(outcome.error);
      setLocalResults(null);
      onResults(null);
    }
  };

  // Always invoke the latest runSearch (with fresh filter state) from the effect.
  const runSearchRef = useRef(runSearch);
  runSearchRef.current = runSearch;

  // Re-run the last submitted search when the parent bumps the refresh token.
  useEffect(() => {
    if (firstRefresh.current) {
      firstRefresh.current = false;
      return;
    }
    if (hasSearched.current) {
      void runSearchRef.current(lastPage.current, true);
    }
  }, [refreshToken]);

  const handleClear = () => {
    setErefNumber("");
    setPolicyNumber("");
    setPolicyholderName("");
    setConsultantName("");
    setFuzzyName(false);
    setLocalResults(null);
    onResults(null);
    setError(null);
    setSearched(false);
    setDownloadError(null);
    submitted.current = null;
    hasSearched.current = false;
    searchSeq.current += 1;
  };

  const handleDownload = async () => {
    if (!results?.items.length || loading || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    const outcome = await downloadSearchPage(results.items.map((item) => item.id));
    setDownloading(false);
    if (!outcome.ok) {
      if (outcome.error.status === 401) onUnauthorized();
      else setDownloadError(outcome.error);
      return;
    }
    const url = URL.createObjectURL(outcome.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pos-search-page.zip";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const totalPages = results?.totalPages ?? 0;

  return (
    <section className="rounded border border-stone-300 bg-white p-4 dark:bg-slate-800">
      <h2 className="mb-3 text-lg font-semibold">Search POS records</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(0);
        }}
        className="space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="pos-search-eref" className="block text-sm font-medium">
              eRef number
            </label>
            <input
              id="pos-search-eref"
              type="text"
              maxLength={MAX_STRING_LENGTHS.erefNumber}
              value={erefNumber}
              onChange={(event) => setErefNumber(event.target.value)}
              className="mt-1 w-full rounded border border-stone-300 bg-transparent p-2 text-sm dark:border-slate-600"
            />
          </div>
          <div>
            <label htmlFor="pos-search-policy" className="block text-sm font-medium">
              Policy number
            </label>
            <input
              id="pos-search-policy"
              type="text"
              maxLength={MAX_STRING_LENGTHS.policyNumber}
              value={policyNumber}
              onChange={(event) => setPolicyNumber(event.target.value)}
              className="mt-1 w-full rounded border border-stone-300 bg-transparent p-2 text-sm dark:border-slate-600"
            />
          </div>
          <div>
            <label htmlFor="pos-search-name" className="block text-sm font-medium">
              Policyholder name
            </label>
            <input
              id="pos-search-name"
              type="text"
              maxLength={MAX_STRING_LENGTHS.policyholderName}
              value={policyholderName}
              onChange={(event) => setPolicyholderName(event.target.value)}
              className="mt-1 w-full rounded border border-stone-300 bg-transparent p-2 text-sm dark:border-slate-600"
            />
          </div>
        </div>
        <div>
          <label htmlFor="pos-search-consultant" className="block text-sm font-medium">
            Search consultant
          </label>
          <input
            id="pos-search-consultant"
            type="text"
            maxLength={MAX_STRING_LENGTHS.consultantName}
            value={consultantName}
            onChange={(event) => setConsultantName(event.target.value)}
            className="mt-1 w-full rounded border border-stone-300 bg-transparent p-2 text-sm dark:border-slate-600"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              id="pos-search-fuzzy"
              type="checkbox"
              checked={fuzzyName}
              onChange={(event) => setFuzzyName(event.target.checked)}
            />
            Fuzzy name matching
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-stone-400 px-4 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700"
          >
            Clear
          </button>
        </div>
      </form>

      <div className="mt-4" aria-live="polite">
        {loading ? <p>Searching…</p> : null}
        {error ? (
          <div
            role="alert"
            className="rounded border border-red-400 bg-red-50 p-3 text-sm dark:bg-red-950"
          >
            <p className="font-semibold">{error.title}</p>
            {error.detail ? <p>{error.detail}</p> : null}
          </div>
        ) : null}
        {downloadError ? (
          <div role="alert" className="rounded border border-red-400 p-3 text-sm">
            <p className="font-semibold">Download failed: {downloadError.title}</p>
            {downloadError.detail ? <p>{downloadError.detail}</p> : null}
          </div>
        ) : null}
        {!loading && !error && searched && results && results.items.length === 0 ? (
          <p>No matching records found.</p>
        ) : null}
        {results && results.items.length > 0 ? (
          <>
            {isReviewer ? (
              <button
                type="button"
                disabled={loading || downloading}
                onClick={() => void handleDownload()}
                className="mb-3 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {downloading ? "Preparing download…" : "Download all"}
              </button>
            ) : null}
            <p className="mb-2 text-sm">
              {results.totalElements} result{results.totalElements === 1 ? "" : "s"} · page{" "}
              {results.page + 1} of {Math.max(totalPages, 1)}
            </p>
            <ul className="space-y-2">
              {results.items.map((record) => (
                <ResultRow key={record.id} record={record} onSelect={onSelectRecord} />
              ))}
            </ul>
            <nav
              aria-label="Search results pages"
              className="mt-3 flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                disabled={results.page <= 0 || loading}
                className="rounded border border-stone-400 px-3 py-1 text-sm disabled:opacity-50"
                onClick={() => void runSearch(results.page - 1, true)}
              >
                Previous
              </button>
              {windowedPages(results.page, Math.max(totalPages, 1)).map((item) =>
                item.type === "ellipsis" ? (
                  <span key={item.id} className="px-1 text-sm">
                    …
                  </span>
                ) : (
                  <button
                    key={item.page}
                    type="button"
                    disabled={loading || item.page === results.page}
                    aria-current={item.page === results.page ? "page" : undefined}
                    className="rounded border border-stone-400 px-3 py-1 text-sm disabled:opacity-50"
                    onClick={() => void runSearch(item.page, true)}
                  >
                    {item.page + 1}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={results.page >= totalPages - 1 || loading}
                className="rounded border border-stone-400 px-3 py-1 text-sm disabled:opacity-50"
                onClick={() => void runSearch(results.page + 1, true)}
              >
                Next
              </button>
            </nav>
          </>
        ) : null}
      </div>
    </section>
  );
}
