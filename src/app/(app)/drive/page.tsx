"use client";

import { useRef, useState } from "react";
import { FolderPlus, Search, Upload as UploadIcon } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/drive/breadcrumbs";
import { DestinationPickerDialog } from "@/components/drive/destination-picker-dialog";
import { FilePreviewDialog } from "@/components/drive/file-preview-dialog";
import { FileVersionsDialog } from "@/components/drive/file-versions-dialog";
import { FileGrid } from "@/components/drive/file-grid";
import { NewFolderDialog } from "@/components/drive/new-folder-dialog";
import { RenameDialog } from "@/components/drive/rename-dialog";
import { ShareDialog } from "@/components/drive/share-dialog";
import { UploadDropzone } from "@/components/drive/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { fileIntrinsicMetadata, filesApi, type DirectoryChild } from "@/lib/blocks/files";
import {
  useCopyFile,
  useCreateDirectory,
  useDeleteEntry,
  useDirectoryChildren,
  useMoveEntry,
  useRenameEntry,
  useUploadFile,
} from "@/lib/blocks/drive-hooks";
import { useDrive } from "@/components/providers/drive-provider";

export default function DrivePage() {
  const { driveId } = useDrive();
  const [trail, setTrail] = useState<Crumb[]>([]);
  const [search, setSearch] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [shareTarget, setShareTarget] = useState<DirectoryChild | null>(null);
  const [renameTarget, setRenameTarget] = useState<DirectoryChild | null>(null);
  const [previewTarget, setPreviewTarget] = useState<DirectoryChild | null>(null);
  const [versionsTarget, setVersionsTarget] = useState<DirectoryChild | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ entry: DirectoryChild; mode: "move" | "copy" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Empty trail means "at the drive root" — that's the user's own drive directory
  // (driveId), never the raw storage root. AppLayout only renders this page once
  // DriveGate confirms driveId is ready, so the fallback below is just for TS.
  const currentFolderId = trail.at(-1)?.id ?? driveId ?? "";

  const { data: page, isPending, isError } = useDirectoryChildren(currentFolderId, search);
  const entries = page?.entries;
  const upload = useUploadFile(currentFolderId);
  const createDirectory = useCreateDirectory(currentFolderId);
  const deleteEntry = useDeleteEntry(currentFolderId);
  const moveEntry = useMoveEntry(currentFolderId);
  const copyFile = useCopyFile();
  const renameEntry = useRenameEntry(currentFolderId);

  function openFolder(entry: DirectoryChild) {
    setSearch("");
    setTrail((prev) => [...prev, { id: entry.id, name: entry.name }]);
  }

  function navigateTo(index: number) {
    setSearch("");
    setTrail((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  }

  async function downloadEntry(entry: DirectoryChild) {
    const file = await filesApi.get(entry.id);
    if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
  }

  function uploadFiles(files: File[]) {
    files.forEach((file) => upload.mutate({ file, metadata: fileIntrinsicMetadata(file) }));
  }

  return (
    <UploadDropzone onFiles={uploadFiles}>
      <div className="flex flex-col gap-4 p-6 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs trail={trail} onNavigate={navigateTo} />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search this folder"
                className="h-9 w-48 rounded-md border border-hairline bg-surface pl-8 pr-3 text-sm text-ink placeholder:text-muted outline-none focus:border-brand-green sm:w-64"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowNewFolder(true)}>
              <FolderPlus size={15} /> New folder
            </Button>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
            >
              <UploadIcon size={15} /> {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(Array.from(e.target.files));
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      {isPending ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center py-24 text-sm text-brand-error">
          Couldn&apos;t load this folder. Try refreshing.
        </div>
      ) : (
        <FileGrid
          entries={entries ?? []}
          onOpenFolder={openFolder}
          onDownload={downloadEntry}
          onPreview={setPreviewTarget}
          onVersions={setVersionsTarget}
          onShare={setShareTarget}
          onRename={setRenameTarget}
          onMove={(entry) => setTransferTarget({ entry, mode: "move" })}
          onCopy={(entry) => setTransferTarget({ entry, mode: "copy" })}
          onDelete={(e) => deleteEntry.mutate(e)}
        />
      )}

      {previewTarget && (
        <FilePreviewDialog key={previewTarget.id} entry={previewTarget} onClose={() => setPreviewTarget(null)} />
      )}

      {versionsTarget && (
        <FileVersionsDialog key={versionsTarget.id} entry={versionsTarget} onClose={() => setVersionsTarget(null)} />
      )}

      {renameTarget && (
        <RenameDialog
          entry={renameTarget}
          renaming={renameEntry.isPending}
          onClose={() => setRenameTarget(null)}
          onRename={(name) =>
            renameEntry.mutate(
              { entry: renameTarget, name },
              { onSuccess: () => setRenameTarget(null) }
            )
          }
        />
      )}

      {showNewFolder && (
        <NewFolderDialog
          creating={createDirectory.isPending}
          onClose={() => setShowNewFolder(false)}
          onCreate={(name) =>
            createDirectory.mutate(name, {
              onSuccess: () => setShowNewFolder(false),
            })
          }
        />
      )}

      {shareTarget && <ShareDialog entry={shareTarget} onClose={() => setShareTarget(null)} />}

      {transferTarget && (
        <DestinationPickerDialog
          entry={transferTarget.entry}
          mode={transferTarget.mode}
          confirming={transferTarget.mode === "move" ? moveEntry.isPending : copyFile.isPending}
          onClose={() => setTransferTarget(null)}
          onConfirm={(targetDirectoryId) => {
            const { entry, mode } = transferTarget;
            const onSuccess = () => setTransferTarget(null);
            if (mode === "move") moveEntry.mutate({ entry, targetDirectoryId }, { onSuccess });
            else copyFile.mutate({ fileId: entry.id, targetDirectoryId }, { onSuccess });
          }}
        />
      )}
    </UploadDropzone>
  );
}
