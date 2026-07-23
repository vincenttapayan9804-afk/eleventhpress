/**
 * Single source of truth for what a direct client upload may contain —
 * previously duplicated (and drifting: presign-local/route.ts's copy had
 * no size cap at all) across src/app/api/storage/{presign,presign-local}/
 * route.ts. The size cap here is enforced for real in
 * src/app/api/storage/upload-local/[token]/route.ts, the actual receiving
 * end of every upload in this app (see that file's comment on why the
 * Vercel-Blob-native presign route is currently dead code).
 */

export interface BucketUploadRules {
  contentTypes: string[];
  maxSizeBytes: number;
}

export const BUCKET_UPLOAD_RULES: Record<string, BucketUploadRules> = {
  "raw-submissions": {
    contentTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/markdown",
      "text/plain",
      "text/html",
      "application/x-tex",
    ],
    maxSizeBytes: 50 * 1024 * 1024,
  },
  avatars: {
    contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  applications: {
    contentTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 10 * 1024 * 1024,
  },
  "book-covers": {
    contentTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  "book-manuscripts": {
    contentTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/markdown",
      "text/plain",
      "text/html",
    ],
    maxSizeBytes: 50 * 1024 * 1024,
  },
  "research-audio": {
    contentTypes: ["audio/wav", "audio/x-wav", "audio/wave"],
    maxSizeBytes: 25 * 1024 * 1024,
  },
  "magazine-images": {
    contentTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  "podcast-covers": {
    contentTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSizeBytes: 5 * 1024 * 1024,
  },
  // Full episodes, not the short WAV clips research-audio is sized for —
  // MP3 (the format every podcast directory actually expects) at up to
  // ~2 hours of audio at a reasonable bitrate.
  "podcast-audio": {
    contentTypes: ["audio/mpeg", "audio/mp3"],
    maxSizeBytes: 200 * 1024 * 1024,
  },
};

/**
 * Real magic-byte signatures for the binary formats above — a renamed
 * `.exe` declared as `Content-Type: application/pdf` fails this check even
 * though it passed the string-equality content-type allowlist. Plain-text
 * formats (markdown/plain/html/TeX) have no reliable magic number, so
 * they're intentionally absent here and fall through to "no sniffer
 * registered — allow" below; they're still constrained by the content-type
 * allowlist and size cap.
 */
const MAGIC_SNIFFERS: Record<string, (bytes: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 4).toString("latin1") === "%PDF",
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte),
  "image/gif": (b) => {
    const header = b.subarray(0, 6).toString("latin1");
    return header === "GIF87a" || header === "GIF89a";
  },
  "image/webp": (b) =>
    b.length >= 12 &&
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP",
  // .docx (OOXML) is a ZIP archive under the hood.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b) =>
    b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07),
  // Legacy .doc is an OLE2 compound file.
  "application/msword": (b) =>
    b.length >= 8 &&
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, i) => b[i] === byte),
  // WAV is a RIFF container declaring "WAVE" as its form type.
  "audio/wav": (b) =>
    b.length >= 12 &&
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WAVE",
  // MP3 has no single fixed header: either an "ID3" tag (most files exported
  // by real editors/hosts) or, for a tagless file, a raw frame sync (an 0xFF
  // byte followed by a byte with its top 3 bits set).
  "audio/mpeg": (b) =>
    b.length >= 3 && (b.subarray(0, 3).toString("latin1") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)),
};
// audio/x-wav and audio/wave are the same on-disk format as audio/wav —
// the browser/OS just disagrees on which MIME string to send.
MAGIC_SNIFFERS["audio/x-wav"] = MAGIC_SNIFFERS["audio/wav"];
MAGIC_SNIFFERS["audio/wave"] = MAGIC_SNIFFERS["audio/wav"];
// Same on-disk format as audio/mpeg under a less common MIME string.
MAGIC_SNIFFERS["audio/mp3"] = MAGIC_SNIFFERS["audio/mpeg"];

function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${Math.round(n / (1024 * 1024))} MB` : `${Math.round(n / 1024)} KB`;
}

export type UploadValidation = { ok: true } | { ok: false; status: number; error: string };

/** The real enforcement check — bucket rules, size cap, and (where a signature is known) that the bytes actually are what the declared content type claims. */
export function validateUploadBytes(bucket: string, contentType: string, bytes: Buffer): UploadValidation {
  const rules = BUCKET_UPLOAD_RULES[bucket];
  if (!rules) {
    return { ok: false, status: 400, error: `Unknown bucket: ${bucket}` };
  }
  if (bytes.length === 0) {
    return { ok: false, status: 400, error: "Empty upload body" };
  }
  if (bytes.length > rules.maxSizeBytes) {
    return { ok: false, status: 413, error: `File exceeds the ${formatBytes(rules.maxSizeBytes)} limit for this upload type` };
  }
  if (!rules.contentTypes.includes(contentType)) {
    return { ok: false, status: 400, error: `Unsupported content type: ${contentType}` };
  }
  const sniff = MAGIC_SNIFFERS[contentType];
  if (sniff && !sniff(bytes)) {
    return { ok: false, status: 400, error: "File contents don't match the declared file type" };
  }
  return { ok: true };
}
