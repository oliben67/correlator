import type { ButtonHTMLAttributes } from "react";

// cor-CORE.UI-000003 (RM-000022): variants matching cttc's own
// `.btn`/`.primary`/`.btn-danger` convention (style.css:987-1006,
// :1815-1820) -- every button in this app today is unstyled (plain UA
// default), so this is the app's first real button component, not a
// migration of existing per-button styles.

export type ButtonVariant = "default" | "primary" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_STYLE: Record<ButtonVariant, { background: string; color: string; border: string }> =
  {
    default: {
      background: "var(--surface-2)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-strong)",
    },
    primary: { background: "var(--accent)", color: "#fff", border: "1px solid var(--accent)" },
    danger: { background: "var(--critical)", color: "#fff", border: "1px solid var(--critical)" },
  };

export function Button({ variant = "default", style, disabled, ...rest }: ButtonProps) {
  const variantStyle = VARIANT_STYLE[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        ...variantStyle,
        borderRadius: "var(--radius-sm)",
        padding: "4px 11px",
        fontWeight: variant === "default" ? "normal" : 500,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      {...rest}
    />
  );
}
