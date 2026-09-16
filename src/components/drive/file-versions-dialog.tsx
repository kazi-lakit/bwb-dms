"use client";

import { useState } from "react";
import { Download, History, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { filesApi, unreadableFileMessage, type DirectoryChild, type FileVersion } from "@/lib/blocks/files";
import { useFileVersions } from "@/lib/blocks/drive-hooks";
import { formatBytes, formatDate } from "@/lib/format";
import { toast } from "@/lib/toast-store";

function VersionRow({ fileId, version, isCurrent }: { fileId: string; version: FileVersion; isCurrent: boolean }) {
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const file = await filesApi.get(fileId, "Default", isCurrent ? undefined : version.no);
      if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
      else toast.error(unreadableFileMessage(file) ?? "Couldn't download this version.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">
          Version {version.no}
          {isCurrent && <span className="ml-2 rounded-full bg-brand-green/15 px-2 py-0.5 text-xs text-brand-green-deep">Current</span>}
        </p>
        <p className="truncate text-xs text-muted">
          {formatBytes(version.sizeInBytes)} · {formatDate(version.createdDate)}
          {version.uploadedBy ? ` · ${version.uploadedBy}` : ""}
        </p>
      </div>
      <button
        onClick={download}
        disabled={downloading}
        className="shrink-0 rounded-sm p-1.5 text-muted hover:bg-hairline-soft hover:text-ink disabled:opacity-50"
        aria-label={`Download version ${version.no}`}
      >
        {downloading ? <Spinner className="h-4 w-4" /> : <Download size={15} />}
      </button>
    </div>
  );
}

export function FileVersionsDialog({ entry, onClose }: { entry: DirectoryChild; onClose: () => void }) {
  const { data, isPending, isError } = useFileVersions(entry.id);
  const versions = data?.items ?? [];
  const latestNo = versions[0]?.no;

  return (
    <Modal onClose={onClose} className="max-w-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 truncate text-lg font-semibold text-ink" title={entry.name}>
            <History size={17} className="shrink-0 text-steel" /> Version history
          </h2>
          <p className="truncate text-xs text-muted">{entry.name}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-sm p-1 text-muted hover:bg-surface hover:text-ink"
          aria-label="Close version history"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
        {isPending ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-5 w-5" />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-brand-error">Couldn&apos;t load version history.</p>
        ) : versions.length > 0 ? (
          versions.map((version) => (
            <VersionRow key={version.itemId} fileId={entry.id} version={version} isCurrent={version.no === latestNo} />
          ))
        ) : (
          <p className="py-6 text-center text-sm text-muted">No earlier versions yet.</p>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
