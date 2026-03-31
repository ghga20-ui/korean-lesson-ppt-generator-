import test from "node:test";
import assert from "node:assert/strict";

import { uploadPdfToGeminiFile } from "../src/lib/gemini-file-upload.ts";

test("uploads a PDF to Gemini Files API and returns the file URI", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const pdf = new File([new Uint8Array([1, 2, 3, 4])], "sample.pdf", {
    type: "application/pdf",
  });

  const fetchMock: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });

    if (calls.length === 1) {
      return new Response(null, {
        status: 200,
        headers: {
          "X-Goog-Upload-URL": "https://upload.example/session-123",
        },
      });
    }

    return Response.json({ file: { uri: "gemini://files/abc123" } });
  };

  const fileUri = await uploadPdfToGeminiFile(pdf, "fake-key", fetchMock);

  assert.equal(fileUri, "gemini://files/abc123");
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /upload\/v1beta\/files\?key=fake-key&uploadType=resumable$/);
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(
    new Headers(calls[0].init?.headers).get("X-Goog-Upload-Command"),
    "start",
  );
  assert.equal(calls[1].url, "https://upload.example/session-123");
  assert.equal(
    new Headers(calls[1].init?.headers).get("X-Goog-Upload-Command"),
    "upload, finalize",
  );
});

test("throws when Gemini does not return an upload URL", async () => {
  const pdf = new File([new Uint8Array([1])], "sample.pdf", {
    type: "application/pdf",
  });

  await assert.rejects(
    () =>
      uploadPdfToGeminiFile(
        pdf,
        "fake-key",
        async () => new Response(null, { status: 200 }),
      ),
    /upload URL/i,
  );
});
