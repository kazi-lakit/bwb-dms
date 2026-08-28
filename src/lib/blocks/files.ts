import { blocksFilesFetch } from "./http";

/**
 * Matches the current data-service swagger
 * (https://api.seliseblocks.com/data/v4/swagger/v1/swagger.json), not the older
 * `/files/get-dms-file-and-folder`-based legacy contract described in the blocks-data-storage
 * skill — the data service uses `/directory/*` for folder mutations,
 * `/objects/*` for folder and file listings, and `/files/*` for file content.
 *
 * Storage calls run against a separate local instance of that service
 * (`NEXT_PUBLIC_BLOCKS_STORAGE_API_URL`, default `http://localhost:9000`), not the
 * `blocksapi.dev.slsblx.com` gateway used for IAM — and that instance's base path is
 * `/api`, matching the swagger exactly (e.g. `/api/objects/get-objects`).
 * See `blocksFilesFetch` in `./http`.
 */

export interface PresignResponse {
  isSuccess?: boolean;
  uploadUrl?: string;
  fileId?: string;
}

// DomainService.Storage.FileMetaDataResponse — one metadata entry as it comes back from
// get-file. `type` is a free-form, unvalidated label (this app always writes "String").
export interface FileMetaDataEntry {
  type?: string;
  value?: string;
}

// DomainService.Storage.FileResponse
export interface FileRecord {
  itemId?: string;
  name?: string;
  url?: string;
  sizeInBytes?: number;
  createDate?: string;
  createdBy?: string;
  parentDirectoryID?: string;
  systemName?: string;
  typeString?: string;
  accessModifier?: "Public" | "Private";
  tags?: string[];
  metaData?: Record<string, FileMetaDataEntry>;
}

/**
 * `GetPreSignedUrlForUploadRequest.metaData` is a plain string on the wire — the server
 * JSON-parses it into `Dictionary<string, MetaValue>` using case-sensitive default options
 * (confirmed against Storage.DomainService's `FileManagementService.CreateNewFileAsync`,
 * which calls `JsonSerializer.Deserialize` with no naming policy), so the inner keys must be
 * `Type`/`Value` (PascalCase) even though every other field on this app's wire format is
 * camelCase. Getting this wrong doesn't error — it just silently deserializes to nulls.
 */
function buildMetaDataPayload(metadata?: Record<string, string>): string {
  if (!metadata || Object.keys(metadata).length === 0) return "{}";
  const entries = Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key, { Type: "String", Value: value }])
  );
  return JSON.stringify(entries);
}

/**
 * Metadata pulled straight off the browser `File` object — no user input involved.
 * `lastModified` is the OS-reported mtime, not upload time (that's `createDate` on the
 * resulting FileRecord already).
 */
export function fileIntrinsicMetadata(file: File): Record<string, string> {
  return {
    originalName: file.name,
    mimeType: file.type || "application/octet-stream",
    lastModified: new Date(file.lastModified).toISOString(),
  };
}

/**
 * A folder/file row from `/objects/get-objects`. The live swagger declares
 * this endpoint's response with no schema (just "200 OK"), so the exact field names
 * are unconfirmed — `normalizeDirectoryChildren` below tries the plausible shapes
 * defensively. If the drive UI shows nothing where files are expected, capture the
 * real response from the browser's Network tab and tighten this up.
 */
export interface DirectoryChild {
  id: string;
  name: string;
  isFolder: boolean;
  sizeInBytes?: number;
  createdDate?: string;
}

interface DirectoryChildrenPage {
  entries: DirectoryChild[];
  nextCursor?: string;
}

// DomainService.Storage.Dms.FileVersionDto, from GetFileVersions — confirmed against the
// Storage.DomainService source (FileVersionDto in DmsObjectResponses.cs), since the swagger
// doc leaves this endpoint's response schema undeclared like get-objects above.
export interface FileVersion {
  itemId: string;
  no: number;
  sizeInBytes: number;
  uploadedBy?: string;
  createdDate?: string;
}

interface FileVersionsPage {
  items: FileVersion[];
  nextCursor?: string;
  hasMore: boolean;
}

function providerHeaders(uploadUrl: string, contentType: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": contentType || "application/octet-stream" };
  if (/\.blob\.core\.windows\.net/i.test(uploadUrl)) {
    headers["x-ms-blob-type"] = "BlockBlob";
  }
  return headers;
}

