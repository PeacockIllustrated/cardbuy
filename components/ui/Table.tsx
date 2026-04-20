import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function Table({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="border-[3px] border-ink rounded-md overflow-x-auto bg-paper-strong shadow-[3px_3px_0_0_var(--color-ink)]">
      <table
        {...rest}
        className={`w-full border-collapse text-[13px] font-sans tabular-nums ${className}`.trim()}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-ink text-paper-strong">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode }) {
  return (
    <tr {...rest} className={`border-b-2 border-ink/15 last:border-0 hover:bg-yellow/15 ${className}`.trim()}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  className = "",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th
      {...rest}
      className={`text-left px-3 py-2.5 font-display text-[11px] tracking-wider ${className}`.trim()}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className = "",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td {...rest} className={`px-3 py-2.5 align-top ${className}`.trim()}>
      {children}
    </td>
  );
}
