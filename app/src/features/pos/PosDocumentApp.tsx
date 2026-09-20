import { useCallback, useEffect, useState } from "react";
import {
  type ApiError,
  type CurrentUser,
  getCurrentUser,
  getRecord,
  getRecordDocuments,
  logout,
  networkError,
  type PosRecordDetail,
} from "./api";
import RecordDetail from "./components/RecordDetail";
import SearchPanel from "./components/SearchPanel";
import UploadPanel from "./components/UploadPanel";

export type AuthState = "LOADING" | "SIGNED_OUT" | "SIGNED_IN" | "BACKEND_UNAVAILABLE";

const SIGN_IN_URL = "/api/v1/oauth2/authorization/google";

function ErrorBanner({ error }: { error: ApiError }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-sm dark:bg-red-950"
    >
      <p className="font-semibold">{error.title}</p>
      {error.detail ? <p>{error.detail}</p> : null}
      <p className="text-xs opacity-70">
        Status: {error.status} · Code: {error.code}
      </p>
    </div>
  );
}

export default function PosDocumentApp() {
  const [authState, setAuthState] = useState<AuthState>("LOADING");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<PosRecordDetail | null>(null);

  const isReviewer = user?.roles.includes("REVIEWER") ?? false;

  const loadCurrentUser = useCallback(async () => {
    setAuthState("LOADING");
    const outcome = await getCurrentUser();
    if (outcome.ok) {
      setUser(outcome.user);
      setLoadError(null);
      setAuthState("SIGNED_IN");
    } else if (outcome.error.status === 401) {
      setUser(null);
      setLoadError(null);
      setAuthState("SIGNED_OUT");
    } else {
      setUser(null);
      setLoadError(outcome.error);
      setAuthState("BACKEND_UNAVAILABLE");
    }
  }, []);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  /** Clear all POS data from React memory (logout or 401). */
  const clearData = useCallback(() => {
    setUser(null);
    setSelectedRecord(null);
    setLoadError(null);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    clearData();
    setAuthState("SIGNED_OUT");
  }, [clearData]);

  /** Clear visible data and return to the signed-out screen on any 401. */
  const handleUnauthorized = useCallback(() => {
    clearData();
    setAuthState("SIGNED_OUT");
  }, [clearData]);

  /** Load record + documents when an ingestion job completes. */
  const loadRecordWithDocuments = useCallback(async (posRecordId: string) => {
    const recordOutcome = await getRecord(posRecordId);
    if (!recordOutcome.ok) return;
    const docsOutcome = await getRecordDocuments(posRecordId);
    setSelectedRecord({
      ...recordOutcome.record,
      documents: docsOutcome.ok ? docsOutcome.documents : [],
    });
  }, []);

  if (authState === "LOADING") {
    return (
      <section
        className="rounded border border-stone-300 bg-white p-6 dark:bg-slate-800"
        aria-busy="true"
      >
        <p>Checking your session…</p>
      </section>
    );
  }

  if (authState === "BACKEND_UNAVAILABLE") {
    return (
      <section className="rounded border border-stone-300 bg-white p-6 dark:bg-slate-800">
        <ErrorBanner error={loadError ?? networkError()} />
        <button
          type="button"
          className="rounded bg-stone-700 px-4 py-2 text-white hover:bg-stone-600 dark:bg-slate-600"
          onClick={() => void loadCurrentUser()}
        >
          Retry
        </button>
      </section>
    );
  }

  if (authState === "SIGNED_OUT") {
    return (
      <section className="rounded border border-stone-300 bg-white p-6 dark:bg-slate-800">
        <h1 className="mb-2 text-xl font-semibold">POS document portal</h1>
        <p className="mb-4">Sign in to view and process POS documents.</p>
        <a
          href={SIGN_IN_URL}
          className="inline-block rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
        >
          Sign in with Google
        </a>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded border border-stone-300 bg-white p-4 dark:bg-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">POS document portal</h1>
            <p>
              Signed in as {user?.displayName || "unknown"} ({user?.email || "unknown email"})
            </p>
            <p className="text-sm opacity-80">Roles: {user?.roles.join(", ") || "none"}</p>
          </div>
          <button
            type="button"
            className="rounded border border-stone-400 px-4 py-2 hover:bg-stone-100 dark:hover:bg-slate-700"
            onClick={() => void handleLogout()}
          >
            Log out
          </button>
        </div>
      </section>

      {isReviewer ? (
        <UploadPanel
          onUnauthorized={handleUnauthorized}
          onJobUpdate={() => {}}
          onCompleted={loadRecordWithDocuments}
        />
      ) : null}

      <SearchPanel
        onUnauthorized={handleUnauthorized}
        onResults={() => {}}
        onSelectRecord={loadRecordWithDocuments}
      />

      {selectedRecord ? (
        <RecordDetail
          record={selectedRecord}
          documents={selectedRecord.documents}
          isReviewer={isReviewer}
          onUnauthorized={handleUnauthorized}
        />
      ) : null}
    </div>
  );
}
