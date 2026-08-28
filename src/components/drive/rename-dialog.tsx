"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DirectoryChild } from "@/lib/blocks/files";

export function RenameDialog({
  entry,
  renaming,
  onClose,
  onRename,
}: {
  entry: DirectoryChild;
  renaming: boolean;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(entry.name);
  const inputRef = useRef<HTMLInputElement>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed && trimmed !== entry.name) onRename(trimmed);
    else onClose();
  }

  // Pre-select just the basename (not the extension) on mount, matching Finder/Explorer —
  // a quick rename shouldn't clobber the extension by default.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (entry.isFolder) {
      input.select();
      return;
    }
    const dot = entry.name.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : entry.name.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-4 text-lg font-semibold text-ink">Rename {entry.isFolder ? "folder" : "file"}</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          required
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={renaming || !name.trim()}>
            {renaming ? "Renaming…" : "Rename"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
