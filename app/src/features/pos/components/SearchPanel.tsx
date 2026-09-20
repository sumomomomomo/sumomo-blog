import { useState } from "react";
import {
  type ApiError,
  MAX_STRING_LENGTHS,
  type PosRecordSummary,
  type SearchPage,
  searchRecords,
} from "../api";

interface Props {
  onUnauthorized: () => void;
  onResults: (page: SearchPage | null) => void;
  onSelectRecord: (posRecordId: string) => void;
}

function orNotAvailable(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "Not available";
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

export default function SearchPanel({ onUnauthorized, onResults, onSelectRecord }: Props) {
  const [erefNumber, setErefNumber] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [policyholderName, setPolicyholderName] = useState("");
  const [fuzzyName, setFuzzyName] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [results, setLocalResults] = useState<SearchPage | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = async (targetPage: number) => {
    setLoading(true);
    setError(null);
    const outcome = await searchRecords({
      erefNumber: erefNumber.trim() || undefined,
      policyNumber: policyNumber.trim() || undefined,
      policyholderName: policyholderName.trim() || undefined,
      fuzzyName: fuzzyName || undefined,
      page: targetPage,
    });
    setLoading(false);
    setSearched(true);
    if (outcome.ok) {
      setLocalResults(outcome.results);
      onResults(outcome.results);
    } else if (outcome.error.status === 401) {
      onUnauthorized();
    } else {
      setError(outcome.error);
      setLocalResults(null);
      onResults(null);
    }
  };

  const handleClear = () => {
    setErefNumber("");
    setPolicyNumber("");
    setPolicyholderName("");
    setFuzzyName(false);
    setLocalResults(null);
    onResults(null);
    setError(null);
    setSearched(false);
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
        {!loading && !error && searched && results && results.items.length === 0 ? (
          <p>No matching records found.</p>
        ) : null}
        {results && results.items.length > 0 ? (
          <>
            <p className="mb-2 text-sm">
              {results.totalElements} result{results.totalElements === 1 ? "" : "s"}
              {totalPages > 1 ? ` · page ${results.page + 1} of ${totalPages}` : ""}
            </p>
            <ul className="space-y-2">
              {results.items.map((record) => (
                <ResultRow key={record.id} record={record} onSelect={onSelectRecord} />
              ))}
            </ul>
            {totalPages > 1 ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={results.page <= 0 || loading}
                  className="rounded border border-stone-400 px-3 py-1 text-sm disabled:opacity-50"
                  onClick={() => void runSearch(results.page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={results.page >= totalPages - 1 || loading}
                  className="rounded border border-stone-400 px-3 py-1 text-sm disabled:opacity-50"
                  onClick={() => void runSearch(results.page + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
