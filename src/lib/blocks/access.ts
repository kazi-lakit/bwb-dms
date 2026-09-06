import { blocksFilesFetch } from "./http";
import { extractEntryList, extractNextCursor, parseDirectoryChildEntry, type DirectoryChild } from "./files";

/**
 * Sharing / access control for a directory or file — `/objects/*` on the storage
 * service (confirmed against its swagger, alongside `/directory/*` and `/files/*`).
 * `ContentPermission`/`ContentPrincipalType`/`ContentResourceType`/`ContentEffect` are
 * clean string enums there — used verbatim below.
 */

export type ContentResourceType = "Directory" | "File";
export type ContentPrincipalType = "User" | "Role" | "Everyone" | "Organization";
/** "Owner" exists on the enum but is system-assigned — not offered in the share UI. */
export type ContentPermission = "View" | "Download" | "Edit" | "Delete" | "Manage";
export type ContentEffect = "Allow" | "Deny";

/**
 * One access entry on a resource. The exact field names aren't in the swagger (its
 * responses are undeclared, same as Directory/Files) — `normalizeAccessPolicies` below
 * tries the plausible variants; `policyItemId` is what `RevokeAccessPolicy` /
 * `UpdateAccessPolicy` need back.
 */
export interface AccessPolicy {
  policyItemId: string;
  resourceId?: string;
  resourceType?: ContentResourceType;
  principalType: ContentPrincipalType;
  principalId: string;
  /** Limits a Role policy to this organization; absent for global roles. */
  organizationId?: string;
  principalName?: string;
  permission: ContentPermission;
  effect?: ContentEffect;
  expiresAt?: string;
}

export const accessApi = {
  // POST /objects/share-object — "Grants a principal an allow entry and records it as a share."
  share: (params: {
    resourceId: string;
    resourceType: ContentResourceType;
    principalType: ContentPrincipalType;
    principalId: string;
    organizationId?: string;
    permission: ContentPermission;
    expiresAt?: string;
  }) => blocksFilesFetch<unknown>(`/objects/share-object`, { method: "POST", body: JSON.stringify(params) }),

  // POST /objects/update-access-policy — same shape as GrantAccessRequest; policyItemId identifies the entry.
  update: (params: {
    policyItemId: string;
    resourceId: string;
    resourceType: ContentResourceType;
    principalType: ContentPrincipalType;
    principalId: string;
    organizationId?: string;
    permission: ContentPermission;
    effect?: ContentEffect;
    priority?: number;
  }) =>
    blocksFilesFetch<unknown>(`/objects/update-access-policy`, {
      method: "POST",
      body: JSON.stringify({ effect: "Allow", priority: 0, ...params }),
    }),

  // POST /objects/revoke-access-policy — "Deletes an access entry."
  revoke: (resourceId: string, policyItemId: string) =>
    blocksFilesFetch<unknown>(`/objects/revoke-access-policy`, {
      method: "POST",
      body: JSON.stringify({ resourceId, policyItemId }),
    }),

  // GET /objects/get-access-policies?ResourceId=&IncludeInherited= — "The access entries on a resource."
  list: (resourceId: string, includeInherited = false) =>
    blocksFilesFetch<unknown>(
      `/objects/get-access-policies?ResourceId=${encodeURIComponent(resourceId)}&IncludeInherited=${includeInherited}`
    ),

  // GET /objects/resolve-access?resourceId= — "The operations the calling user holds on a resource."
  resolve: (resourceId: string) =>
    blocksFilesFetch<unknown>(`/objects/resolve-access?resourceId=${encodeURIComponent(resourceId)}`),

  // GET /objects/get-shared-objects?Cursor=&Limit=&Type= — content shared with the caller
  // (SharedContentRequest). `type`, when given, narrows to "Directory" or "File"; both
  // come back when omitted.
  getSharedContent: (opts: { cursor?: string; limit?: number; type?: ContentResourceType } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set("Cursor", opts.cursor);
    params.set("Limit", String(opts.limit ?? 50));
    if (opts.type) params.set("Type", opts.type);
    return blocksFilesFetch<unknown>(`/objects/get-shared-objects?${params.toString()}`);
  },

  // GET /objects/get-trash?Cursor=&Limit=&Type= — "Archived directories and files the caller may view."
  getTrash: (opts: { cursor?: string; limit?: number; type?: ContentResourceType } = {}) => {
    const params = new URLSearchParams();
    if (opts.cursor) params.set("Cursor", opts.cursor);
    params.set("Limit", String(opts.limit ?? 50));
    if (opts.type) params.set("Type", opts.type);
    return blocksFilesFetch<unknown>(`/objects/get-trash?${params.toString()}`);
  },

  // POST /objects/restore-from-trash — "Returns an archived item to its original parent."
  restoreFromTrash: (resourceId: string) =>
    blocksFilesFetch<unknown>(`/objects/restore-from-trash`, { method: "POST", body: JSON.stringify({ resourceId }) }),

  // POST /objects/delete-from-trash — "Removes an archived item for good." Irreversible.
  deleteFromTrash: (resourceId: string) =>
    blocksFilesFetch<unknown>(`/objects/delete-from-trash`, { method: "POST", body: JSON.stringify({ resourceId }) }),
};

export interface SharedContentPage {
  entries: DirectoryChild[];
  nextCursor?: string;
}

/** Same undeclared-schema situation as get-objects — reuse its row/envelope parsing. */
export function normalizeTrash(raw: unknown): SharedContentPage {
  const list = extractEntryList(raw);

  if (list.length === 0 && raw && typeof raw === "object" && process.env.NODE_ENV !== "production") {
    console.warn("get-trash: unrecognized response shape", raw);
  }

  return { entries: list.map(parseDirectoryChildEntry), nextCursor: extractNextCursor(raw) };
}

/** Same undeclared-schema situation as get-objects — reuse its row/envelope parsing. */
export function normalizeSharedContent(raw: unknown): SharedContentPage {
  const list = extractEntryList(raw);

  if (list.length === 0 && raw && typeof raw === "object" && process.env.NODE_ENV !== "production") {
    console.warn("get-shared-objects: unrecognized response shape", raw);
  }

  return { entries: list.map(parseDirectoryChildEntry), nextCursor: extractNextCursor(raw) };
}

/** Undeclared response shape (same pattern as get-objects) — normalize defensively. */
export function normalizeAccessPolicies(raw: unknown): AccessPolicy[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { data?: unknown })?.data)
      ? (raw as { data: unknown[] }).data
      : Array.isArray((raw as { items?: unknown })?.items)
        ? (raw as { items: unknown[] }).items
        : Array.isArray((raw as { policies?: unknown })?.policies)
          ? (raw as { policies: unknown[] }).policies
          : [];

  if (list.length === 0 && raw && typeof raw === "object" && process.env.NODE_ENV !== "production") {
    console.warn("get-access-policies: unrecognized response shape", raw);
  }

  return list.map((entry) => {
    const row = entry as Record<string, unknown>;
    return {
      policyItemId: (row.policyItemId ?? row.itemId ?? row.id ?? "") as string,
      resourceId: row.resourceId as string | undefined,
      resourceType: row.resourceType as ContentResourceType | undefined,
      principalType: (row.principalType ?? "User") as ContentPrincipalType,
      principalId: (row.principalId ?? "") as string,
      organizationId: row.organizationId as string | undefined,
      principalName: row.principalName as string | undefined,
      permission: (row.permission ?? "View") as ContentPermission,
      effect: row.effect as ContentEffect | undefined,
      expiresAt: row.expiresAt as string | undefined,
    };
  });
}
