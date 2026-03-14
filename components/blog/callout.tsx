import { AlertCircle, Lightbulb, Info } from "lucide-react";

const icons = {
  tip: Lightbulb,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  tip: { border: "rgba(22,163,74,0.3)", bg: "rgba(22,163,74,0.06)", icon: "#16a34a" },
  warning: { border: "rgba(249,115,22,0.3)", bg: "rgba(249,115,22,0.06)", icon: "#f97316" },
  info: { border: "rgba(126,34,206,0.3)", bg: "rgba(126,34,206,0.06)", icon: "#7e22ce" },
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
        borderRadius: "8px",
        padding: "16px 20px",
        margin: "24px 0",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
      }}
    >
      <Icon size={20} style={{ color: c.icon, flexShrink: 0, marginTop: "2px" }} />
      <div style={{ fontSize: "15px", lineHeight: 1.65, color: "#374151" }}>
        {children}
      </div>
    </div>
  );
}
