"use client";

import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ChipGroup } from "@/components/ui/chip-group";
import { Button } from "@/components/ui/button";
import type { ObjectAccessLevel } from "@/lib/blocks/files";

const OBJECT_ACCESS_LEVEL_OPTIONS: { value: ObjectAccessLevel; label: string }[] = [
  { value: "Creator", label: "Creator" },
  { value: "Organization", label: "Organization" },
];

const OBJECT_ACCESS_LEVEL_HELP: Record<ObjectAccessLevel, string> = {
  Creator: "Only you can access this until you share it.",
  Organization: "Anyone in your organization can access this by default.",
};

export function NewFolderDialog({
  onCreate,
  onClose,
  creating,
}: {
  onCreate: (name: string, objectAccessLevel: ObjectAccessLevel) => void;
  onClose: () => void;
  creating: boolean;
}) {
  const [name, setName] = useState("");
  const [objectAccessLevel, setObjectAccessLevel] = useState<ObjectAccessLevel>("Organization");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim(), objectAccessLevel);
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="mb-4 text-lg font-semibold text-ink">New folder</h2>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input placeholder="Folder name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">General access</label>
          <ChipGroup value={objectAccessLevel} onChange={setObjectAccessLevel} options={OBJECT_ACCESS_LEVEL_OPTIONS} />
          <p className="text-xs text-muted">{OBJECT_ACCESS_LEVEL_HELP[objectAccessLevel]}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
