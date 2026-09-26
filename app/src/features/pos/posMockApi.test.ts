// @vitest-environment node
// HTTP-level tests for the development middleware. Each server gets fresh in-memory state.

import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createPosMockMiddleware } from "../../../dev/pos-mock-api.mjs";

let server: Server | undefined;
let base = "";
let cookie = "";
const id1 = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";
const id3 = "33333333-3333-4333-8333-333333333333";
const id9 = "99999999-9999-4999-8999-999999999999";

async function start(role = "REVIEWER") {
  const middleware = createPosMockMiddleware(role);
  server = createServer((req, res) =>
    middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address");
  base = `http://127.0.0.1:${address.port}/api/v1`;
  const response = await fetch(`${base}/auth/me`);
  cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
  return response.json();
}

async function call(path: string, method = "GET", body?: unknown, csrf = true) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(csrf ? { "X-XSRF-TOKEN": "local-pos-mock-csrf" } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

describe("local POS mock API", () => {
  it("filters consultant and policyholder together and returns ordered page PDF ZIP", async () => {
    await start();
    const exact = await (
      await call("/pos-records/search", "POST", {
        consultantName: "AVERY   TAN",
        policyholderName: "Harper Lee",
        fuzzyName: false,
      })
    ).json();
    expect(exact.items.map((item: { id: string }) => item.id)).toEqual([id1]);
    const wrong = await (
      await call("/pos-records/search", "POST", {
        consultantName: "Avery Tanx",
        policyholderName: "Harper Lee",
        fuzzyName: false,
      })
    ).json();
    expect(wrong.totalElements).toBe(0);
    const fuzzy = await (
      await call("/pos-records/search", "POST", {
        consultantName: "Avery Tann",
        policyholderName: "Harper Lea",
        fuzzyName: true,
      })
    ).json();
    expect(fuzzy.items.map((item: { id: string }) => item.id)).toEqual([id1]);
    const strict = await (
      await call("/pos-records/search", "POST", {
        consultantName: "Avery Tann",
        policyholderName: "Harper Lea",
        fuzzyName: true,
        minimumNameSimilarity: 0.99,
      })
    ).json();
    expect(strict.totalElements).toBe(0);
    const response = await call("/pos-records/search-page-archive", "POST", [id2, id1]);
    expect(response.status).toBe(200);
    const archive = Buffer.from(await response.arrayBuffer());
    const names: string[] = [];
    for (let offset = 0; offset < archive.length && archive.readUInt32LE(offset) === 0x04034b50; ) {
      const size = archive.readUInt32LE(offset + 18);
      const nameLength = archive.readUInt16LE(offset + 26);
      const name = archive.subarray(offset + 30, offset + 30 + nameLength).toString();
      names.push(name);
      offset += 30 + nameLength + size;
    }
    expect(names).toEqual([
      "EREF-2026-002/",
      "EREF-2026-002/sample-report.pdf",
      "EREF-2026-001/",
      "EREF-2026-001/sample-report.pdf",
    ]);
    expect((await call("/pos-records/search-page-archive", "POST", [id1, id1])).status).toBe(400);
    expect((await call("/pos-records/search-page-archive", "POST", ["not-a-uuid"])).status).toBe(
      400,
    );
    expect(
      (
        await call("/pos-records/search-page-archive", "POST", [
          "00000000-0000-4000-8000-000000000000",
        ])
      ).status,
    ).toBe(409);
    expect((await call("/pos-records/search-page-archive", "POST", [id1], false)).status).toBe(403);
  });
  it("serves reviewer search, details, documents, and working downloads", async () => {
    const user = await start();
    expect(user.roles).toEqual(["REVIEWER"]);
    expect(cookie).toContain("XSRF-TOKEN=");
    const search = await call("/pos-records/search", "POST", {
      policyholderName: "harp",
      fuzzyName: true,
    });
    const page = await search.json();
    expect(page).toMatchObject({ page: 0, size: 20, totalElements: 1, totalPages: 1 });
    expect(page.items[0].id).toBe(id1);
    expect(
      (await (await call("/pos-records/search", "POST", { policyNumber: "P-10002" })).json())
        .items[0].id,
    ).toBe(id2);
    expect(
      (await (await call("/pos-records/search", "POST", { policyholderName: "Harper Lea" })).json())
        .items[0].id,
    ).toBe(id1);
    expect(
      (
        await (
          await call("/pos-records/search", "POST", {
            policyholderName: "Harper Lea",
            fuzzyName: false,
          })
        ).json()
      ).totalElements,
    ).toBe(0);
    const detail = await (await call(`/pos-records/${id1}`)).json();
    expect(detail.sourceArchive.originalFilename).toMatch(/\.zip$/);
    const docs = await (await call(`/pos-records/${id1}/documents`)).json();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      posRecordId: id1,
      storageObject: { originalFilename: "sample-report.pdf", contentType: "application/pdf" },
    });
    expect(docs[0].storageObject.byteSize).toBeGreaterThan(0);
    expect(docs[0].storageObject.sha256).toMatch(/^[a-f0-9]{64}$/);
    const pdf = await call(`/pos-records/${id1}/documents/${docs[0].id}/content`);
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(pdf.headers.get("content-disposition")).toContain("inline;");
    expect((await pdf.text()).startsWith("%PDF")).toBe(true);
    const zip = await call(`/pos-records/${id1}/source-archive/content`);
    expect(zip.headers.get("content-type")).toBe("application/zip");
    expect(zip.headers.get("content-disposition")).toContain("attachment;");
    expect(
      Buffer.from(await zip.arrayBuffer())
        .subarray(0, 2)
        .toString(),
    ).toBe("PK");
    expect((await call(`/pos-records/${id1}/documents/missing/content`)).status).toBe(404);
    expect((await call("/pos-records/missing")).status).toBe(404);
  });

  it("accepts ZIP uploads, completes polling, and updates search", async () => {
    await start();
    const form = new FormData();
    const originalZip = Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
    form.append("file", new Blob([originalZip], { type: "application/zip" }), "new.zip");
    form.append("policyNumber", "P40004");
    const uploaded = await fetch(`${base}/pos-records`, {
      method: "POST",
      headers: { Cookie: cookie, "X-XSRF-TOKEN": "local-pos-mock-csrf" },
      body: form,
    });
    expect(uploaded.status).toBe(202);
    const ids = await uploaded.json();
    expect(ids).toMatchObject({ status: "UPLOADED" });
    expect((await (await call(`/ingestion-jobs/${ids.jobId}`)).json()).status).toBe("COMPLETED");
    expect((await (await call(`/pos-records/${ids.posRecordId}`)).json()).policyNumber).toBe(
      "P40004",
    );
    const downloaded = await call(`/pos-records/${ids.posRecordId}/source-archive/content`);
    expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(originalZip);
    expect(
      (await (await call("/pos-records/search", "POST", { policyNumber: "P40004" })).json())
        .totalElements,
    ).toBe(1);
    const invalid = new FormData();
    invalid.append("file", new Blob(["no zip"]), "bad.zip");
    const bad = await fetch(`${base}/pos-records`, {
      method: "POST",
      headers: { Cookie: cookie, "X-XSRF-TOKEN": "local-pos-mock-csrf" },
      body: invalid,
    });
    expect(bad.status).toBe(415);
    expect(bad.headers.get("content-type")).toContain("application/problem+json");
    expect((await bad.json()).code).toBe("UNSUPPORTED_MEDIA_TYPE");
    const duplicate = new FormData();
    duplicate.append("file", new Blob([originalZip], { type: "application/zip" }), "duplicate.zip");
    duplicate.append("policyNumber", "Ｐ－１０００２");
    const duplicateResponse = await fetch(`${base}/pos-records`, {
      method: "POST",
      headers: { Cookie: cookie, "X-XSRF-TOKEN": "local-pos-mock-csrf" },
      body: duplicate,
    });
    expect(duplicateResponse.status).toBe(409);
  });

  it("edits with versions, rejects duplicates and invalid states, and reflects deletion", async () => {
    await start();
    const route = `/pos-records/${id1}`;
    expect(
      (await call(route, "PATCH", { expectedVersion: 0, policyholderName: "Changed Name" })).status,
    ).toBe(200);
    const changed = await (await call(route)).json();
    expect(changed).toMatchObject({
      policyholderName: "Changed Name",
      version: 1,
      status: "REVIEW_REQUIRED",
    });
    const stale = await call(route, "PATCH", { expectedVersion: 0, consultantName: "New" });
    expect(stale.status).toBe(412);
    expect((await stale.json()).code).toBe("POS_RECORD_VERSION_MISMATCH");
    expect(
      (await call(route, "PATCH", { expectedVersion: 1, policyNumber: "P10002" })).status,
    ).toBe(409);
    expect(
      (await call(route, "PATCH", { expectedVersion: 1, policyNumber: "P-10002" })).status,
    ).toBe(409);
    expect(
      (await call(route, "PATCH", { expectedVersion: 1, erefNumber: "EREF-2026-002" })).status,
    ).toBe(409);
    expect((await call(route, "PATCH", { expectedVersion: 1, consultantName: " " })).status).toBe(
      422,
    );
    expect(
      (await call(route, "PATCH", { expectedVersion: 1, policyCreateDate: "2026-02-30" })).status,
    ).toBe(422);
    expect((await call(route, "PATCH", { expectedVersion: 1 })).status).toBe(400);
    const second = await call(`/pos-records/${id2}`, "PATCH", {
      expectedVersion: 0,
      policyholderName: "Deleted Name",
    });
    expect(second.status).toBe(409);
    expect((await second.json()).code).toBe("POS_RECORD_NOT_REVIEWABLE");
    expect(
      (
        await call(`/pos-records/${id3}`, "PATCH", {
          expectedVersion: 0,
          policyholderName: "Renamed conflict",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await (
          await call("/pos-records/search", "POST", { policyholderName: "Changed Name" })
        ).json()
      ).totalElements,
    ).toBe(1);
    const conflict = await call(`/pos-records/${id3}`, "DELETE");
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).code).toBe("POS_RECORD_DELETE_CONFLICT");
    expect((await call(route, "DELETE")).status).toBe(204);
    expect((await call(route)).status).toBe(404);
    expect((await call(route, "DELETE")).status).toBe(404);
    expect(
      (
        await (
          await call("/pos-records/search", "POST", { policyholderName: "Changed Name" })
        ).json()
      ).totalElements,
    ).toBe(0);
  });

  it("verifies a prerequisite-met REVIEW_REQUIRED record and bumps its version", async () => {
    await start();
    // id3 is REVIEW_REQUIRED with a COMPLETED document and all required fields present.
    const response = await call(`/pos-records/${id3}/verification`, "POST", { expectedVersion: 0 });
    expect(response.status).toBe(200);
    const verified = await response.json();
    expect(verified).toMatchObject({ status: "COMPLETED", version: 1 });
    expect(verified.updatedAt).toBeTruthy();
    // A second verify is now a conflict (no longer REVIEW_REQUIRED).
    expect(
      (await call(`/pos-records/${id3}/verification`, "POST", { expectedVersion: 1 })).status,
    ).toBe(409);
  });

  it("rejects verifying a non-REVIEW_REQUIRED record with 409", async () => {
    await start();
    const response = await call(`/pos-records/${id1}/verification`, "POST", { expectedVersion: 0 });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("POS_RECORD_NOT_REVIEWABLE");
  });

  it("rejects verifying with a stale expectedVersion with 412", async () => {
    await start();
    const response = await call(`/pos-records/${id3}/verification`, "POST", { expectedVersion: 7 });
    expect(response.status).toBe(412);
    expect((await response.json()).code).toBe("POS_RECORD_VERSION_MISMATCH");
  });

  it("rejects verifying a record with unmet prerequisites with 422", async () => {
    await start();
    // id9 is REVIEW_REQUIRED but has a PENDING document.
    const response = await call(`/pos-records/${id9}/verification`, "POST", { expectedVersion: 0 });
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe("VERIFICATION_PREREQUISITES_UNMET");
  });

  it("denies verification for a USER session", async () => {
    await start("USER");
    const response = await call(`/pos-records/${id3}/verification`, "POST", { expectedVersion: 0 });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("FORBIDDEN");
  });

  it("rejects verification with a missing or altered CSRF token", async () => {
    await start();
    const missing = await call(
      `/pos-records/${id3}/verification`,
      "POST",
      { expectedVersion: 0 },
      false,
    );
    expect(missing.status).toBe(403);
    expect(missing.headers.get("content-type")).toContain("application/problem+json");
    const altered = await fetch(`${base}/pos-records/${id3}/verification`, {
      method: "POST",
      headers: { Cookie: cookie, "X-XSRF-TOKEN": "wrong", "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion: 0 }),
    });
    expect(altered.status).toBe(403);
    expect((await altered.json()).code).toBe("INVALID_CSRF_TOKEN");
  });

  it("shows USER identity and denies reviewer mutations and invalid CSRF", async () => {
    expect((await start("USER")).roles).toEqual(["USER"]);
    expect((await call(`/pos-records/${id1}`, "DELETE")).status).toBe(403);
    expect(
      (await call(`/pos-records/${id1}`, "PATCH", { expectedVersion: 0, policyNumber: "P9" }))
        .status,
    ).toBe(403);
    expect((await call(`/pos-records/${id1}/source-archive/content`)).status).toBe(403);
  });

  it("rejects missing and altered CSRF tokens", async () => {
    await start();
    const missing = await call(`/pos-records/${id1}`, "DELETE", undefined, false);
    expect(missing.status).toBe(403);
    expect(missing.headers.get("content-type")).toContain("application/problem+json");
    const altered = await fetch(`${base}/pos-records/${id1}`, {
      method: "DELETE",
      headers: { Cookie: cookie, "X-XSRF-TOKEN": "wrong" },
    });
    expect(altered.status).toBe(403);
    const missingCookie = await fetch(`${base}/pos-records/${id1}`, {
      method: "DELETE",
      headers: { "X-XSRF-TOKEN": "local-pos-mock-csrf" },
    });
    expect(missingCookie.status).toBe(403);
    expect((await call(`/pos-records/${id1}`)).status).toBe(200);
  });

  it("returns 413 for an oversized JSON request", async () => {
    await start();
    const response = await call("/pos-records/search", "POST", { filler: "x".repeat(1024 * 1024) });
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("restores the mock session through the sign-in link after logout", async () => {
    await start();
    expect((await call("/auth/logout", "POST")).status).toBe(204);
    expect((await call("/auth/me")).status).toBe(401);
    const signIn = await fetch(`${base}/oauth2/authorization/google`, { redirect: "manual" });
    expect(signIn.status).toBe(302);
    expect(signIn.headers.get("location")).toBe("/pos/");
    const session = await call("/auth/me");
    expect(session.status).toBe(200);
    expect((await session.json()).roles).toEqual(["REVIEWER"]);
  });

  it("registers the mock middleware in an actual localhost Astro dev server", async () => {
    const astro = spawn(
      process.execPath,
      ["node_modules/astro/astro.js", "dev", "--host", "127.0.0.1", "--port", "0"],
      {
        cwd: process.cwd(),
        env: { ...process.env, POS_MOCK_API: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    const onOutput = (chunk: Buffer) => {
      output += chunk.toString();
    };
    astro.stdout.on("data", onOutput);
    astro.stderr.on("data", onOutput);
    try {
      const port = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Astro did not start: ${output}`)), 15000);
        const inspect = () => {
          const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
          if (match) {
            clearTimeout(timer);
            resolve(Number(match[1]));
          }
        };
        astro.stdout.on("data", inspect);
        astro.stderr.on("data", inspect);
        astro.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Astro exited ${code}: ${output}`));
        });
      });
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`);
      expect(response.status).toBe(200);
      expect((await response.json()).roles).toEqual(["REVIEWER"]);
    } finally {
      astro.kill();
      if (astro.exitCode === null)
        await new Promise<void>((resolve) => astro.once("exit", () => resolve()));
    }
  }, 20000);
});