export const filesApi = {
  // POST /files/get-pre-signed-url-for-upload — DomainService.Storage.GetPreSignedUrlForUploadRequest
  presign: (
    name: string,
    parentDirectoryId = "",
    accessModifier: "Public" | "Private" = "Private",
    metadata?: Record<string, string>
  ) =>
    blocksFilesFetch<PresignResponse>(`/files/get-pre-signed-url-for-upload`, {
      method: "POST",
      body: JSON.stringify({
        name,
        parentDirectoryId,
        accessModifier,
        configurationName: "Default",
        moduleName: 3,
        tags: "",
        metaData: buildMetaDataPayload(metadata),
      }),
    }),

  /** Presign, then PUT the raw bytes straight to storage. No application-server upload step. */
  upload: async (file: File, parentDirectoryId = "", metadata?: Record<string, string>): Promise<FileRecord> => {
    const { uploadUrl, fileId } = await filesApi.presign(file.name, parentDirectoryId, "Private", metadata);
    if (!uploadUrl || !fileId) throw new Error("Presign failed — no uploadUrl/fileId returned");

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: providerHeaders(uploadUrl, file.type),
      body: file,
    });
    if (!put.ok) throw new Error(`Storage upload failed: ${put.status}`);

    return filesApi.get(fileId);
  },

  // GET /files/get-file?FileId=&ConfigurationName=&Version= — omit `version` for the
  // current version; pass a version's `no` (from getVersions) to fetch an older one.
  get: (fileId: string, configurationName = "Default", version?: number) => {
    const params = new URLSearchParams({ FileId: fileId, ConfigurationName: configurationName });
    if (version !== undefined) params.set("Version", String(version));
    return blocksFilesFetch<FileRecord>(`/files/get-file?${params.toString()}`);
  },

  // GET /files/get-file-versions?FileId=&Cursor=&Limit= — newest first.
  getVersions: (fileId: string, opts: { cursor?: string; limit?: number } = {}) => {
    const params = new URLSearchParams({ FileId: fileId });
    if (opts.cursor) params.set("Cursor", opts.cursor);
    params.set("Limit", String(opts.limit ?? 25));
    return blocksFilesFetch<{ items?: FileVersion[]; nextCursor?: string; hasMore?: boolean }>(
      `/files/get-file-versions?${params.toString()}`
    );
  },

  // POST /files/get-files — DomainService.Storage.GetFilesRequest
  getMany: (fileIds: string[], configurationName = "Default") =>
    blocksFilesFetch<FileRecord[]>(`/files/get-files`, {
      method: "POST",
      body: JSON.stringify({ fileIds, configurationName }),
    }),

  // POST /files/delete-file — DomainService.Storage.DeleteFileRequest -> Blocks.Genesis.BaseResponse
  deleteFile: (fileId: string, configurationName = "Default", permanent = false) =>
    blocksFilesFetch<{ isSuccess?: boolean }>(`/files/delete-file`, {
      method: "POST",
      body: JSON.stringify({ fileId, configurationName, permanent }),
    }),

  // POST /files/move-file — DomainService.Storage.Dms.MoveFileRequest
  moveFile: (fileId: string, targetDirectoryId: string) =>
    blocksFilesFetch<{ isSuccess?: boolean }>(`/files/move-file`, {
      method: "POST",
      body: JSON.stringify({ fileId, targetDirectoryId }),
    }),

  // POST /files/copy-file — DomainService.Storage.Dms.CopyFileRequest
  copyFile: (fileId: string, targetDirectoryId: string, copyAccessPolicies = false) =>
    blocksFilesFetch<{ isSuccess?: boolean }>(`/files/copy-file`, {
      method: "POST",
      body: JSON.stringify({ fileId, targetDirectoryId, copyAccessPolicies }),
    }),

  // POST /files/rename-file — DomainService.Storage.Dms.RenameFileRequest. Keeps the file
  // in place and preserves its stored bytes/versions; only the name changes.
  renameFile: (fileId: string, name: string) =>
    blocksFilesFetch<{ isSuccess?: boolean }>(`/files/rename-file`, {
      method: "POST",
      body: JSON.stringify({ fileId, name }),
    }),
};

// The root listing (no directory picked yet) has no DirectoryId to pass, so it
// identifies itself by ModuleName instead — confirmed live for this project. Once
// you're inside a folder, DirectoryId alone is enough and ModuleName is dropped.
const ROOT_MODULE_NAME = 8;

