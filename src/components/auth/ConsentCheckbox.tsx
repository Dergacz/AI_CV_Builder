import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignUpFormCopy } from "@/lib/i18n/messages";

interface ConsentCheckboxProps {
  id: string;
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  copy: SignUpFormCopy["consent"];
}

/**
 * Required consent checkbox whose label embeds inline links to /terms and /privacy.
 * FormField renders a text input, so consent needs its own checkbox-shaped sibling
 * that mirrors FormField's error treatment (red alert row).
 */
export function ConsentCheckbox({ id, name, checked, onChange, error, copy }: ConsentCheckboxProps) {
  return (
    <div>
      <div className="flex items-start gap-2">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
          className={cn(
            "mt-0.5 size-4 shrink-0 rounded border text-emerald-700 focus:ring-2 focus:ring-emerald-100",
            error ? "border-red-400" : "border-slate-300",
          )}
        />
        <label htmlFor={id} className="text-sm leading-5 text-slate-600">
          {copy.prefix}
          <a href="/terms" className="font-medium text-emerald-700 hover:underline">
            {copy.termsLabel}
          </a>
          {copy.conjunction}
          <a href="/privacy" className="font-medium text-emerald-700 hover:underline">
            {copy.privacyLabel}
          </a>
          {copy.suffix}
        </label>
      </div>
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
