# Storage Security Phase 1 — Legacy Application Compatibility Guide

Purpose: this is a self-contained reference for adapting an external "legacy" application (any
stack) so it stays compatible with `blocks-data`'s storage/file/folder API after the Phase 1
Storage Security work. It documents every contract change, flags three decisions the legacy
integration must make explicitly, and ends with a concrete migration checklist.

Related: [STORAGE_SECURITY_PHASE_1_TASKS.md](STORAGE_SECURITY_PHASE_1_TASKS.md) (the implementation
task log this guide is derived from) and
[STORAGE_SECURITY_IMPLEMENTATION_PLAN.md](STORAGE_SECURITY_IMPLEMENTATION_PLAN.md) (the original
design).

---

## 1. Two ways to integrate — pick one

### A. Direct HTTP API (any stack)

Call `blocks-data`'s `FileController`/`DirectoryController` endpoints directly (or through
`blocks-logic`'s compatibility routes, see §7). This is the path for a legacy app that is not a
.NET service, or that talks to storage over HTTP already.

### B. .NET package (`SeliseBlocks.StorageDriver.OS`)

If the legacy app is a .NET service, it can instead reference the
`SeliseBlocks.StorageDriver.OS` NuGet package (currently version **4.1.1** — see §9, a DI
registration bug was found and fixed in this exact version) and call `IStorageDriverService`
in-process. Register it once at startup:

```csharp
services.RegisterBlocksStorageServices(); // Blocks.Extension.DependencyInjection namespace
```

`IStorageDriverService` exposes:

```csharp
Task<GetPreSignedUrlForUploadResponse> GetPerSignedUrlForUploadAsync(GetPreSignedUrlForUploadRequest request);
Task<FileResponse?> GetUrlForDownloadFileAsync(GetFileRequest request);
Task<List<FileResponse>?> GetMultipleUrlsForDownloadFileAsync(GetFilesRequest request);
Task<BaseResponse> DeleteFileAsync(DeleteFileRequest deleteFileRequest);
Task<LocalStorageUploadResponse> UploadFileToLocalStorageAsync(LocalStorageUploadRequest request);
Task<CompleteUploadResponse> CompleteUploadAsync(CompleteUploadRequest request);
```

Everything below describes the wire contract; it applies identically whether you call it over
HTTP or through this interface — the DTOs are the same types either way.

### C. Browser / React (or any client-side JS) frontend

The JSON contract in §6 is language-agnostic and works the same from a React app as from a
backend — but a browser client hits two problems a backend integration never sees. Both are
already solved in this repo's own React client
([storage.service.ts](client/app/storage/services/storage.service.ts)); mirror that solution
rather than the generic description in §6 alone:

