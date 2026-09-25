import { useState } from "react";
import {
  type ApiError,
  deleteRecord,
  documentContentUrl,
  MAX_STRING_LENGTHS,
  type PosDocument,
  type PosRecordChanges,
  type PosRecordDetail,
  sourceArchiveUrl,
  updateRecord,
  verifyRecord,
} from "../api";

interface Props {
  record: PosRecordDetail;
  documents: PosDocument[];
  isReviewer: boolean;
  onUnauthorized: () => void;
  onRecordUpdated: (record: PosRecordDetail) => void;
  onDeleted: () => void;
  onReload: () => Promise<void>;
}

type EditableField = keyof PosRecordChanges;

const fields: { key: EditableField; label: string; type: string; maxLength?: number }[] = [
  {
    key: "erefNumber",
    label: "eRef number",
    type: "text",
    maxLength: MAX_STRING_LENGTHS.erefNumber,
  },
  {
    key: "policyNumber",
    label: "Policy number",
    type: "text",
    maxLength: MAX_STRING_LENGTHS.policyNumber,
  },
  {
    key: "policyholderName",
    label: "Policyholder name",
    type: "text",
    maxLength: MAX_STRING_LENGTHS.policyholderName,
  },
  { key: "consultantName", label: "Consultant name", type: "text", maxLength: 256 },
  { key: "policyCreateDate", label: "Policy creation date", type: "date" },
];

type EditValues = Record<EditableField, string>;

function valuesFromRecord(record: PosRecordDetail): EditValues {
  return {
    erefNumber: record.erefNumber ?? "",
    policyNumber: record.policyNumber ?? "",
    policyholderName: record.policyholderName ?? "",
    consultantName: record.consultantName ?? "",
    policyCreateDate: record.policyCreateDate ?? "",
  };
}

function orNotAvailable(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "Not available";
}