export const directoryApi = {
  // GET /objects/get-objects?ParentDirectoryId=&ModuleName=&Cursor=&Limit=&Type=&Search=
  getChildren: (directoryId: string, opts: { cursor?: string; limit?: number; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (directoryId) {
      params.set("ParentDirectoryId", directoryId);
    } else {
      params.set("ModuleName", String(ROOT_MODULE_NAME));
    }
    if (opts.cursor) params.set("Cursor", opts.cursor);
    params.set("Limit", String(opts.limit ?? 200));
    if (opts.search) params.set("Search", opts.search);
    return blocksFilesFetch<unknown>(`/objects/get-objects?${params.toString()}`);
  },

  // POST /directory/create-directory — DomainService.Storage.Dms.CreateDirectoryRequest
  createDirectory: (name: string, parentDirectoryId = "") =>
    blocksFilesFetch<{ isSuccess?: boolean; errors?: unknown }>(`/directory/create-directory`, {
      method: "POST",
      body: JSON.stringify({
        name,
        ...(parentDirectoryId ? { parentDirectoryId } : { moduleName: ROOT_MODULE_NAME }),
        configurationName: "Default",
      }),
    }),

  // POST /directory/create-directory — the user's own drive root. No parentDirectoryId;
  // ModuleName=8 identifies it as a drive directory instead, same module id as the root
  // listing above. Confirmed live for this project.
  createDriveRoot: (name: string) =>
    blocksFilesFetch<unknown>(`/directory/create-directory`, {
      method: "POST",
      body: JSON.stringify({ name, moduleName: ROOT_MODULE_NAME, configurationName: "Default" }),
    }),

  // POST /directory/delete-directory — DomainService.Storage.Dms.DeleteDirectoryRequest
  // `permanent: false` moves it to the app's trash view rather than erasing it outright.
  deleteDirectory: (directoryId: string, permanent = false) =>
    blocksFilesFetch<{ isSuccess?: boolean }>(`/directory/delete-directory`, {
      method: "POST",
      body: JSON.stringify({ directoryId, permanent }),
    }),

  // POST /directory/move-directory — DomainService.Storage.Dms.MoveDirectoryRequest
  moveDirectory: (directoryId: string, targetDirectoryId: string) =>
    blocksFilesFetch<{ isSuccess?: boolean }>(`/directory/move-directory`, {
      method: "POST",
      body: JSON.stringify({ directoryId, targetDirectoryId }),
    }),

  // POST /directory/update-directory — DomainService.Storage.Dms.UpdateDirectoryRequest. Also
  // accepts `description`, but renaming is the only thing this app's UI exposes.
  renameDirectory: (directoryId: string, name: string) =>
    blocksFilesFetch<{ isSuccess?: boolean }>(`/directory/update-directory`, {
      method: "POST",
      body: JSON.stringify({ directoryId, name }),
    }),
};

/**
 * Neither `get-objects` nor `get-shared-objects` (access.ts) declares a response
 * schema — both return the same kind of file/directory row, so this envelope/row
 * parsing is shared between them rather than duplicated.
 */
export function extractEntryList(raw: unknown): unknown[] {
  return Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
      ? (raw as { data: unknown[] }).data
      : Array.isArray((raw as { items?: unknown })?.items)
        ? (raw as { items: unknown[] }).items
        : Array.isArray((raw as { children?: unknown })?.children)
          ? (raw as { children: unknown[] }).children
          : Array.isArray((raw as { result?: unknown })?.result)
            ? (raw as { result: unknown[] }).result
            : [];
}

export function parseDirectoryChildEntry(entry: unknown): DirectoryChild {
  const row = entry as Record<string, unknown>;
  const id = (row.id ?? row.itemId ?? row.directoryId ?? row.fileId ?? "") as string;
  const name = (row.name ?? "") as string;
  // Confirmed live: `type` is a string ("directory" | "file"), not the numeric
  // StructureType enum used elsewhere in this API — check it first.
  const isFolder =
    (typeof row.type === "string" && row.type.toLowerCase() === "directory") ||
    Boolean(row.isFolder ?? row.isDirectory) ||
    row.type === 1 ||
    row.typeString === "Directory" ||
    row.structureType === 1;
  const sizeInBytes = (row.sizeInBytes as number | undefined) ?? undefined;
  const createdDate = (row.createDate ?? row.createdDate) as string | undefined;
  return { id, name, isFolder, sizeInBytes, createdDate };
}

export function extractNextCursor(raw: unknown): string | undefined {
  const envelope = raw && typeof raw === "object" ? (raw as { nextCursor?: string; cursor?: string }) : {};
  return envelope.nextCursor ?? envelope.cursor;
}

/**
 * `get-objects`' response has no declared schema — try the plausible
 * envelopes and field-name variants rather than assume one. Logs the raw shape once in
 * dev so it's easy to tighten this up against the real response.
 */
export function normalizeDirectoryChildren(raw: unknown): DirectoryChildrenPage {
  const list = extractEntryList(raw);

  if (list.length === 0 && raw && typeof raw === "object" && process.env.NODE_ENV !== "production") {
    console.warn("get-objects: unrecognized response shape", raw);
  }

  return { entries: list.map(parseDirectoryChildEntry), nextCursor: extractNextCursor(raw) };
}

/**
 * Unlike `get-objects`, `get-file-versions`' shape is confirmed from the
 * Storage.DomainService source (`FileVersionsResponse`/`FileVersionDto`), so this just
 * guards against a missing `items` array rather than trying several shapes.
 */
export function normalizeFileVersions(raw: { items?: FileVersion[]; nextCursor?: string; hasMore?: boolean }): FileVersionsPage {
  return { items: raw.items ?? [], nextCursor: raw.nextCursor, hasMore: raw.hasMore ?? false };
}

/**
 * `create-directory` also has no declared response schema — pull
 * the new directory's id out of whichever field it actually comes back as.
 */
export function extractCreatedDirectoryId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.itemId ?? row.id ?? row.directoryId ?? row.ItemId ?? row.Id ?? row.DirectoryId;
  if (typeof id === "string" && id.length > 0) return id;
  if (process.env.NODE_ENV !== "production") {
    console.warn("create-directory: couldn't find an id in the response", raw);
  }
  return null;
}
