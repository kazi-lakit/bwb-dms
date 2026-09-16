"use client";

import { useRef, useState } from "react";
import { FilePlus2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ChipGroup } from "@/components/ui/chip-group";
import { Button } from "@/components/ui/button";
import { EntryIcon } from "./file-icon";
import type { ObjectAccessLevel } from "@/lib/blocks/files";

const OBJECT_ACCESS_LEVEL_OPTIONS: { value: ObjectAccessLevel; label: string }[] = [
  { value: "Creator", label: "Creator" },
  { value: "Organization", label: "Organization" },
];

const OBJECT_ACCESS_LEVEL_HELP: Record<ObjectAccessLevel, string> = {
  Creator: "Only you can access this until you share it.",
  Organization: "Anyone in your organization can access this by default.",
};

const ACCESS_MODIFIER_OPTIONS: { value: "Public" | "Private"; label: string }[] = [
  { value: "Private", label: "Private" },
  { value: "Public", label: "Public" },
];

const ACCESS_MODIFIER_HELP: Record<"Public" | "Private", string> = {
  Private: "Signed, time-limited links only.",
  Public: "CDN-style links, reachable by anyone with the link.",
};

export function UploadOptionsDialog({
  initialFiles = [],
  onConfirm,
  onClose,
  uploading,
}: {
  /** Pre-populated when the dialog was opened by dropping files on the page; empty when opened from the Upload button. */
  initialFiles?: File[];
  onConfirm: (files: File[], options: { objectAccessLevel: ObjectAccessLevel; accessModifier: "Public" | "Private" }) => void;
  onClose: () => void;
  uploading: boolean;
}) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [objectAccessLevel, setObjectAccessLevel] = useState<ObjectAccessLevel>("Organization");
  const [accessModifier, setAccessModifier] = useState<"Public" | "Private">("Private");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(picked: File[]) {
    setFiles((prev) => [...prev, ...picked]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Modal onClose={onClose} className="max-w-md">
      <h2 className="mb-4 text-lg font-semibold text-ink">Upload files</h2>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-hairline py-4 text-sm text-steel hover:border-stone hover:bg-surface hover:text-ink"
      >
        <FilePlus2 size={16} /> Choose files
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="mt-3 flex max-h-32 flex-col gap-1.5 overflow-y-auto">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm text-steel">
              <EntryIcon isFolder={false} name={file.name} className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="shrink-0 rounded-sm p-0.5 text-muted hover:bg-surface hover:text-ink"
                aria-label={`Remove ${file.name}`}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">General access</label>
          <ChipGroup value={objectAccessLevel} onChange={setObjectAccessLevel} options={OBJECT_ACCESS_LEVEL_OPTIONS} />
          <p className="text-xs text-muted">{OBJECT_ACCESS_LEVEL_HELP[objectAccessLevel]}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Storage access</label>
          <ChipGroup value={accessModifier} onChange={setAccessModifier} options={ACCESS_MODIFIER_OPTIONS} />
          <p className="text-xs text-muted">{ACCESS_MODIFIER_HELP[accessModifier]}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={uploading || files.length === 0}
          onClick={() => onConfirm(files, { objectAccessLevel, accessModifier })}
        >
          {uploading ? "Uploading…" : `Upload${files.length ? ` ${files.length}` : ""}`}
        </Button>
      </div>
    </Modal>
  );
}
