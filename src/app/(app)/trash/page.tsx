"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { FilePreviewDialog } from "@/components/drive/file-preview-dialog";
import { FileVersionsDialog } from "@/components/drive/file-versions-dialog";
import { FileGrid } from "@/components/drive/file-grid";
import { Spinner } from "@/components/ui/spinner";
import { filesApi, type DirectoryChild } from "@/lib/blocks/files";
import { useDeleteFromTrash, useRestoreFromTrash, useTrash } from "@/lib/blocks/drive-hooks";

/**
 * Archived files and folders — GET /objects/get-trash. Flat, not browsable (opening a
 * trashed folder to see its own trashed children isn't something the API models here),
 * so onOpenFolder is a no-op. Restore puts an item back in its original parent
 * (`restore-from-trash`); Delete forever calls `delete-from-trash`, which is irreversible —
 * confirmed with the user before firing.
 */
export default function TrashPage() {
  const { data: page, isPending, isError } = useTrash();
  const restore = useRestoreFromTrash();
  const purge = useDeleteFromTrash();
  const [previewTarget, setPreviewTarget] = useState<DirectoryChild | null>(null);
  const [versionsTarget, setVersionsTarget] = useState<DirectoryChild | null>(null);

  const entries = page?.entries ?? [];
  const folders = entries.filter((e) => e.isFolder);
  const files = entries.filter((e) => !e.isFolder);

  async function downloadEntry(entry: DirectoryChild) {
    const file = await filesApi.get(entry.id);
    if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
  }

  function purgeEntry(entry: DirectoryChild) {
    const kind = entry.isFolder ? "folder" : "file";
    if (window.confirm(`Permanently delete this ${kind}, "${entry.name}"? This can't be undone.`)) {
      purge.mutate(entry.id);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Trash2 size={18} className="text-steel" /> Trash
        </h1>
        <p className="text-sm text-steel">Items here stay until you restore or permanently delete them.</p>
      </div>

      {isPending ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center py-24 text-sm text-brand-error">
          Couldn&apos;t load trash. Try refreshing.
        </div>
      ) : entries.length > 0 ? (
        <div className="flex flex-col">
          {folders.length > 0 && (
            <section>
              <h2 className="px-6 pt-4 text-xs font-medium uppercase tracking-wide text-muted">Folders</h2>
              <FileGrid
                entries={folders}
                onOpenFolder={() => {}}
                onDownload={downloadEntry}
                onRestore={(e) => restore.mutate(e.id)}
                onPurge={purgeEntry}
              />
            </section>
          )}
          {files.length > 0 && (
            <section>
              <h2 className="px-6 pt-4 text-xs font-medium uppercase tracking-wide text-muted">Files</h2>
              <FileGrid
                entries={files}
                onOpenFolder={() => {}}
                onDownload={downloadEntry}
                onPreview={setPreviewTarget}
                onVersions={setVersionsTarget}
                onRestore={(e) => restore.mutate(e.id)}
                onPurge={purgeEntry}
              />
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center text-steel">
          <p className="text-sm">Trash is empty.</p>
        </div>
      )}

      {previewTarget && (
        <FilePreviewDialog key={previewTarget.id} entry={previewTarget} onClose={() => setPreviewTarget(null)} />
      )}

      {versionsTarget && (
        <FileVersionsDialog key={versionsTarget.id} entry={versionsTarget} onClose={() => setVersionsTarget(null)} />
      )}
    </div>
  );
}
