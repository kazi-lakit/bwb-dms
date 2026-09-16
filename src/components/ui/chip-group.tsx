"use client";

import clsx from "clsx";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

/** A row of pill-shaped, single-select toggle buttons — used in place of a <select> where the choice set is small and worth showing all at once. */
export function ChipGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ChipOption<T>[];
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-on-primary"
                : "border-hairline bg-canvas text-steel hover:bg-surface hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
