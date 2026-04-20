import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

type Variant = "primary" | "secondary" | "accent-teal" | "accent-yellow" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-pink text-ink border-[3px] border-ink shadow-[4px_4px_0_0_var(--color-ink)] hover:shadow-[6px_6px_0_0_var(--color-ink)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  secondary:
    "bg-paper-strong text-ink border-[3px] border-ink shadow-[4px_4px_0_0_var(--color-ink)] hover:shadow-[6px_6px_0_0_var(--color-ink)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  "accent-teal":
    "bg-teal text-ink border-[3px] border-ink shadow-[4px_4px_0_0_var(--color-ink)] hover:shadow-[6px_6px_0_0_var(--color-ink)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  "accent-yellow":
    "bg-yellow text-ink border-[3px] border-ink shadow-[4px_4px_0_0_var(--color-ink)] hover:shadow-[6px_6px_0_0_var(--color-ink)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
  ghost:
    "bg-transparent text-ink border-2 border-ink hover:bg-ink hover:text-paper-strong",
  danger:
    "bg-paper-strong text-warn border-[3px] border-warn shadow-[4px_4px_0_0_var(--color-warn)] hover:shadow-[6px_6px_0_0_var(--color-warn)] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
};

const SIZE: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12px]",
  md: "px-4 py-2 text-[13px]",
  lg: "px-6 py-3 text-[15px]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-display tracking-wider rounded-md transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-[2px_2px_0_0_var(--color-ink)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 ${VARIANT[variant]} ${SIZE[size]} ${className}`.trim()}
    />
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;
export function Input({ className = "", ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={`font-sans text-[14px] bg-paper-strong text-ink border-[3px] border-ink rounded-md px-3 py-2 placeholder:text-muted focus:outline-none focus:shadow-[3px_3px_0_0_var(--color-ink)] transition-shadow duration-100 ${className}`.trim()}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode };
export function Select({ className = "", children, ...rest }: SelectProps) {
  return (
    <select
      {...rest}
      className={`font-sans text-[14px] bg-paper-strong text-ink border-[3px] border-ink rounded-md px-3 py-2 focus:outline-none focus:shadow-[3px_3px_0_0_var(--color-ink)] transition-shadow duration-100 ${className}`.trim()}
    >
      {children}
    </select>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className = "", ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      className={`font-sans text-[14px] bg-paper-strong text-ink border-[3px] border-ink rounded-md px-3 py-2 placeholder:text-muted focus:outline-none focus:shadow-[3px_3px_0_0_var(--color-ink)] transition-shadow duration-100 ${className}`.trim()}
    />
  );
}

type FieldProps = {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
};
export function Field({ label, htmlFor, hint, children, className = "" }: FieldProps) {
  return (
    <label htmlFor={htmlFor} className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <span className="font-display text-[11px] tracking-wider text-ink">{label}</span>
      {children}
      {hint ? <span className="text-[12px] text-muted leading-snug">{hint}</span> : null}
    </label>
  );
}
