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

export function PasswordGenerator({ onUse }: { onUse: (password: string) => void }) {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const noneSelected = CLASSES.every((c) => !options[c.name]);

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-3">
        <label htmlFor="pw-length" className="w-24 text-sm">
          Length: {options.length}
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
          <label key={c.name} className="flex items-center gap-2 text-sm">
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
      <Button size="sm" variant="secondary" disabled={noneSelected} onClick={() => onUse(generatePassword(options))}>
        Generate
      </Button>
    </div>
  );
}
