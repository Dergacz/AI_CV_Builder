import { Eye, EyeOff } from "lucide-react";

interface PasswordToggleProps {
  visible: boolean;
  onToggle: () => void;
}

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  );
}
