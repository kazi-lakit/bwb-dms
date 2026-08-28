"use client";

import { useState } from "react";
import { Breadcrumbs, type Crumb } from "@/components/drive/breadcrumbs";
import { FilePreviewDialog } from "@/components/drive/file-preview-dialog";
import { FileVersionsDialog } from "@/components/drive/file-versions-dialog";
import { FileGrid } from "@/components/drive/file-grid";
import { Spinner } from "@/components/ui/spinner";
import { filesApi, type DirectoryChild } from "@/lib/blocks/files";
import { useDirectoryChildren, useSharedContent } from "@/lib/blocks/drive-hooks";

/**
 * Content shared with the signed-in user — GET /objects/get-shared-objects. That endpoint
 * only returns the top level; once you open a shared folder, browsing its children is
 * a normal get-objects call (access there is enforced server-side by the
 * inherited/direct share, same as any other directory) — see useDirectoryChildren.
 * No Share/Delete here: SharedContentRequest carries no permission info per item, and a
 * share may only grant View/Download, so this stays a read-only, browse-and-download view.
 */
export default function SharedPage() {
  const [trail, setTrail] = useState<Crumb[]>([]);
  const [previewTarget, setPreviewTarget] = useState<DirectoryChild | null>(null);
  const [versionsTarget, setVersionsTarget] = useState<DirectoryChild | null>(null);
  const atRoot = trail.length === 0;
  const currentFolderId = trail.at(-1)?.id ?? "";

  const sharedQuery = useSharedContent(undefined, atRoot);
  const nestedQuery = useDirectoryChildren(currentFolderId, "", !atRoot);
  const { data: page, isPending, isError } = atRoot ? sharedQuery : nestedQuery;
  const entries = page?.entries;
  const folders = entries?.filter((e) => e.isFolder) ?? [];
  const files = entries?.filter((e) => !e.isFolder) ?? [];

  function openFolder(entry: DirectoryChild) {
    setTrail((prev) => [...prev, { id: entry.id, name: entry.name }]);
  }

  function navigateTo(index: number) {
    setTrail((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  }

  async function downloadEntry(entry: DirectoryChild) {
    const file = await filesApi.get(entry.id);
    if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <Breadcrumbs trail={trail} onNavigate={navigateTo} rootLabel="Shared with me" />

      {isPending ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <Spinner className="h-6 w-6" />
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center py-24 text-sm text-brand-error">
          Couldn&apos;t load shared content. Try refreshing.
        </div>
      ) : entries && entries.length > 0 ? (
        <div className="flex flex-col">
          {folders.length > 0 && (
            <section>
              <h2 className="px-6 pt-4 text-xs font-medium uppercase tracking-wide text-muted">Folders</h2>
              <FileGrid entries={folders} onOpenFolder={openFolder} onDownload={downloadEntry} />
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
              />
            </section>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-24 text-center text-steel">
          <p className="text-sm">
            {atRoot ? "Nothing has been shared with you yet." : "This folder is empty."}
          </p>
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
