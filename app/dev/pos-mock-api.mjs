import { createHash, randomUUID } from 'node:crypto';

const CSRF_TOKEN = 'local-pos-mock-csrf';
const ZIP = Buffer.from('UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==', 'base64');
function samplePdf() {
  let content = '%PDF-1.4\n';
  const offsets = [0];
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) content += `${String(offset).padStart(10, '0')} 00000 n \n`;
  content += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}
const PDF = samplePdf();
const NOW = '2026-09-25T08:00:00.000Z';

function makeRecord(id, erefNumber, policyNumber, policyholderName, status = 'REVIEW_REQUIRED', docStatus = 'COMPLETED') {
  const sourceArchive = {
    id: randomUUID(), originalFilename: `${erefNumber}.zip`, contentType: 'application/zip',
    byteSize: ZIP.length, sha256: createHash('sha256').update(ZIP).digest('hex'),
  };
  return {
    id, erefNumber, policyNumber, policyholderName, consultantName: 'Avery Tan',
    policyCreateDate: '2026-09-01', status, sourceArchive, uploadedAt: NOW,
    updatedAt: NOW, uploadedBy: 'local-mock', version: 0,
    documents: [{
      id: randomUUID(), posRecordId: id,
      storageObject: {
        id: randomUUID(), originalFilename: 'sample-report.pdf', contentType: 'application/pdf',
        byteSize: PDF.length, sha256: createHash('sha256').update(PDF).digest('hex'),
      },
      documentType: 'FA_PRUPLANNER_REPORT', processingStatus: docStatus,
    }],
    archive: ZIP,
  };
}

function problem(res, status, code, detail) {
  return json(res, status, { type: 'about:blank', title: {
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
    409: 'Conflict', 412: 'Precondition Failed', 413: 'Payload Too Large',
    415: 'Unsupported Media Type', 422: 'Unprocessable Content',
  }[status] ?? 'Request failed', status, detail, code }, 'application/problem+json');
}

function json(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function bytes(res, type, filename, content, disposition = 'attachment') {
  res.writeHead(200, {
    'Content-Type': type, 'Content-Disposition': `${disposition}; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}"`,
    'Content-Length': content.length, 'Cache-Control': 'no-store',
  });
  res.end(content);
}

async function bodyBuffer(req, maxBytes = 11 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function recordResponse(record) {
  const { documents, archive, ...publicRecord } = record;
  return publicRecord;
}

function normalizedIdentifier(value) {
  return value?.normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{Nd}]/gu, '');
}

