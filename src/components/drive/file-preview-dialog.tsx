"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EntryIcon } from "./file-icon";
import { filesApi, type DirectoryChild, type FileRecord } from "@/lib/blocks/files";
import { formatBytes, formatDate } from "@/lib/format";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "ogv"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "m4a", "ogg"]);

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function FilePreviewDialog({ entry, onClose }: { entry: DirectoryChild; onClose: () => void }) {
  const [file, setFile] = useState<FileRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Assumes one FilePreviewDialog instance per file — callers key it by entry.id
  // (or unmount/remount on close) so a new file never reuses stale file/failed state.
  useEffect(() => {
    let cancelled = false;
    filesApi
      .get(entry.id)
      .then((result) => {
        if (cancelled) return;
        if (result.url) setFile(result);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id]);

  const url = file?.url;
  const metadata = Object.entries(file?.metaData ?? {});
  const ext = extOf(entry.name);
  const isImage = IMAGE_EXTS.has(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const isAudio = AUDIO_EXTS.has(ext);
  const isPdf = ext === "pdf";
  const loading = !file && !failed;

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink" title={entry.name}>
            {entry.name}
          </h2>
          <p className="text-xs text-muted">
            {formatBytes(entry.sizeInBytes)} · {formatDate(entry.createdDate)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-sm p-1 text-muted hover:bg-surface hover:text-ink"
          aria-label="Close preview"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-md border border-hairline bg-surface">
        {loading ? (
          <Spinner className="h-6 w-6" />
        ) : failed || !url ? (
          <div className="flex flex-col items-center gap-2 py-16 text-steel">
            <EntryIcon isFolder={false} name={entry.name} className="h-10 w-10" />
            <p className="text-sm">Couldn&apos;t load a preview.</p>
          </div>
        ) : isImage ? (
          <img src={url} alt={entry.name} className="max-h-[70vh] w-auto object-contain" />
        ) : isPdf ? (
          <iframe src={url} title={entry.name} className="h-[70vh] w-full" />
        ) : isVideo ? (
          <video src={url} controls className="max-h-[70vh] w-full">
            <track kind="captions" />
          </video>
        ) : isAudio ? (
          <audio src={url} controls className="w-full px-6" />
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-steel">
            <EntryIcon isFolder={false} name={entry.name} className="h-10 w-10" />
            <p className="text-sm">No preview available for this file type.</p>
          </div>
        )}
      </div>

      <button
        onClick={() => setShowDetails((prev) => !prev)}
        disabled={!file}
        className="mt-4 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted hover:text-ink disabled:opacity-50"
      >
        Details
        {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showDetails && file && (
        <dl className="mt-2 flex flex-col gap-1.5 border-t border-hairline pt-3">
          <div className="flex items-baseline gap-2 text-sm">
            <dt className="w-24 shrink-0 text-muted">Type</dt>
            <dd className="truncate text-ink">{file.typeString ?? (entry.isFolder ? "Folder" : extOf(entry.name).toUpperCase() || "File")}</dd>
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            <dt className="w-24 shrink-0 text-muted">Size</dt>
            <dd className="truncate text-ink">{formatBytes(entry.sizeInBytes)}</dd>
          </div>
          <div className="flex items-baseline gap-2 text-sm">
            <dt className="w-24 shrink-0 text-muted">Created</dt>
            <dd className="truncate text-ink">{formatDate(entry.createdDate)}</dd>
          </div>
          {file.createdBy && (
            <div className="flex items-baseline gap-2 text-sm">
              <dt className="w-24 shrink-0 text-muted">Created by</dt>
              <dd className="truncate text-ink">{file.createdBy}</dd>
            </div>
          )}
          {file.accessModifier && (
            <div className="flex items-baseline gap-2 text-sm">
              <dt className="w-24 shrink-0 text-muted">Access</dt>
              <dd className="truncate text-ink">{file.accessModifier}</dd>
            </div>
          )}
          {file.tags && file.tags.length > 0 && (
            <div className="flex items-baseline gap-2 text-sm">
              <dt className="w-24 shrink-0 text-muted">Tags</dt>
              <dd className="truncate text-ink">{file.tags.join(", ")}</dd>
            </div>
          )}
          {file.itemId && (
            <div className="flex items-baseline gap-2 text-sm">
              <dt className="w-24 shrink-0 text-muted">Item ID</dt>
              <dd className="truncate text-ink" title={file.itemId}>
                {file.itemId}
              </dd>
            </div>
          )}
        </dl>
      )}

      {showDetails && metadata.length > 0 && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Metadata</p>
          <dl className="flex flex-col gap-1.5">
            {metadata.map(([key, metaEntry]) => (
              <div key={key} className="flex items-baseline gap-2 text-sm">
                <dt className="w-24 shrink-0 truncate text-muted" title={key}>
                  {key}
                </dt>
                <dd className="truncate text-ink" title={metaEntry.value}>
                  {metaEntry.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => url && window.open(url, "_blank", "noopener,noreferrer")} disabled={!url}>
          <Download size={15} /> Download
        </Button>
      </div>
    </Modal>
  );
}
