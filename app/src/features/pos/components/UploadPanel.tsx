import { useEffect, useRef, useState } from "react";
import {
  type ApiError,
  type IngestionJob,
  MAX_STRING_LENGTHS,
  UPLOAD_MAX_BYTES,
  UploadCancelledError,
  uploadZip,
} from "../api";

interface Props {
  onUnauthorized: () => void;
  onJobUpdate: (job: IngestionJob | null) => void;
  onCompleted: (posRecordId: string) => void;
}

type UploadState = "IDLE" | "UPLOADING" | "PROCESSING" | "DONE";

function describeUploadError(error: unknown): string {
  if (error instanceof UploadCancelledError) {
    return "Upload cancelled.";
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const apiError = error as ApiError;
    if (apiError.status === 401) return "Your session has expired. Please sign in again.";
    if (apiError.status === 403)
      return "You are not allowed to upload, or your request token was invalid.";
    if (apiError.status === 409) return "A record with this policy number or eRef already exists.";
    if (apiError.status === 413) return "The archive is too large (maximum 10 MiB).";
    if (apiError.status === 415 || apiError.status === 422)
      return "The archive could not be read. Ensure it is a valid, uncorrupted ZIP file.";
    if (apiError.status === 0) return "The backend could not be reached.";
    if (apiError.status >= 500) return "The backend failed to process the upload.";
    return apiError.detail || apiError.title || "Upload failed.";
  }
  return "Upload failed.";
}

