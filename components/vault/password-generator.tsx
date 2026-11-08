"use client";

import { useState } from "react";
import {
  DEFAULT_PASSWORD_OPTIONS,
  generatePassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  type CharsetName,
  type PasswordOptions,
} from "@/lib/crypto/password";
import { Button } from "@/components/ui/primitives";

const CLASSES: { name: CharsetName; label: string }[] = [
  { name: "uppercase", label: "Uppercase" },
  { name: "lowercase", label: "Lowercase" },
  { name: "numbers", label: "Numbers" },
  { name: "symbols", label: "Symbols" },
];

export function PasswordGenerator({ onUse }: Readonly<{ onUse: (password: string) => void }>) {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [preview, setPreview] = useState("");
  const noneSelected = CLASSES.every((c) => !options[c.name]);

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <label htmlFor="pw-length" className="text-sm">
          Length <span className="inline-block w-6 font-mono tabular-nums">{options.length}</span>
        </label>
        <input
          id="pw-length"
          type="range"
          min={MIN_PASSWORD_LENGTH}
          max={64}
          value={options.length}
          onChange={(e) =>
            setOptions({ ...options, length: Math.min(MAX_PASSWORD_LENGTH, Number(e.target.value)) })
          }
          className="flex-1 accent-violet-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CLASSES.map((c) => (
          <label key={c.name} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-violet-600"
              checked={options[c.name]}
              onChange={(e) => setOptions({ ...options, [c.name]: e.target.checked })}
            />
            {c.label}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={noneSelected}
          onClick={() => {
            const pw = generatePassword(options);
            setPreview(pw);
            onUse(pw);
          }}
        >
          {preview ? "Generate another" : "Generate"}
        </Button>
        {preview && (
          <code key={preview} className="enter min-w-0 flex-1 truncate font-mono text-[13px] text-l-cipher">
            {preview}
          </code>
        )}
      </div>
    </div>
  );
}
