"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  accessApi,
  normalizeAccessPolicies,
  normalizeSharedContent,
  normalizeTrash,
  type ContentPermission,
  type ContentPrincipalType,
  type ContentResourceType,
} from "./access";
import { directoryApi, filesApi, normalizeDirectoryChildren, normalizeFileVersions, type DirectoryChild } from "./files";
import { rolesApi } from "./roles";
import { usersApi } from "./users";

export function useDirectoryChildren(directoryId: string, search: string, enabled = true) {
  return useQuery({
    queryKey: ["directory", directoryId, search],
    queryFn: () => directoryApi.getChildren(directoryId, { search }).then(normalizeDirectoryChildren),
    enabled,
    placeholderData: (prev) => prev,
  });
}

/** Newest-first version history for one file. */
export function useFileVersions(fileId: string) {
  return useQuery({
    queryKey: ["file-versions", fileId],
    queryFn: () => filesApi.getVersions(fileId).then(normalizeFileVersions),
    enabled: Boolean(fileId),
  });
}

export function useSharedContent(type?: ContentResourceType, enabled = true) {
  return useQuery({
    queryKey: ["shared-content", type ?? "all"],
    queryFn: () => accessApi.getSharedContent({ type }).then(normalizeSharedContent),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useUploadFile(directoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, metadata }: { file: File; metadata?: Record<string, string> }) =>
      filesApi.upload(file, directoryId, metadata),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory", directoryId] }),
  });
}

export function useCreateDirectory(directoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => directoryApi.createDirectory(name, directoryId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory", directoryId] }),
  });
}

// A "delete" from the drive is always a soft delete — archives into Trash rather than
// erasing outright. `/files/delete-file` and `/directory/delete-directory` both accept
// `permanent`, so false is passed explicitly rather than relying on
// its own default. Permanent removal only happens from the Trash view (useDeleteFromTrash).
export function useDeleteEntry(directoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entry: DirectoryChild) =>
      entry.isFolder ? directoryApi.deleteDirectory(entry.id, false) : filesApi.deleteFile(entry.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory", directoryId] }),
  });
}

/** Moves a file or folder into another directory — invalidates both the folder it left and the one it landed in. */
export function useMoveEntry(directoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entry, targetDirectoryId }: { entry: DirectoryChild; targetDirectoryId: string }) =>
      entry.isFolder
        ? directoryApi.moveDirectory(entry.id, targetDirectoryId)
        : filesApi.moveFile(entry.id, targetDirectoryId),
    onSuccess: (_result, { targetDirectoryId }) => {
      qc.invalidateQueries({ queryKey: ["directory", directoryId] });
      qc.invalidateQueries({ queryKey: ["directory", targetDirectoryId] });
    },
  });
}

/** Renames a file or folder in place — doesn't move it, so only the current directory's listing needs to refresh. */
export function useRenameEntry(directoryId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entry, name }: { entry: DirectoryChild; name: string }) =>
      entry.isFolder ? directoryApi.renameDirectory(entry.id, name) : filesApi.renameFile(entry.id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["directory", directoryId] }),
  });
}

/** Copies a file into another directory — only the destination folder's listing changes. Directories can't be copied (no CopyDirectory endpoint). */
export function useCopyFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, targetDirectoryId }: { fileId: string; targetDirectoryId: string }) =>
      filesApi.copyFile(fileId, targetDirectoryId),
    onSuccess: (_result, { targetDirectoryId }) => qc.invalidateQueries({ queryKey: ["directory", targetDirectoryId] }),
  });
}

export function useAccessPolicies(resourceId: string) {
  return useQuery({
    queryKey: ["access", resourceId],
    queryFn: () => accessApi.list(resourceId).then(normalizeAccessPolicies),
    enabled: Boolean(resourceId),
  });
}

export function useRoles() {
  return useQuery({ queryKey: ["roles"], queryFn: () => rolesApi.list(), staleTime: 60_000 });
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => usersApi.list(), staleTime: 60_000 });
}

export function useShareEntry(resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      resourceType: "Directory" | "File";
      principalType: ContentPrincipalType;
      principalId: string;
      permission: ContentPermission;
    }) => accessApi.share({ resourceId, ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access", resourceId] }),
  });
}

export function useUpdateAccess(resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      policyItemId: string;
      resourceType: "Directory" | "File";
      principalType: ContentPrincipalType;
      principalId: string;
      permission: ContentPermission;
    }) => accessApi.update({ resourceId, ...params }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access", resourceId] }),
  });
}

export function useRevokeAccess(resourceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (policyItemId: string) => accessApi.revoke(resourceId, policyItemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["access", resourceId] }),
  });
}

export function useTrash(type?: ContentResourceType) {
  return useQuery({
    queryKey: ["trash", type ?? "all"],
    queryFn: () => accessApi.getTrash({ type }).then(normalizeTrash),
    placeholderData: (prev) => prev,
  });
}

/** Puts an archived item back where it came from — also refreshes whichever directory listings are open, since we don't know the original parent without a lookup. */
export function useRestoreFromTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: string) => accessApi.restoreFromTrash(resourceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trash"] });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "directory" });
    },
  });
}

/** Permanently erases an archived item. Irreversible — confirm with the user before calling. */
export function useDeleteFromTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (resourceId: string) => accessApi.deleteFromTrash(resourceId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trash"] }),
  });
}