function normalizedName(value) {
  return value?.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function nameSimilarity(left, right) {
  if (left === right) return 1;
  const trigrams = (value) => {
    const chars = [...`  ${value}  `];
    return new Set(chars.slice(0, -2).map((_, index) => chars.slice(index, index + 3).join('')));
  };
  const first = trigrams(left);
  const second = trigrams(right);
  return 2 * [...first].filter((gram) => second.has(gram)).length / (first.size + second.size);
}

function zipEntries(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  const crc32 = (data) => {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  for (const [filename, data] of entries) {
    const name = Buffer.from(filename);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += local.length + name.length + data.length;
  }
  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

function safeZipName(name) {
  const clean = (name ?? '').replace(/[<>:"|?*\\/\x00-\x1f\x7f]/g, '_').replace(/\.\./g, '_').trim().replace(/[. ]+$/g, '');
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(clean) ? `_${clean}` : clean;
}

export function createPosMockMiddleware(role = 'REVIEWER') {
  const records = new Map([
    ['11111111-1111-4111-8111-111111111111', makeRecord('11111111-1111-4111-8111-111111111111', 'EREF-2026-001', 'P10001', 'Harper Lee', 'COMPLETED')],
    ['22222222-2222-4222-8222-222222222222', makeRecord('22222222-2222-4222-8222-222222222222', 'EREF-2026-002', 'P10002', 'Morgan Chen', 'PROCESSING')],
    ['33333333-3333-4333-8333-333333333333', makeRecord('33333333-3333-4333-8333-333333333333', 'EREF-2026-003', 'P10003', 'Delete conflict example')],
    // REVIEW_REQUIRED with a PENDING document: exercises the 422 verification prerequisite path.
    ['99999999-9999-4999-8999-999999999999', makeRecord('99999999-9999-4999-8999-999999999999', 'EREF-2026-009', 'P99999', 'Prereq Pending', 'REVIEW_REQUIRED', 'PENDING')],
  ]);
  const jobs = new Map();
  let signedOut = false;
  const userRole = role === 'USER' ? 'USER' : 'REVIEWER';

  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/v1/')) return next();
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.localAddress)) {
      return problem(res, 403, 'LOCAL_ONLY', 'The mock API is available on localhost only.');
    }
    const path = url.pathname.slice('/api/v1'.length);
    const method = req.method ?? 'GET';
    try {
      if (path === '/oauth2/authorization/google' && method === 'GET') {
        signedOut = false;
        res.writeHead(302, { Location: '/pos/', 'Cache-Control': 'no-store' });
        return res.end();
      }
      if (path === '/auth/me' && method === 'GET') {
        if (signedOut) return problem(res, 401, 'UNAUTHORIZED', 'Sign in to continue.');
        res.setHeader('Set-Cookie', `XSRF-TOKEN=${CSRF_TOKEN}; Path=/; SameSite=Lax`);
        return json(res, 200, { email: 'local@example.test', displayName: userRole === 'USER' ? 'Local User' : 'Local Reviewer', roles: [userRole] });
      }
      if (signedOut) return problem(res, 401, 'UNAUTHORIZED', 'Sign in to continue. Restart the mock server to reset the session.');
      if (path === '/auth/logout' && method === 'POST') {
        if (!validCsrf(req)) return problem(res, 403, 'INVALID_CSRF_TOKEN', 'The CSRF token is missing or invalid.');
        signedOut = true;
        res.writeHead(204, { 'Set-Cookie': 'XSRF-TOKEN=; Path=/; Max-Age=0', 'Cache-Control': 'no-store' });
        return res.end();
      }
      if (path === '/pos-records/search' && method === 'POST') {
        const query = await readJson(req);
        if (!query || typeof query !== 'object' || Array.isArray(query)) return problem(res, 400, 'INVALID_REQUEST', 'A JSON search object is required.');
        const page = query.page ?? 0;
        if (!Number.isInteger(page) || page < 0) return problem(res, 400, 'INVALID_PAGE', 'Page must be a nonnegative integer.');
        const threshold = query.minimumNameSimilarity ?? 0.3;
        if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 1) return problem(res, 400, 'INVALID_REQUEST', 'Name similarity threshold must be between 0 and 1.');
        const matched = [...records.values()].filter((item) =>
          (!query.erefNumber || normalizedIdentifier(item.erefNumber) === normalizedIdentifier(query.erefNumber)) &&
          (!query.policyNumber || normalizedIdentifier(item.policyNumber) === normalizedIdentifier(query.policyNumber)) &&
          (!query.policyholderName || (query.fuzzyName !== false
            ? nameSimilarity(normalizedName(item.policyholderName), normalizedName(query.policyholderName)) >= threshold
            : normalizedName(item.policyholderName) === normalizedName(query.policyholderName))) &&
          (!query.consultantName || (query.fuzzyName !== false
            ? nameSimilarity(normalizedName(item.consultantName), normalizedName(query.consultantName)) >= threshold
            : normalizedName(item.consultantName) === normalizedName(query.consultantName))));
        const size = 20;
        return json(res, 200, { items: matched.slice(page * size, (page + 1) * size).map(({ documents, archive, sourceArchive, uploadedBy, version, ...summary }) => summary), page, size, totalElements: matched.length, totalPages: Math.ceil(matched.length / size) });
      }
      if (path === '/pos-records/search-page-archive' && method === 'POST') {
        if (userRole !== 'REVIEWER') return problem(res, 403, 'FORBIDDEN', 'Reviewer role is required.');
        if (!validCsrf(req)) return problem(res, 403, 'INVALID_CSRF_TOKEN', 'The CSRF token is missing or invalid.');
        const ids = await readJson(req);
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return problem(res, 400, 'INVALID_REQUEST', 'Select 1 to 20 unique records.');
        const entries = [];
        const folders = new Set();
        for (const id of ids) {
          const record = records.get(id);
          if (!record) return problem(res, 409, 'PAGE_CHANGED', 'A displayed record is no longer available.');
          if (!record.erefNumber?.trim()) return problem(res, 409, 'MISSING_EREF', 'A displayed record has no eRef.');
          let folder = safeZipName(record.erefNumber);
          if (!folder) return problem(res, 409, 'MISSING_EREF', 'A displayed record has no usable eRef.');
          for (let n = 2; folders.has(folder.toLowerCase()); n += 1) folder = `${safeZipName(record.erefNumber)}-${n}`;
          folders.add(folder.toLowerCase());
          entries.push([`${folder}/`, Buffer.alloc(0)]);
          const names = new Set();
          for (const document of record.documents) {
            const safe = safeZipName(document.storageObject.originalFilename) || 'document';
            const raw = /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`;
            let name = raw;
            for (let n = 2; names.has(name.toLowerCase()); n += 1) name = `${raw.replace(/\.pdf$/i, '')}-${n}.pdf`;
            names.add(name.toLowerCase());
            entries.push([`${folder}/${name}`, PDF]);
          }
        }
        return bytes(res, 'application/zip', 'pos-search-page.zip', zipEntries(entries));
      }
      if (path === '/pos-records' && method === 'POST') {
        if (userRole !== 'REVIEWER') return problem(res, 403, 'FORBIDDEN', 'Reviewer role is required.');
        if (!validCsrf(req)) return problem(res, 403, 'INVALID_CSRF_TOKEN', 'The CSRF token is missing or invalid.');
        if (!String(req.headers['content-type'] ?? '').startsWith('multipart/form-data')) return problem(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Use multipart/form-data.');
        const buffer = await bodyBuffer(req);
        const form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] }, body: buffer }).formData();
        const file = form.get('file');
        if (!file || typeof file === 'string' || file.size === 0) return problem(res, 400, 'INVALID_FILE', 'Select a ZIP archive.');
        if (file.size > 10 * 1024 * 1024) return problem(res, 413, 'PAYLOAD_TOO_LARGE', 'ZIP archive exceeds 10 MiB.');
        const archive = Buffer.from(await file.arrayBuffer());
        const eocd = archive.lastIndexOf(Buffer.from('504b0506', 'hex'));
        if (!file.name.toLowerCase().endsWith('.zip') || archive.subarray(0, 2).toString() !== 'PK' || eocd < archive.length - 65557 || eocd < 0) return problem(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Select a valid ZIP archive.');
        const policyNumber = String(form.get('policyNumber') ?? '').trim() || null;
        if (policyNumber && [...records.values()].some((item) => normalizedIdentifier(item.policyNumber) === normalizedIdentifier(policyNumber))) return problem(res, 409, 'DUPLICATE_POLICY_NUMBER', 'That policy number is already used.');
        const id = randomUUID();
        const jobId = randomUUID();
        const eref = `EREF-MOCK-${id.slice(0, 8).toUpperCase()}`;
        const item = makeRecord(id, eref, policyNumber, 'Uploaded example', 'REVIEW_REQUIRED');
        item.sourceArchive = { id: randomUUID(), originalFilename: file.name, contentType: 'application/zip', byteSize: file.size, sha256: createHash('sha256').update(archive).digest('hex') };
        item.archive = archive;
        records.set(id, item);
        jobs.set(jobId, { id: jobId, status: 'COMPLETED', attemptCount: 1, errorCode: null, errorMessage: null });
        res.setHeader('Location', `/api/v1/pos-records/${id}`);
        return json(res, 202, { posRecordId: id, jobId, status: 'UPLOADED' });
      }
      const jobMatch = /^\/ingestion-jobs\/([^/]+)$/.exec(path);
      if (jobMatch && method === 'GET') {
        const job = jobs.get(jobMatch[1]);
        return job ? json(res, 200, job) : problem(res, 404, 'JOB_NOT_FOUND', 'Ingestion job not found.');
      }
      const recordMatch = /^\/pos-records\/([^/]+)(?:\/(.*))?$/.exec(path);
      if (recordMatch) {
        const record = records.get(recordMatch[1]);
        if (!record) return problem(res, 404, 'POS_RECORD_NOT_FOUND', 'POS record not found.');
        const subpath = recordMatch[2];
        if (!subpath && method === 'GET') return json(res, 200, recordResponse(record));
        if (!subpath && method === 'DELETE') {
          if (userRole !== 'REVIEWER') return problem(res, 403, 'FORBIDDEN', 'Reviewer role is required.');
          if (!validCsrf(req)) return problem(res, 403, 'INVALID_CSRF_TOKEN', 'The CSRF token is missing or invalid.');
          if (record.id === '33333333-3333-4333-8333-333333333333') return problem(res, 409, 'POS_RECORD_DELETE_CONFLICT', 'This example always produces a delete conflict.');
          records.delete(record.id);
          res.writeHead(204, { 'Cache-Control': 'no-store' });
          return res.end();
        }
        if (!subpath && method === 'PATCH') {
          if (userRole !== 'REVIEWER') return problem(res, 403, 'FORBIDDEN', 'Reviewer role is required.');
          if (!validCsrf(req)) return problem(res, 403, 'INVALID_CSRF_TOKEN', 'The CSRF token is missing or invalid.');
          const patch = await readJson(req);
          if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return problem(res, 400, 'INVALID_REQUEST', 'A JSON patch object is required.');
          const fields = ['erefNumber', 'policyNumber', 'policyholderName', 'consultantName', 'policyCreateDate'];
          if (!Number.isInteger(patch.expectedVersion) || patch.expectedVersion < 0 || Object.keys(patch).some((key) => key !== 'expectedVersion' && !fields.includes(key))) return problem(res, 400, 'INVALID_REQUEST', 'Invalid patch fields or expectedVersion.');
          const edits = fields.filter((key) => patch[key] !== undefined && patch[key] !== null);
          if (!edits.length) return problem(res, 400, 'EMPTY_PATCH', 'Provide at least one editable value.');
          for (const key of edits) {
            if (typeof patch[key] !== 'string' || !patch[key].trim() || patch[key].length > 256) return problem(res, 422, 'INVALID_FIELD', `${key} must be a nonblank string of at most 256 characters.`);
            if (key === 'policyCreateDate' && (!/^\d{4}-\d{2}-\d{2}$/.test(patch[key]) || Number.isNaN(new Date(`${patch[key]}T00:00:00Z`).getTime()) || new Date(`${patch[key]}T00:00:00Z`).toISOString().slice(0, 10) !== patch[key])) return problem(res, 422, 'INVALID_DATE', 'policyCreateDate must be a date.');
          }
          if (patch.expectedVersion !== record.version) return problem(res, 412, 'POS_RECORD_VERSION_MISMATCH', 'This record has changed. Refresh and retry.');
          if (!['REVIEW_REQUIRED', 'COMPLETED'].includes(record.status)) return problem(res, 409, 'POS_RECORD_NOT_REVIEWABLE', 'This record cannot be edited in its current status.');
          for (const key of ['erefNumber', 'policyNumber']) {
            if (edits.includes(key) && [...records.values()].some((item) => item.id !== record.id && normalizedIdentifier(item[key]) === normalizedIdentifier(patch[key]))) return problem(res, 409, key === 'erefNumber' ? 'DUPLICATE_EREF_NUMBER' : 'DUPLICATE_POLICY_NUMBER', `${key} is already used.`);
          }
          const changed = edits.some((key) => record[key] !== patch[key].trim());
          if (changed) {
            for (const key of edits) record[key] = patch[key].trim();
            if (record.status === 'COMPLETED') record.status = 'REVIEW_REQUIRED';
            record.version += 1;
            record.updatedAt = new Date().toISOString();
          }
          return json(res, 200, recordResponse(record));
        }
        if (subpath === 'verification' && method === 'POST') {
          if (userRole !== 'REVIEWER') return problem(res, 403, 'FORBIDDEN', 'Reviewer role is required.');
          if (!validCsrf(req)) return problem(res, 403, 'INVALID_CSRF_TOKEN', 'The CSRF token is missing or invalid.');
          const body = await readJson(req);
          if (!body || typeof body !== 'object' || Array.isArray(body) || !Number.isInteger(body.expectedVersion) || body.expectedVersion < 0) return problem(res, 400, 'INVALID_REQUEST', 'expectedVersion must be a nonnegative integer.');
          if (record.status !== 'REVIEW_REQUIRED') return problem(res, 409, 'POS_RECORD_NOT_REVIEWABLE', 'This record cannot be verified in its current status.');
          if (body.expectedVersion !== record.version) return problem(res, 412, 'POS_RECORD_VERSION_MISMATCH', 'This record has changed. Refresh and retry.');
          if (!record.documents || record.documents.length === 0) return problem(res, 422, 'VERIFICATION_PREREQUISITES_UNMET', 'At least one document is required to verify.');
          if (record.documents.some((doc) => doc.processingStatus === 'PENDING' || doc.processingStatus === 'PROCESSING')) return problem(res, 422, 'VERIFICATION_PREREQUISITES_UNMET', 'All documents must finish processing before verification.');
          for (const key of ['erefNumber', 'policyNumber', 'policyholderName', 'consultantName']) {
            if (!record[key]) return problem(res, 422, 'VERIFICATION_PREREQUISITES_UNMET', `${key} is required to verify.`);
          }
          record.status = 'COMPLETED';
          record.version += 1;
          record.updatedAt = new Date().toISOString();
          return json(res, 200, recordResponse(record));
        }
        if (subpath === 'documents' && method === 'GET') return json(res, 200, record.documents);
        if (subpath === 'source-archive/content' && method === 'GET') {
          if (userRole !== 'REVIEWER') return problem(res, 403, 'FORBIDDEN', 'Reviewer role is required.');
          return bytes(res, 'application/zip', record.sourceArchive.originalFilename, record.archive);
        }
        const docMatch = /^documents\/([^/]+)\/content$/.exec(subpath ?? '');
        if (docMatch && method === 'GET') {
          if (userRole !== 'REVIEWER') return problem(res, 403, 'FORBIDDEN', 'Reviewer role is required.');
          if (!record.documents.some((doc) => doc.id === docMatch[1])) return problem(res, 404, 'DOCUMENT_NOT_FOUND', 'Document not found.');
          return bytes(res, 'application/pdf', record.documents.find((doc) => doc.id === docMatch[1]).storageObject.originalFilename, PDF, 'inline');
        }
      }
      return problem(res, 404, 'NOT_FOUND', 'Mock API route not found.');
    } catch (error) {
      if (error.status === 413) return problem(res, 413, 'PAYLOAD_TOO_LARGE', error.message);
      return problem(res, 400, 'INVALID_REQUEST', 'Could not read the request body.');
    }
  };
}

function validCsrf(req) {
  const cookie = String(req.headers.cookie ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith('XSRF-TOKEN='));
  return cookie === `XSRF-TOKEN=${CSRF_TOKEN}` && req.headers['x-xsrf-token'] === CSRF_TOKEN;
}

async function readJson(req) {
  if (!String(req.headers['content-type'] ?? '').includes('json')) return null;
  try { return JSON.parse((await bodyBuffer(req, 1024 * 1024)).toString()); }
  catch (error) {
    if (error.status === 413) throw error;
    return null;
  }
}
