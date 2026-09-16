"use client";

import { useState } from "react";
import { FolderPlus, Upload as UploadIcon } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/drive/breadcrumbs";
import { FilePreviewDialog } from "@/components/drive/file-preview-dialog";
import { FileVersionsDialog } from "@/components/drive/file-versions-dialog";
import { FileGrid } from "@/components/drive/file-grid";
import { NewFolderDialog } from "@/components/drive/new-folder-dialog";
import { ShareDialog } from "@/components/drive/share-dialog";
import { UploadDropzone } from "@/components/drive/upload-dropzone";
import { UploadOptionsDialog } from "@/components/drive/upload-options-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { fileIntrinsicMetadata, filesApi, unreadableFileMessage, type DirectoryChild } from "@/lib/blocks/files";
import { useCreateDirectory, useDirectoryChildren, useUploadFile } from "@/lib/blocks/drive-hooks";
import { toast } from "@/lib/toast-store";

// Fixed root directory that backs the "System files" nav item — same storage the
// rest of the app browses, just always rooted at this directory instead of the
// signed-in user's own drive. New folders/uploads land under whichever folder is
// currently open (defaulting to this root), same as the drive view.
const SYSTEM_FILES_ROOT_ID = "4fe7e3fb-f492-4bbd-bb97-cf754c388136";

export default function SystemFilesPage() {
  const [trail, setTrail] = useState<Crumb[]>([]);
  const [previewTarget, setPreviewTarget] = useState<DirectoryChild | null>(null);
  const [versionsTarget, setVersionsTarget] = useState<DirectoryChild | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [shareTarget, setShareTarget] = useState<DirectoryChild | null>(null);
  // null hides the upload dialog; a (possibly empty) array shows it — empty when opened
  // from the Upload button (file picking happens inside the dialog), pre-populated when
  // opened by dropping files on the page.
  const [uploadDialogFiles, setUploadDialogFiles] = useState<File[] | null>(null);
  const currentFolderId = trail.at(-1)?.id ?? SYSTEM_FILES_ROOT_ID;

  const { data: page, isPending, isError } = useDirectoryChildren(currentFolderId, "");
  const entries = page?.entries ?? [];
  const folders = entries.filter((e) => e.isFolder);
  const files = entries.filter((e) => !e.isFolder);
  const createDirectory = useCreateDirectory(currentFolderId);
  const upload = useUploadFile(currentFolderId);

  function openFolder(entry: DirectoryChild) {
    setTrail((prev) => [...prev, { id: entry.id, name: entry.name }]);
  }

  function navigateTo(index: number) {
    setTrail((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  }

  async function downloadEntry(entry: DirectoryChild) {
    const file = await filesApi.get(entry.id);
    if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
    else toast.error(unreadableFileMessage(file) ?? "Couldn't download this file.");
  }

  function uploadFiles(files: File[]) {
    if (files.length) setUploadDialogFiles(files);
  }

  function confirmUpload(
    files: File[],
    options: { objectAccessLevel: "Creator" | "Organization"; accessModifier: "Public" | "Private" }
  ) {
    files.forEach((file) => upload.mutate({ file, metadata: fileIntrinsicMetadata(file), ...options }));
    setUploadDialogFiles(null);
  }

  return (
    <UploadDropzone onFiles={uploadFiles}>
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs trail={trail} onNavigate={navigateTo} rootLabel="System files" />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowNewFolder(true)}>
              <FolderPlus size={15} /> New folder
            </Button>
            <Button size="sm" onClick={() => setUploadDialogFiles([])} disabled={upload.isPending}>
              <UploadIcon size={15} /> {upload.isPending ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>

        {isPending ? (
          <div className="flex flex-1 items-center justify-center py-24">
            <Spinner className="h-6 w-6" />
          </div>
        ) : isError ? (
          <div className="flex flex-1 items-center justify-center py-24 text-sm text-brand-error">
            Couldn&apos;t load system files. Try refreshing.
          </div>
        ) : entries.length > 0 ? (
          <div className="flex flex-col">
            {folders.length > 0 && (
              <section>
                <h2 className="px-6 pt-4 text-xs font-medium uppercase tracking-wide text-muted">Folders</h2>
                <FileGrid entries={folders} onOpenFolder={openFolder} onDownload={downloadEntry} onShare={setShareTarget} />
              </section>
            )}
            {files.length > 0 && (
              <section>
                <h2 className="px-6 pt-4 text-xs font-medium uppercase tracking-wide text-muted">Files</h2>
                <FileGrid
                  entries={files}
                  onOpenFolder={openFolder}
                  onDownload={downloadEntry}
                  onPreview={setPreviewTarget}
                  onVersions={setVersionsTarget}
                  onShare={setShareTarget}
                />
              </section>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center text-steel">
            <p className="text-sm">This folder is empty.</p>
            <p className="text-xs text-muted">Drag files here, or use Upload above.</p>
          </div>
        )}

        {previewTarget && (
          <FilePreviewDialog key={previewTarget.id} entry={previewTarget} onClose={() => setPreviewTarget(null)} />
        )}

        {versionsTarget && (
          <FileVersionsDialog key={versionsTarget.id} entry={versionsTarget} onClose={() => setVersionsTarget(null)} />
        )}

        {showNewFolder && (
          <NewFolderDialog
            creating={createDirectory.isPending}
            onClose={() => setShowNewFolder(false)}
            onCreate={(name, objectAccessLevel) =>
              createDirectory.mutate(
                { name, objectAccessLevel },
                { onSuccess: () => setShowNewFolder(false) }
              )
            }
          />
        )}

        {uploadDialogFiles && (
          <UploadOptionsDialog
            initialFiles={uploadDialogFiles}
            uploading={upload.isPending}
            onClose={() => setUploadDialogFiles(null)}
            onConfirm={confirmUpload}
          />
        )}

        {shareTarget && <ShareDialog entry={shareTarget} onClose={() => setShareTarget(null)} />}
      </div>
    </UploadDropzone>
  );
}