export default function RecordDetail({
  record,
  documents,
  isReviewer,
  onUnauthorized,
  onRecordUpdated,
  onDeleted,
  onReload,
}: Props) {
  const [editValues, setEditValues] = useState<EditValues | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState("");

  const changes: PosRecordChanges = {};
  if (editValues) {
    for (const { key } of fields) {
      if (editValues[key] !== (record[key] ?? "")) changes[key] = editValues[key];
    }
  }
  const changedKeys = Object.keys(changes) as EditableField[];
  const blankChange = changedKeys.some((key) => !editValues?.[key].trim());
  const canEdit =
    isReviewer && (record.status === "REVIEW_REQUIRED" || record.status === "COMPLETED");
  const canVerify = isReviewer && record.status === "REVIEW_REQUIRED";

  const submitEdit = async () => {
    if (!canEdit || pending || changedKeys.length === 0 || blankChange) return;
    setPending(true);
    setError(null);
    setMessage("");
    const outcome = await updateRecord(record.id, { expectedVersion: record.version, ...changes });
    setPending(false);
    if (outcome.ok) {
      onRecordUpdated(outcome.record);
      setEditValues(null);
    } else if (outcome.error.status === 401) {
      onUnauthorized();
    } else {
      setError(outcome.error);
      if (outcome.error.status === 412) {
        setEditValues(null);
        await onReload();
      }
    }
  };

  const submitDelete = async () => {
    if (!isReviewer || !confirmDelete || pending) return;
    setPending(true);
    setError(null);
    setMessage("");
    const outcome = await deleteRecord(record.id);
    setPending(false);
    if (outcome.ok) {
      onDeleted();
    } else if (outcome.error.status === 401) {
      onUnauthorized();
    } else if (outcome.error.status === 409) {
      setConfirmDelete(false);
      setMessage("Record changed concurrently, try again.");
      await onReload();
    } else {
      setError(outcome.error);
    }
  };

  const submitVerify = async () => {
    if (!canVerify || pending) return;
    setPending(true);
    setError(null);
    setMessage("");
    const outcome = await verifyRecord(record.id, record.version);
    setPending(false);
    if (outcome.ok) {
      onRecordUpdated(outcome.record);
    } else if (outcome.error.status === 401) {
      onUnauthorized();
    } else {
      setError(outcome.error);
      if (outcome.error.status === 412) {
        await onReload();
      }
    }
  };

  return (
    <section className="rounded border border-stone-300 bg-white p-4 dark:bg-slate-800">
      <h2 className="mb-3 text-lg font-semibold">Record details</h2>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">eRef number</dt>
          <dd>{orNotAvailable(record.erefNumber)}</dd>
        </div>
        <div>
          <dt className="font-medium">Policy number</dt>
          <dd>{orNotAvailable(record.policyNumber)}</dd>
        </div>
        <div>
          <dt className="font-medium">Policyholder name</dt>
          <dd>{orNotAvailable(record.policyholderName)}</dd>
        </div>
        <div>
          <dt className="font-medium">Consultant name</dt>
          <dd>{orNotAvailable(record.consultantName)}</dd>
        </div>
        <div>
          <dt className="font-medium">Policy creation date</dt>
          <dd>{orNotAvailable(record.policyCreateDate)}</dd>
        </div>
        <div>
          <dt className="font-medium">Status</dt>
          <dd>{record.status}</dd>
        </div>
        <div>
          <dt className="font-medium">Uploaded at</dt>
          <dd>{orNotAvailable(record.uploadedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">Updated at</dt>
          <dd>{orNotAvailable(record.updatedAt)}</dd>
        </div>
        <div>
          <dt className="font-medium">Version</dt>
          <dd>{record.version}</dd>
        </div>
      </dl>

      {canEdit || isReviewer ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && !editValues ? (
            <button
              type="button"
              onClick={() => {
                setEditValues(valuesFromRecord(record));
                setConfirmDelete(false);
                setError(null);
                setMessage("");
              }}
              className="rounded border border-stone-400 px-4 py-2 text-sm"
            >
              Edit
            </button>
          ) : null}
          {canVerify && !confirmDelete ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void submitVerify()}
              className="rounded border border-green-600 px-4 py-2 text-sm disabled:opacity-50"
            >
              Verify
            </button>
          ) : null}
          {isReviewer && !confirmDelete ? (
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(true);
                setEditValues(null);
                setError(null);
                setMessage("");
              }}
              className="rounded border border-red-500 px-4 py-2 text-sm"
            >
              Delete
            </button>
          ) : null}
          {isReviewer && confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Delete this record?</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void submitDelete()}
                className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
              >
                Confirm delete
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
                className="rounded border border-stone-400 px-4 py-2 disabled:opacity-50"
              >
                Cancel delete
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canEdit && editValues ? (
        <form
          className="mt-4 space-y-3 rounded border border-stone-300 p-3 dark:border-slate-600"
          onSubmit={(event) => {
            event.preventDefault();
            void submitEdit();
          }}
        >
          <h3 className="font-semibold">Edit record</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(({ key, label, type, maxLength }) => (
              <label key={key} className="block text-sm font-medium">
                {label}
                <input
                  type={type}
                  maxLength={maxLength}
                  value={editValues[key]}
                  onChange={(event) => setEditValues({ ...editValues, [key]: event.target.value })}
                  className="mt-1 w-full rounded border border-stone-300 bg-transparent p-2 dark:border-slate-600"
                />
              </label>
            ))}
          </div>
          {blankChange ? (
            <p className="text-sm text-red-700" role="alert">
              Changed fields cannot be blank.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || changedKeys.length === 0 || blankChange}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Save changes
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditValues(null)}
              className="rounded border border-stone-400 px-4 py-2 text-sm disabled:opacity-50"
            >
              Cancel edit
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-3 rounded border border-red-400 bg-red-50 p-3 text-sm dark:bg-red-950"
        >
          <p className="font-semibold">{error.title}</p>
          {error.detail ? <p>{error.detail}</p> : null}
        </div>
      ) : null}
      {message ? (
        <p role="alert" className="mt-3 text-sm">
          {message}
        </p>
      ) : null}

      <h3 className="mb-2 mt-4 font-semibold">Documents</h3>
      {documents.length === 0 ? (
        <p className="text-sm">No documents.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-300 p-2 text-sm dark:border-slate-600"
            >
              <span>{document.filename} | {document.processingStatus}</span>
              {isReviewer ? (
                <a
                  href={documentContentUrl(record.id, document.id)}
                  target="_blank"
                  rel="noopener"
                  className="rounded border border-stone-400 px-3 py-1 hover:bg-stone-100 dark:hover:bg-slate-700"
                >
                  Open PDF
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isReviewer ? (
        <a
          href={sourceArchiveUrl(record.id)}
          className="mt-4 inline-block rounded border border-stone-400 px-4 py-2 text-sm hover:bg-stone-100 dark:hover:bg-slate-700"
        >
          Download original ZIP
        </a>
      ) : null}
    </section>
  );
}
