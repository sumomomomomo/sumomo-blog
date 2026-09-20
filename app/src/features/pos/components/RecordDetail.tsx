import {
  documentContentUrl,
  type PosDocument,
  type PosRecordDetail,
  sourceArchiveUrl,
} from "../api";

interface Props {
  record: PosRecordDetail;
  documents: PosDocument[];
  isReviewer: boolean;
  onUnauthorized: () => void;
}

function orNotAvailable(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "Not available";
}

export default function RecordDetail({ record, documents, isReviewer }: Props) {
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
              <span>
                Type: {document.documentType} · Processing status: {document.processingStatus}
              </span>
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
