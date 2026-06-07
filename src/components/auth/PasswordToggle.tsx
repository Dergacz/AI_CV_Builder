import { Eye, EyeOff } from "lucide-react";

interface PasswordToggleProps {
  hiddenLabel: string;
  visibleLabel: string;
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ hiddenLabel, visibleLabel, visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
      aria-label={visible ? visibleLabel : hiddenLabel}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
