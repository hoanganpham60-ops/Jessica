#!/usr/bin/env node
/**
 * Post-install patch for openclaw – Zalo WS file_done race fix.
 *
 * Applied to: dist-BToDNeJt.js (openclaw >= 2026.4.11)
 *
 * Problem: the Zalo "asyncfile" upload pipeline sends a WS cmd=601
 * file_done event that sometimes arrives before uploadAttachment has
 * registered its callback.  When the gateway and a CLI subprocess both
 * hold a Zalo WS session, Zalo routes file_done to whichever session it
 * chooses – so the callback may never fire.
 *
 * Fix:
 *   1. In the cmd=601 handler, buffer the file_done payload if no
 *      callback is registered yet.
 *   2. In uploadAttachment, check the buffer before registering the
 *      callback.
 *   3. Raise the safety timeout from 30 s → 150 s.
 */

"use strict";
const fs   = require("fs");
const path = require("path");

const DIST = "/usr/local/lib/node_modules/openclaw/dist";
const FILE = path.join(DIST, "dist-BToDNeJt.js");

if (!fs.existsSync(FILE)) {
  console.error("[patch] ERROR: file not found:", FILE);
  process.exit(1);
}

let src = fs.readFileSync(FILE, "utf8");

// Guard: already patched?
if (src.includes("recentUploadResults")) {
  console.log("[patch] Already patched – nothing to do.");
  process.exit(0);
}

let patched = 0;

// ── Patch 1: WS cmd=601 file_done handler ──────────────────────────────────
//
// Original pattern (single if, no else):
//
//   const uploadCallback = this.ctx.uploadCallbacks.get(fileIdKey);
//   if (uploadCallback) {
//     uploadCallback(data);
//     this.ctx.uploadCallbacks.delete(fileIdKey);
//   }
//   this.emit("upload_attachment", data);
//
// Replacement: add an else branch that buffers the event.
//
// We use a regex that is anchored to the unique "this.ctx.uploadCallbacks"
// pattern to avoid false positives.

const P1_RE = /(const uploadCallback = this\.ctx\.uploadCallbacks\.get\(fileIdKey\);\s*if \(uploadCallback\) \{\s*uploadCallback\(data\);\s*this\.ctx\.uploadCallbacks\.delete\(fileIdKey\);\s*\})(\s*this\.emit\("upload_attachment", data\);)/;

const P1_ELSE = [
  " else {",
  "\t\t\t\t\t\t\t// Race condition workaround: WS event arrived before callback registered.",
  "\t\t\t\t\t\t\tif (!this.ctx.recentUploadResults) this.ctx.recentUploadResults = new Map();",
  "\t\t\t\t\t\t\tthis.ctx.recentUploadResults.set(fileIdKey, data);",
  "\t\t\t\t\t\t\tconst recent = this.ctx.recentUploadResults;",
  "\t\t\t\t\t\t\tsetTimeout(() => { recent.delete(fileIdKey); }, 60000);",
  "\t\t\t\t\t\t}",
].join("\n");

if (P1_RE.test(src)) {
  src = src.replace(P1_RE, (_, ifBlock, emitLine) => ifBlock + P1_ELSE + emitLine);
  patched++;
  console.log("[patch] Patch 1 applied (WS file_done buffer).");
} else {
  console.warn("[patch] WARNING: Patch 1 anchor not found – skipping (openclaw may have changed).");
}

// ── Patch 2: uploadAttachment – buffer check + 150 s timeout ───────────────
//
// Original pattern (callback set + 30 s timeout):
//
//   ctx.uploadCallbacks.set(fileIdKey, uploadCallback);
//   setTimeout(() => {
//     if (ctx.uploadCallbacks.get(fileIdKey) === uploadCallback) {
//       ctx.uploadCallbacks.delete(fileIdKey);
//       ...
//     }
//   }, 30000);
//
// Replacement: check buffer first; raise timeout to 150 s.

const P2_RE = /(ctx\.uploadCallbacks\.set\(fileIdKey, uploadCallback\);\s*)(setTimeout\(\(\) => \{\s*if \(ctx\.uploadCallbacks\.get\(fileIdKey\) === uploadCallback\) \{\s*ctx\.uploadCallbacks\.delete\(fileIdKey\);)/;

const P2_PREFIX = [
  "// Race-fix: check if WS file_done already arrived before we got here.",
  "\t\t\t\t\t\t\t\tconst buffered = ctx.recentUploadResults && ctx.recentUploadResults.get(fileIdKey);",
  "\t\t\t\t\t\t\t\tif (buffered) {",
  "\t\t\t\t\t\t\t\t\tctx.recentUploadResults.delete(fileIdKey);",
  "\t\t\t\t\t\t\t\t\tuploadCallback(buffered);",
  "\t\t\t\t\t\t\t\t} else {",
  "\t\t\t\t\t\t\t\t",
].join("\n");

if (P2_RE.test(src)) {
  // Step 2a: inject buffer check before ctx.uploadCallbacks.set
  src = src.replace(P2_RE, (_, setLine, timeoutOpen) => P2_PREFIX + setLine + "\t\t\t\t\t\t\t\t// Safety timeout – give Zalo's asyncfile pipeline plenty of headroom.\n\t\t\t\t\t\t\t\t" + timeoutOpen);
  patched++;
  console.log("[patch] Patch 2a applied (uploadAttachment buffer check).");

  // Step 2b: raise timeout 30000 → 150000 and close the else block
  // Find the first }, 30000); that appears after our new insertion
  const TO_RE = /}, 30000\);/;
  if (TO_RE.test(src)) {
    src = src.replace(TO_RE, "}, 150000);\n\t\t\t\t\t\t\t\t}");
    patched++;
    console.log("[patch] Patch 2b applied (150 s timeout + else close).");
  } else {
    console.warn("[patch] WARNING: Patch 2b (30000 timeout) not found – skipping.");
  }
} else {
  console.warn("[patch] WARNING: Patch 2 anchor not found – skipping (openclaw may have changed).");
}

if (patched > 0) {
  fs.writeFileSync(FILE, src, "utf8");
  console.log("[patch] Written:", FILE, "(" + patched + " change(s)).");
} else {
  console.log("[patch] No changes written.");
}
