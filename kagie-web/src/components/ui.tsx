import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from "react";

type ButtonTone = "primary" | "secondary" | "ghost" | "danger" | "success";

export function Card({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`kg-card ${className}`.trim()}>{children}</section>;
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  actions
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="kg-section-heading">
      <div>
        {eyebrow ? <div className="kg-eyebrow">{eyebrow}</div> : null}
        <h2>{title}</h2>
        {copy ? <p>{copy}</p> : null}
      </div>
      {actions ? <div className="kg-section-actions">{actions}</div> : null}
    </div>
  );
}

export function Button({
  children,
  tone = "primary",
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  loadingLabel = "Please wait...",
  className = ""
}: {
  children: ReactNode;
  tone?: ButtonTone;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
}) {
  const actionLockedRef = useRef(false);
  const [localLoading, setLocalLoading] = useState(false);
  const isLoading = Boolean(loading || localLoading);
  const locked = Boolean(disabled || isLoading);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      if (locked || actionLockedRef.current) {
        event.preventDefault();
        return;
      }

      if (!onClick) return;

      try {
        actionLockedRef.current = true;
        const result = onClick(event);

        if (!result || typeof result.then !== "function") {
          actionLockedRef.current = false;
          return;
        }

        setLocalLoading(true);
        void result
          .catch((error) => {
            console.error("Kagie action failed:", error);
          })
          .finally(() => {
            actionLockedRef.current = false;
            setLocalLoading(false);
          });
      } catch (error) {
        actionLockedRef.current = false;
        setLocalLoading(false);
        console.error("Kagie action failed:", error);
      }
    },
    [locked, onClick]
  );

  return (
    <button
      type={type}
      disabled={locked}
      aria-busy={isLoading ? "true" : "false"}
      aria-disabled={locked ? "true" : "false"}
      onClick={handleClick}
      className={`kg-button ${tone} ${className}`.trim()}
    >
      {isLoading ? <span className="kg-button-spinner" aria-hidden="true" /> : null}
      <span>{isLoading ? loadingLabel : children}</span>
    </button>
  );
}

export function Metric({
  label,
  value,
  note
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="kg-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="kg-empty">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="kg-loading" role="status" aria-live="polite">
      <div className="kg-loading-content">
        <div className="kg-loading-logo" aria-hidden="true">
          <span className="kg-loading-wordmark"><img src="/images/logos/app-logo.jpg" alt="" /></span>
          <span className="kg-loading-brand-arrow"><img src="/images/logos/kagie-loading-arrow.svg" alt="" /></span>
        </div>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function StatusPill({ label, tone }: { label: string; tone?: string }) {
  const text = String(tone || label).toLowerCase();
  const nextTone = text.includes("closed") || text.includes("reject")
    ? "danger"
    : text.includes("soon") || text.includes("pending") || text.includes("review")
      ? "warning"
      : text.includes("verified") || text.includes("accept") || text.includes("open")
        ? "success"
        : "info";

  return <span className={`kg-status ${nextTone}`}>{label}</span>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="kg-field">
      <span>{label}</span>
      <input
        className="kg-input"
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="kg-field">
      <span>{label}</span>
      <textarea
        className="kg-input kg-textarea"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <label className="kg-field">
      <span>{label}</span>
      <select className="kg-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
