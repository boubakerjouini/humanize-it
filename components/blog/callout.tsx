import { AlertCircle, Lightbulb, Info } from "lucide-react";
import { THEME } from "@/lib/theme";

const icons = {
  tip: Lightbulb,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  tip: { border: THEME.human, bg: THEME.humanDim, icon: THEME.human },
  warning: { border: THEME.warn, bg: THEME.warnDim, icon: THEME.warn },
  info: { border: THEME.brand, bg: THEME.brandDim, icon: THEME.brandHi },
};

export function Callout({
  type = "info",
  children,
}: {
  type?: "tip" | "warning" | "info";
  children: React.ReactNode;
}) {
  const Icon = icons[type];
  const c = colors[type];
  return (
    <div
      style={{
        border: `1px solid ${c.border}`,
        background: c.bg,
        borderRadius: THEME.radius,
        padding: "16px 20px",
        margin: "24px 0",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      }}
    >
      <Icon size={20} aria-hidden="true" style={{ color: c.icon, flexShrink: 0, marginTop: "2px" }} />
      <div style={{ fontSize: "15px", lineHeight: 1.65, color: THEME.text }}>
        {children}
      </div>
    </div>
  );
}
