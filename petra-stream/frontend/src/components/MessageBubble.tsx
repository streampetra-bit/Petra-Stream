// src/components/MessageBubble.tsx
import React from "react";
import clsx from "clsx";

import { ChatBadge, ChatEmoteMap, ChatMessage } from "./chat/types";

const badgeStyles: Record<ChatBadge, { label: string; className: string }> = {
  moderator: { label: "MOD", className: "bg-emerald-400/15 text-emerald-200 border-emerald-400/30" },
  subscriber: { label: "SUB", className: "bg-primary/15 text-primary border-primary/30" },
  partner: { label: "PARTNER", className: "bg-indigo-400/15 text-indigo-200 border-indigo-400/30" },
  vip: { label: "VIP", className: "bg-amber-400/15 text-amber-200 border-amber-400/30" },
  owner: { label: "HOST", className: "bg-pink-400/15 text-pink-200 border-pink-400/30" },
};

function hashColor(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 70%)`;
}

function renderEmotes(text: string, emotes?: ChatEmoteMap) {
  if (!emotes) return text;
  return text.split(/(\s+)/).map((token, index) => {
    if (!token.trim()) return token;
    const normalized = token.replace(/^:+|:+$/g, "");
    const direct = emotes[token];
    const wrapped = emotes[normalized];
    const url = direct || (token.startsWith(":") && token.endsWith(":") ? wrapped : undefined);
    if (!url) return token;
    return (
      <img
        key={`${token}-${index}`}
        src={url}
        alt={normalized}
        className="inline-block h-5 w-5 align-text-bottom"
      />
    );
  });
}

export default function MessageBubble({
  msg,
  mine,
  onDelete,
  onTimeout,
  isModerator = false,
  onReply,
  showTimestamp = false,
  emotes,
  highlight = false,
}: {
  msg: ChatMessage;
  mine?: boolean;
  onDelete?: () => void;
  onTimeout?: () => void;
  isModerator?: boolean;
  onReply?: () => void;
  showTimestamp?: boolean;
  emotes?: ChatEmoteMap;
  highlight?: boolean;
}) {
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const nameColor = msg.color || hashColor(msg.user || "user");
  const initials = (msg.user || "?").slice(0, 2).toUpperCase();
  const content = msg.deleted ? "[message removed]" : msg.text;

  if (msg.system) {
    return (
      <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-[11px] text-amber-200/80">
        {msg.text}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "group flex items-start gap-3 rounded-2xl border px-3 py-2 transition",
        highlight ? "border-primary/30 bg-primary/10" : "border-transparent hover:border-white/10",
        mine ? "bg-white/5" : "bg-black/20"
      )}
    >
      <div
        className="h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold uppercase border border-white/10"
        style={{ background: "rgba(255,255,255,0.06)", color: nameColor }}
      >
        {initials}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold" style={{ color: nameColor }}>
            {msg.user}
          </span>
          {(msg.badges || []).map((badge) => (
            <span
              key={`${msg.id}-${badge}`}
              className={clsx(
                "px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-widest",
                badgeStyles[badge]?.className
              )}
            >
              {badgeStyles[badge]?.label ?? badge}
            </span>
          ))}
          {showTimestamp ? <span className="text-[10px] text-white/40">{time}</span> : null}
        </div>

        <div
          className={clsx(
            "mt-1 text-sm leading-relaxed",
            msg.deleted ? "text-white/40 italic" : mine ? "text-primary/90" : "text-text"
          )}
        >
          {msg.replyToUser && !msg.deleted ? (
            <div className="mb-1 text-[10px] text-white/40">
              Replying to @{msg.replyToUser}
              {msg.replyToText ? `: "${msg.replyToText.slice(0, 60)}"` : ""}
            </div>
          ) : null}
          {msg.deleted ? content : renderEmotes(content, emotes)}
        </div>

        {(isModerator || onReply) && !msg.deleted ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/40 opacity-0 transition group-hover:opacity-100">
            {onReply ? (
              <button className="px-2 py-1 rounded-md border border-white/10 hover:text-text" onClick={onReply}>
                Reply
              </button>
            ) : null}
            {isModerator ? (
              <>
                <button className="px-2 py-1 rounded-md border border-white/10 hover:text-text" onClick={onDelete}>
                  Delete
                </button>
                <button className="px-2 py-1 rounded-md border border-white/10 hover:text-text" onClick={onTimeout}>
                  Timeout
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