1. **Authentication to call `get-pre-signed-url-for-upload`/`complete-upload`/`get-file` at all.**
   These endpoints are behind `[ProtectedEndPoint(...)]` — a from-scratch React app needs whatever
   auth the target deployment expects (this repo's own client attaches a tenant-identifying key via
   `@seliseblocks/genesis-os`'s `HttpClient`, configured from a `BLOCKS_X_BLOCKS_KEY` environment
   value, plus the user's normal session). **This guide's JSON shapes assume you're already past
   that layer — confirm with whoever administers the target deployment what header(s)/session
   mechanism your app must send**, and whether your app should call `blocks-data` directly or
   through `blocks-logic`'s compatibility routes (`/Storage/...`) — that's a deployment-topology
   choice, not something this guide can answer generically.

2. **The `PUT` to the provider URL is cross-origin and must not carry your app's credentials.**
   `uploadUrl` in Step 1's response points at the storage provider's own domain
   (`*.blob.core.windows.net`, `*.s3.amazonaws.com`, etc.), not your API's domain. From a browser,
   that `PUT`:
   - Is a genuinely cross-origin request, so it triggers a CORS preflight for any non-simple header
     (which `requiredHeaders` like `x-ms-blob-type` and a `Content-Type` both are). **The storage
     account/bucket the target configuration points at must have CORS enabled for your app's
     origin, allowing `PUT` and the exact headers you send.** This is infrastructure, not
     something a code change on your side can work around — get it added to the provider's CORS
     policy before testing from a browser.
   - Must **not** send your app's session cookies/auth cross-origin — this repo's own client
     explicitly sets `withCredentials: false` and skips its normal auth header for this one call
     (`skipBlocksKey: true`). With plain `fetch`, this just means not passing
     `credentials: "include"`. Sending your session credentials to a third-party storage domain is
     both unnecessary (the pre-signed URL itself is the auth) and a real security mistake.

   ```ts
   // Step 1 (through your normal authenticated client) and Step 2 (bare fetch, no credentials):
   const presign = await api.post("/files/get-pre-signed-url-for-upload", {
     name: file.name,
     accessModifier: "Private",
     configurationName: "Default",
     parentDirectoryId,
     sizeInBytes: file.size,
     contentType: file.type,
   });

   await fetch(presign.uploadUrl, {
     method: "PUT",
     body: file, // a browser File/Blob works directly as a fetch body
     headers: { "Content-Type": file.type, ...presign.requiredHeaders },
     // no `credentials: "include"` — this request must not carry your app's session
   });

   if (presign.uploadCompletionRequired) {
     const completion = await api.post("/files/complete-upload", {
       fileId: presign.fileId,
       fileVersionId: presign.fileVersionId,
     });
     // handle completion.verificationStatus per §6
   }
   ```

3. **Computing an optional client-side checksum** (`checksum`/`checksumAlgorithm` in Step 1) uses
   the browser's Web Crypto API, e.g.:

   ```ts
   const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
   const checksum = Array.from(new Uint8Array(digest))
     .map((b) => b.toString(16).padStart(2, "0")).join("");
   // checksum: checksum, checksumAlgorithm: "SHA256"
   ```

   `crypto.subtle` requires a secure context (HTTPS or `localhost`); treat this as best-effort and
   simply omit both fields if it's unavailable — the server does not require a checksum.

---

## 2. What actually changed (executive summary)

Before Phase 1, an upload was one round trip: get a pre-signed URL, `PUT` the bytes, done — the
object was immediately live at its final key with no verification step. Phase 1 adds an **optional
second round trip** (upload completion) that a storage configuration can require for `Public`
and/or `Private` uploads. When required, the object is written to a private quarantine location
first, and only becomes readable after the client calls a completion endpoint that synchronously
verifies it and promotes it to its real, final location.

Nothing about this breaks an existing integration that never asks for completion: if a storage
configuration's `UploadCompletionRequiredFor` is empty (the default), the flow is byte-for-byte the
same as before — same request fields, same response fields (with new ones simply additive and
ignorable), same final key format, same read behavior. All the new response fields are nullable;
an old client that doesn't read them experiences no change in behavior.

The three things that **do** require the legacy app to actively participate, once its storage
configuration enables completion for a given modifier:

1. Send declared `SizeInBytes`, `ContentType`, and optionally a `Checksum`/`ChecksumAlgorithm`
   with the upload-URL request (used for verification).
2. After the provider `PUT` succeeds, check `UploadCompletionRequired` in the response and, if
   true, call the completion endpoint before treating the upload as done.
3. Handle the possibility that verification rejects the upload (the object never becomes
   readable) instead of assuming success once the `PUT` returns 2xx.

---

## 3. Core enums and their **current** defaults

### 3.1 `AccessModifier` (Public / Private / Secure / Any)

```csharp
public enum AccessModifier { Private, Public, Secure, Any }
```

Only `Public` and `Private` are meaningful for uploads — `Secure`/`Any` exist in the enum but are
rejected by the upload-URL validator if sent.

**Default: `Private`.** `GetPreSignedUrlForUploadRequest.AccessModifier` is declared as
`public string AccessModifier { get; set; } = "Private";` in the DTO itself, and the service layer
falls back to `AccessModifier.Private` again if an empty string reaches it. So an upload request
that omits this field entirely is `Private` by default — not `Public`.

> **Historical note, relevant to a legacy app:** before Phase 1, essentially every upload call site
> across this whole system (blocks-data's own DMS modal included) hard-coded `"Public"`. Phase 1's
> own DMS-upload-modal change (see task P1.12) replaced that hard-coded value with an explicit
> Public/Private selector defaulting to **Private**. If your legacy app currently sends no
> `AccessModifier` at all and relied on implicit "public" behavior from an older API version, **that
> assumption no longer holds** — you will silently start getting `Private` objects (routed to a
> different key prefix, see §5) unless you set the field explicitly.

**Decision needed:** does the legacy app's frontend let the end user choose Public vs Private per
upload (like the current blocks-data DMS modal does — a "Storage access" selector, independent of
any object-sharing/ACL UI), or does it always upload as one fixed modifier for its use case (e.g.
profile pictures are always `Public`, generated reports are always `Private`)? There is no
"correct" universal answer — it depends on whether end users of the legacy app need to distinguish
public-link-shareable content from access-controlled content. Recommendation: expose the choice in
the UI only where end users genuinely need CDN-style public links; default everything else to
`Private` and let the (separate) object-sharing/ACL model in §3.2 control who can read it.

### 3.2 `ObjectAccessLevel` (Creator / Organization / unset) — a *different* axis

```csharp
public enum ObjectAccessLevel { Creator = 1, Organization = 2 }
```

This is **not** part of the URL/upload-security work — it is the DMS object-level access-control
default, orthogonal to `AccessModifier`. It answers "who besides the creator can see/edit this file
or folder by default, before any explicit share exists" — not "does this need a public or private
provider URL."

- `Creator`: only the creator has access until the item is explicitly shared.
- `Organization`: anyone in the creator's organization has access until narrowed by an explicit
  policy.
- **Unset (`null`, the default when the field is omitted): legacy allow-all.** Every tenant user
  can access the item, exactly as it behaved before this enum existed. This is a genuinely
  backward-compatible default — a legacy app that never sends this field sees **no behavior
  change at all**.

It's accepted (optional) on: `GetPreSignedUrlForUploadRequest`, `CreateDirectoryRequest`,
`UpdateFileRequest` (with a companion `UpdateObjectAccessLevel: bool` to distinguish "clear it" from
"don't touch it"), `UpdateDirectoryRequest` (same pattern), `LocalStorageUploadRequest`. Sent as the
literal string `"Creator"` or `"Organization"` (case-insensitive); anything else is a validation
error (`ObjectAccessLevel must be 'Creator' or 'Organization'.`).

An explicit `ObjectAccessPolicy` grant (created through the sharing endpoints, out of scope of this
guide) always overrides this default regardless of what it's set to.

**Decision needed:** should new files/folders created by the legacy app default to `Creator`
(private-by-default, most conservative — nobody but the uploader sees it until shared),
`Organization` (visible tenant-wide by default, matches how most "shared drive" style legacy tools
behave), or should the *end user* pick per file/folder from a UI control (mirroring the
`AccessModifier` selector's pattern, but for a completely different concern)? Recommendation: if the
legacy app currently has no concept of per-file privacy at all (i.e. it never exposed this idea to
users), leave the field unset — you get identical behavior to before with zero UI work. Only add
this if the legacy app is introducing a genuine "who can see this" concept as part of the
migration; in that case, `Organization` is the safer default for "shared drive"-style tools, and
`Creator` for anything explicitly personal (profile assets, private drafts).

---

## 4. Configuration: what decides whether completion is required at all

`StorageConfiguration.UploadCompletionRequiredFor: List<AccessModifier>?` lives on the **storage
configuration** (the same "Default" or named configuration object every upload references by
`ConfigurationName`), not on the individual upload request. This is an **admin-level setting**, not
something the frontend chooses per upload.

- `null`/omitted/empty list → completion never required (Phase 1's rollout-safe default — see
  P1.15: *"Keep `UploadCompletionRequiredFor` empty initially"*).
- `["Public"]` → only `Public` uploads go through quarantine + verification.
- `["Private"]` → only `Private` uploads do.
- `["Public", "Private"]` → both do.
- Any other string (`"Secure"`, `"Any"`, typos) is silently ignored by
  `IsUploadCompletionRequiredFor` — it only ever checks membership against `{Public, Private}`.

Other configuration fields relevant to every upload, all optional with documented defaults:

| Field | Default when omitted | Meaning |
|---|---|---|
| `UploadUrlExpirySeconds` | 600 (10 min) | How long the returned `UploadUrl` is valid for the provider `PUT`. |
| `DownloadUrlExpirySeconds` | 300 (5 min) | How long a signed download URL from `GetFile`/`GetFiles` stays valid. |
| `MaxFileSizeInBytes` | 5,242,880 (5 MiB) | Declared size above this is rejected before a URL is even issued; actual size above this also fails verification if completion runs. |

Legal range for both expiry fields, if set explicitly: 1–604,800 seconds (7 days).

**The legacy app does not choose whether completion applies** — it only needs to be *able* to
handle it when the configuration it's using says so. Assume it can happen at any time (an admin can
flip the setting later) and always branch on `UploadCompletionRequired` in the response rather than
hard-coding an assumption either way.

---

## 5. Storage key layout (for context, not something you construct yourself)

You never build these keys — the server does — but knowing the shape helps explain the read-gating
behavior in §6.

```text
Completion not required (legacy-compatible, unchanged since before Phase 1):
  Public/{fileId}/{fileVersionId}/{fileName}
  Private/{fileId}/{fileVersionId}/{fileName}

Completion required — object lands here first, in a private-only container/bucket:
  Public/Quarantine/{fileId}/{fileVersionId}/{fileName}
  Private/Quarantine/{fileId}/{fileVersionId}/{fileName}

During completion, a temporary server-owned copy is made for verification:
  Verification/{uploadSessionId}/{randomId}/{fileName}

On success, the quarantined object is promoted (copied) to the same final key format as the
"completion not required" case above — a verified upload ends up at exactly the same kind of key
an old, pre-Phase-1 upload would have used.
```

Quarantined and rejected objects are **not deleted** (Phase 3 handles cleanup) — they simply stay
unreadable forever if never completed or if rejected.

---

## 6. The upload flow, step by step — exactly what to send and when

### Step 1 — Request an upload URL

`POST /files/get-pre-signed-url-for-upload` (or `IStorageDriverService.GetPerSignedUrlForUploadAsync`)

```jsonc
{
  "itemId": "",                       // empty for a new file; existing FileId to add a new version
  "name": "invoice.pdf",
  "parentDirectoryId": "dir-123",     // required unless moduleName resolves a default directory
  "tags": "",
  "accessModifier": "Private",        // "Public" | "Private" — defaults to "Private" if omitted, see §3.1
  "objectAccessLevel": null,          // "Creator" | "Organization" | omit entirely, see §3.2
  "configurationName": "Default",
  "moduleName": 0,
  "metaData": "",
  "additionalProperties": {},

  // New in Phase 1 — all optional, but SizeInBytes/ContentType are what verification checks against
  "sizeInBytes": 48213,
  "contentType": "application/pdf",
  "checksum": "3b8f...e2",            // optional; omit if you don't compute one client-side
  "checksumAlgorithm": "SHA256"       // "MD5" | "SHA1" | "SHA256" (default if unrecognized: SHA256)
}
```

If `sizeInBytes` exceeds the configuration's `MaxFileSizeInBytes`, this call itself fails — no
URL is issued.

Response:

```jsonc
{
  "isSuccess": true,
  "uploadUrl": "https://...",                       // unchanged shape from before Phase 1
  "fileId": "f-abc123",                              // unchanged shape from before Phase 1

  // New in Phase 1 — additive, ignorable by an old client
  "fileVersionId": "v-1",
  "uploadSessionId": "sess-xyz",
  "uploadUrlExpiresAtUtc": "2026-09-16T12:10:00Z",
  "requiredHeaders": { "x-ms-blob-type": "BlockBlob" },  // merge these into the PUT — provider-specific
  "uploadCompletionRequired": true,                  // <-- branch on this
  "verificationStatus": "Quarantined"                // "Unverified" if uploadCompletionRequired is false
}
```

### Step 2 — Upload the bytes

`PUT` the raw file body to `uploadUrl`, headers = `requiredHeaders` merged with your own
`Content-Type` (matching what you declared). Complete this before `uploadUrlExpiresAtUtc`.

**From a browser, this is a cross-origin request** — see §1C for the CORS and credentials
implications before you implement this in a React (or any client-side JS) app; they don't apply
to a server-to-server integration.

### Step 3 — Complete the upload, only if `uploadCompletionRequired` was `true`

`POST /files/complete-upload` (blocks-data direct) — or the `blocks-logic` compatibility route
`POST /Storage/CompleteUpload` if the legacy app talks to Logic instead of blocks-data directly.

```jsonc
{ "fileId": "f-abc123", "fileVersionId": "v-1" }
```

Response:

```jsonc
{
  "isSuccess": true,
  "fileId": "f-abc123",
  "fileVersionId": "v-1",
  "verificationStatus": "Verified",     // or "Rejected"
  "rejectionReason": null                // set only when verificationStatus is "Rejected"
}
```

- **Idempotent**: calling this again for an already-`Verified` or already-`Rejected` version just
  returns that same result — safe to retry on a network timeout without double-processing.
- **Authorized**: the same `Edit` permission check as any file write applies to the exact
  `fileId`/`fileVersionId` pair; a mismatched pair is treated as not found/denied.
- If `verificationStatus` comes back `"Rejected"`, **the upload failed** — do not treat the earlier
  successful `PUT` as success. Surface `rejectionReason` to the user (see table below) and prompt a
  new attempt (a new `GetPreSignedUrlForUpload` call — the rejected version is not reusable).

### Step 4 — If `uploadCompletionRequired` was `false`

Nothing else to do — the object is already at its final key and readable, exactly like a
pre-Phase-1 upload.

### Rejection reasons your UI should be ready to explain

| `rejectionReason` | Meaning |
|---|---|
| `quarantine_key_missing` | Internal — the version had no quarantine key recorded. |
| `quarantine_object_not_found` | The `PUT` never actually completed, or completion was called before it did. |
| `candidate_object_not_found` | Internal copy-for-verification step failed. |
| `actual_size_does_not_match_declared_size` | The bytes uploaded don't match the `sizeInBytes` you declared in Step 1. |
| `actual_size_exceeds_maximum_allowed` | The uploaded bytes exceed the configuration's `MaxFileSizeInBytes`, even if it fit your own declared size. |
| `stored_content_type_does_not_match_declared_content_type` | The provider-stored content type disagrees with your declared `contentType`. |
| `real_file_type_does_not_match_extension` | A lightweight magic-number check found the file's real bytes don't match its extension (currently checks `.pdf`, `.png`, `.jpg`/`.jpeg`, `.gif`, `.zip`/`.docx`/`.xlsx`/`.pptx`; anything else is let through unchecked). |
| `checksum_mismatch` | You supplied a `checksum` and it didn't match the actual uploaded content. |

---

## 7. Reading files back — nothing new to send, but new fields to read

`GET /files/get-file` / `POST /files/get-files` responses (`FileResponse`) now include:

```jsonc
{
  "url": "",                                  // EMPTY when the version is Quarantined or Rejected
  "verificationStatus": "Quarantined",        // null/"Unverified" behave exactly as before Phase 1
  "downloadUrlExpiresAtUtc": "2026-09-16T12:05:00Z", // null for a non-expiring anonymous Public URL
  "objectAccessLevel": null,
  // ...all pre-existing fields unchanged (itemId, name, sizeInBytes, accessModifier, etc.)
}
```

If `url` is empty and `verificationStatus` is `"Quarantined"` or `"Rejected"`, the file exists but
is intentionally unreadable — this is not an error, it's the read-gating policy. Every other status
(`null`, `"Unverified"`, `"Verified"`) is readable subject to whatever access-policy checks already
applied before Phase 1. **Never cache a returned `url` past `downloadUrlExpiresAtUtc`** — re-fetch
instead of reusing a dead signed URL.

---

## 8. Folder (directory) API — unaffected except for the same optional `ObjectAccessLevel`

Directory endpoints did not change for Phase 1 beyond accepting the same optional
`ObjectAccessLevel` field described in §3.2:

| Endpoint | Purpose |
|---|---|
| `POST /directory/create-directory` | Create beneath an existing parent (or a module's default directory if `parentDirectoryId` is omitted and `moduleName` is set). |
| `POST /directory/create-root-directory` | Start a new root tree (separate, stronger permission than a nested create). |
| `GET /directory/get-directory` | Directory details + the caller's effective permissions on it. |
| `POST /directory/update-directory` | Rename, change description, or change `ObjectAccessLevel`. |
| `POST /directory/delete-directory` | Trash, or permanently remove. |
| `POST /directory/move-directory` | Re-parent. |

File-level structural operations, also unaffected by Phase 1:
`POST /files/CopyFile`, `POST /files/MoveFile`, `POST /files/RenameFile`,
`POST /files/GetFileVersions`, `POST /files/CreateFileVersion`.

---

## 9. ⚠️ A removed legacy endpoint — check this first if the legacy app predates 2026-08

**`POST /files/upload-file` (and its `UploadFilesRequest`/`UploadFileResponse`/`ArtifactBaseRequest`
DTOs) no longer exist in blocks-data.** They were removed 2026-08-03 as part of a "DMS file upload
functionality" cleanup, well before Phase 1. That endpoint's shape was fundamentally different from
today's flow — it *registered* an already-uploaded blob (identified by a caller-supplied
`FileStorageId`) as a DMS artifact with metadata (`ArtifactName`, `ParentId`, `DmsWorkspaceId`,
tags, etc.), rather than issuing an upload URL itself:

```jsonc
// REMOVED — for reference only, do not implement against this shape
{
  "upload": [{
    "fileStorageId": "...",
    "itemId": "...", "artifactName": "...", "parentId": "...",
    "dmsWorkspaceId": "...", "dmsWorkspaceName": "...",
    "tags": [], "metaData": {}, "organizationId": "..."
  }]
}
```

**If the legacy app currently calls this endpoint (or an equivalent "register this blob as a file"
pattern), it must be rewritten to use the `GetPreSignedUrlForUpload` → `PUT` →
(optional) `CompleteUpload` flow in §6 instead.** There is no compatibility shim for the old
endpoint — it is gone, not deprecated-but-working.

---

## 10. Package/version note (only relevant if using the .NET package directly, §1B)

`SeliseBlocks.StorageDriver.OS` versions before **4.1.0** predate `CompleteUploadAsync` and every
Phase 1 field entirely — restore/pin at least `4.1.1`. (`4.1.0` itself shipped with a DI
registration bug: `RegisterBlocksStorageServices()` didn't register `IObjectAccessResolver`,
`IObjectAccessRepository`, `IUploadKeyRouter`, or `IUploadVerificationService`, which crashes the
very first call that constructs `FileManagementService` with
`System.InvalidOperationException: Unable to resolve service for type '...IObjectAccessResolver'`.
Fixed in `4.1.1`.)

---

## 11. Migration checklist

- [ ] **Locate every call site** in the legacy app that currently calls a pre-signed-upload-URL
      endpoint (or the removed `upload-file` endpoint — see §9, this one needs a full rewrite, not
      just new fields).
- [ ] **Decide the `AccessModifier` question** (§3.1): fixed value per use case, or a UI choice?
      Explicitly set it on every upload request — do not rely on the implicit default matching what
      you actually want.
- [ ] **Decide the `ObjectAccessLevel` question** (§3.2): leave unset (zero behavior change), or
      adopt `Creator`/`Organization`/a UI choice as part of introducing real per-file privacy?
- [ ] **Add `sizeInBytes` and `contentType`** to every upload-URL request — required for
      verification to run correctly if/when the configuration enables completion, and for the
      pre-issuance size check either way.
- [ ] **Branch on `uploadCompletionRequired`** in the upload-URL response; call
      `POST /files/complete-upload` when true, before considering the upload done.
- [ ] **Handle `verificationStatus: "Rejected"`** as a genuine failure with a user-facing message
      (map `rejectionReason` per the table in §6), not as success.
- [ ] **Handle `url: ""` with `verificationStatus` of `"Quarantined"`/`"Rejected"`** on reads as
      "not yet/never readable," not as a missing-file error.
- [ ] **Stop caching download URLs past `downloadUrlExpiresAtUtc`.**
- [ ] If consuming the NuGet package directly, **pin `SeliseBlocks.StorageDriver.OS` ≥ 4.1.1**
      (§10).
- [ ] Confirm with whoever administers the target storage configuration whether
      `UploadCompletionRequiredFor` is (or will be) non-empty for the modifiers the legacy app
      uses — that determines whether steps above are exercised in practice or effectively dormant.
- [ ] **If the client is a browser app (React or otherwise), also:**
  - [ ] Confirm the auth mechanism and base URL (`blocks-data` vs `blocks-logic`) with whoever
        administers the target deployment (§1C.1) — this guide's payloads assume you're already
        authenticated.
  - [ ] Get the storage provider's CORS policy updated for your app's origin before testing the
        direct-to-provider `PUT` from a browser (§1C.2) — this is an infra change, not a code
        change, and is the single most common failure mode for a first browser integration.
  - [ ] Make sure the `PUT` in Step 2 does **not** send your app's session credentials
        cross-origin (§1C.2).
