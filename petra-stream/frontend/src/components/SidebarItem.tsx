// src/components/SidebarItem.tsx
import React from "react";
import clsx from "clsx";

export default function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
  compact = false,
}: {
  icon?: React.ReactNode;
  label: string;
  count?: number | string;
  active?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md transition",
        active ? "bg-surface/80 border border-white/6" : "hover:bg-surface/70",
        compact ? "justify-center" : "justify-start"
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon ? <div className="w-6 h-6 flex items-center justify-center">{icon}</div> : null}
      {!compact && (
        <>
          <div className="flex-1 text-sm font-medium text-text">{label}</div>
          {typeof count !== "undefined" && <div className="text-xs subtle">{count}</div>}
        </>
      )}
    </button>
  );
}
