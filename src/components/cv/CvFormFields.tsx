import { cn } from "@/lib/utils";

const baseInputClass =
  "w-full rounded-md border bg-white px-3 py-2 text-slate-950 placeholder-slate-400 transition-colors focus:ring-2 focus:outline-none";

/** Shared border styling: red on error, emerald focus otherwise. Reused by every CV input. */
export function inputBorderClass(error?: string): string {
  return error
    ? "border-red-400 focus:ring-red-200"
    : "border-slate-300 focus:border-emerald-700 focus:ring-emerald-100";
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

/** Labelled single-line text input (label above). Shared by the questionnaire and section editors. */
export function TextField({ id, label, value, onChange, placeholder, error }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className={cn("mt-2", baseInputClass, inputBorderClass(error))}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface TextAreaProps extends FieldProps {
  rows?: number;
}

/** Labelled multi-line text input (label above). Shared by the questionnaire and section editors. */
export function TextAreaField({ id, label, value, onChange, placeholder, error, rows = 6 }: TextAreaProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        rows={rows}
        className={cn("mt-2 resize-y", baseInputClass, inputBorderClass(error))}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface InlineTextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  error?: boolean;
}

/** Unlabelled compact input for array items (highlights, skill items). Caller supplies the row + remove control. */
export function InlineTextInput({ value, onChange, placeholder, ariaLabel, error }: InlineTextInputProps) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      placeholder={placeholder}
      className={cn(baseInputClass, inputBorderClass(error ? "error" : undefined))}
    />
  );
}