export default function UploadPanel({ onUnauthorized, onJobUpdate, onCompleted }: Props) {
  const [state, setState] = useState<UploadState>("IDLE");
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearPolling = () => {
    for (const timer of pollTimersRef.current) clearTimeout(timer);
    pollTimersRef.current = [];
  };

  const stop = () => {
    clearPolling();
    abortRef.current?.abort();
    abortRef.current = null;
    pollControllerRef.current?.abort();
    pollControllerRef.current = null;
  };

  // Stop polling and any in-flight upload when the panel unmounts (e.g. logout or 401).
  useEffect(() => stop, []);

  const validate = (file: File, policyNumber: string): string | null => {
    if (!file) return "Choose a ZIP file to upload.";
    if (!file.name.toLowerCase().endsWith(".zip")) return "The file must be a .zip archive.";
    if (file.size > UPLOAD_MAX_BYTES) return "The file must be 10 MiB or smaller.";
    if (policyNumber.length > MAX_STRING_LENGTHS.policyNumber)
      return `Policy number must be at most ${MAX_STRING_LENGTHS.policyNumber} characters.`;
    return null;
  };

  const pollControllerRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const recordIdRef = useRef<string | null>(null);

  const startPolling = (jobId: string, posRecordId: string): void => {
    const controller = new AbortController();
    pollControllerRef.current = controller;
    const startedAt = Date.now();
    let inFlight = false;

    const tick = async (): Promise<void> => {
      if (controller.signal.aborted || inFlight) return;
      inFlight = true;
      try {
        const { getIngestionJob } = await import("../api");
        const outcome = await getIngestionJob(jobId, controller.signal);
        if (controller.signal.aborted) return;
        if (outcome.ok) {
          onJobUpdate(outcome.job);
          setStatus(outcome.job.status);
          setAttemptCount(outcome.job.attemptCount);
          if (outcome.job.status === "COMPLETED") {
            setMessage("Processing completed.");
            setIsError(false);
            setState("DONE");
            onCompleted(posRecordId);
            return;
          }
          if (outcome.job.status === "FAILED") {
            setMessage(
              `Processing failed${outcome.job.errorCode ? ` (${outcome.job.errorCode})` : ""}${
                outcome.job.errorMessage ? `: ${outcome.job.errorMessage}` : ""
              }`,
            );
            setIsError(true);
            setState("DONE");
            return;
          }
        } else if (outcome.error.status === 401) {
          // Session expired: stop polling and clear all visible data.
          stop();
          onUnauthorized();
          return;
        }
        if (Date.now() - startedAt > 5 * 60 * 1000) {
          setMessage("Polling timed out. Use Refresh to check the job again.");
          setIsError(true);
          setState("DONE");
          return;
        }
        pollTimersRef.current.push(setTimeout(() => void tick(), 2000));
      } catch {
        if (!controller.signal.aborted) {
          pollTimersRef.current.push(setTimeout(() => void tick(), 2000));
        }
      } finally {
        inFlight = false;
      }
    };

    void tick();
  };

  const pollJob = (jobId: string, posRecordId: string): void => {
    jobIdRef.current = jobId;
    recordIdRef.current = posRecordId;
    startPolling(jobId, posRecordId);
  };

  /** Manual Refresh after a polling timeout. */
  const handleRefresh = () => {
    if (jobIdRef.current && recordIdRef.current) {
      setMessage(null);
      setIsError(false);
      setStatus("");
      setAttemptCount(null);
      setState("PROCESSING");
      startPolling(jobIdRef.current, recordIdRef.current);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fileInput = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = fileInput?.files?.[0];
    const policyNumber = String(formData.get("policyNumber") ?? "").trim();

    const validationError = validate(file as File, policyNumber);
    if (validationError) {
      setMessage(validationError);
      setIsError(true);
      return;
    }

    setMessage(null);
    setIsError(false);
    setStatus("");
    setAttemptCount(null);
    setState("UPLOADING");
    setProgress(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await uploadZip({
        file: file as File,
        policyNumber: policyNumber || undefined,
        onProgress: setProgress,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setState("PROCESSING");
      setStatus("UPLOADED");
      if (fileInputRef.current) fileInputRef.current.value = "";
      pollJob(result.jobId, result.posRecordId);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (typeof error === "object" && error !== null && (error as ApiError).status === 401) {
        onUnauthorized();
        return;
      }
      setMessage(describeUploadError(error));
      setIsError(true);
      setState("IDLE");
    }
  };

  const handleCancel = () => {
    stop();
    setMessage("Upload cancelled.");
    setIsError(false);
    setState("IDLE");
    setProgress(null);
    onJobUpdate(null);
  };

  return (
    <section className="rounded border border-stone-300 bg-white p-4 dark:bg-slate-800">
      <h2 className="mb-3 text-lg font-semibold">Upload POS archive</h2>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <div>
          <label htmlFor="pos-upload-file" className="block text-sm font-medium">
            ZIP archive (max 10 MiB)
          </label>
          <input
            id="pos-upload-file"
            ref={fileInputRef}
            name="file"
            type="file"
            accept=".zip,application/zip"
            disabled={state === "UPLOADING" || state === "PROCESSING"}
            className="mt-1 block w-full text-sm"
          />
        </div>
        <div>
          <label htmlFor="pos-upload-policy" className="block text-sm font-medium">
            Policy number (optional)
          </label>
          <input
            id="pos-upload-policy"
            name="policyNumber"
            type="text"
            maxLength={MAX_STRING_LENGTHS.policyNumber}
            disabled={state === "UPLOADING" || state === "PROCESSING"}
            className="mt-1 block w-full rounded border border-stone-300 bg-transparent p-2 text-sm dark:border-slate-600"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={state === "UPLOADING" || state === "PROCESSING"}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Upload
          </button>
          {state === "UPLOADING" || state === "PROCESSING" ? (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded border border-stone-400 px-4 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          ) : null}
          {state === "DONE" ? (
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded border border-stone-400 px-4 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700"
            >
              Refresh
            </button>
          ) : null}
          {state === "DONE" ? (
            <button
              type="button"
              onClick={() => {
                jobIdRef.current = null;
                recordIdRef.current = null;
                setState("IDLE");
                setMessage(null);
                setStatus("");
                setAttemptCount(null);
              }}
              className="rounded border border-stone-400 px-4 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700"
            >
              New upload
            </button>
          ) : null}
        </div>
      </form>

      {state === "UPLOADING" && progress !== null ? (
        <div className="mt-3" aria-live="polite">
          <div className="h-2 w-full rounded bg-stone-200 dark:bg-slate-700">
            <div className="h-2 rounded bg-blue-600" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-sm">Uploading… {progress}%</p>
        </div>
      ) : null}

      {state === "PROCESSING" ? (
        <div className="mt-3 text-sm" aria-live="polite">
          <p>
            Job status: {status || "checking…"}
            {attemptCount !== null ? ` (attempts: ${attemptCount})` : ""}
          </p>
        </div>
      ) : null}

      {message ? (
        <div
          role={isError ? "alert" : "status"}
          className={`mt-3 rounded border p-2 text-sm ${
            isError
              ? "border-red-400 bg-red-50 dark:bg-red-950"
              : "border-green-500 bg-green-50 dark:bg-green-950"
          }`}
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}
