// src/components/MessageBubble.tsx
import React from "react";
import clsx from "clsx";

import { ChatMsg } from "./ChatPanel";

export default function MessageBubble({
  msg,
  mine,
  onDelete,
  onTimeout,
  isModerator = false,
  onReply,
}: {
  msg: ChatMsg;
  mine?: boolean;
  onDelete?: () => void;
  onTimeout?: () => void;
  isModerator?: boolean;
  onReply?: () => void;
}) {
  const time = new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={clsx("flex items-start gap-2", mine ? "justify-end" : "justify-start")}>
      {/* avatar stub */}
      <div className={clsx("w-8 h-8 rounded-md flex items-center justify-center neon-ring", mine ? "order-2" : "order-1")}>
        <span className="text-xs font-mono">{(msg.user || "?").slice(0, 2).toUpperCase()}</span>
      </div>

      <div className={clsx("max-w-[80%]")}>
        <div className={clsx("inline-flex items-center gap-2")}>
          <div className="text-xs font-medium text-text">{msg.user}</div>
          <div className="text-[10px] subtle">{time}</div>
          {msg.system ? <div className="text-[10px] text-neutral-400 ml-2">system</div> : null}
        </div>

        <div
          className={clsx(
            "mt-1 p-2 rounded-lg",
            msg.deleted ? "bg-red-700/30 text-subtle italic" : mine ? "bg-primary/10 text-text" : "bg-bg/20 text-text"
          )}
        >
          {msg.replyToUser && !msg.deleted && (
            <div className="mb-1 text-[10px] subtle">
              Replying to @{msg.replyToUser}
              {msg.replyToText ? `: "${msg.replyToText.slice(0, 60)}"` : ""}
            </div>
          )}
          {msg.deleted ? "[message removed]" : msg.text}
        </div>

        {/* moderation row */}
        {isModerator && !msg.system && !msg.deleted && (
          <div className="mt-1 text-xs flex items-center gap-2">
            <button className="px-2 py-1 rounded-md border text-xs" onClick={onDelete}>
              Delete
            </button>
            <button className="px-2 py-1 rounded-md border text-xs" onClick={onTimeout}>
              Timeout 1m
            </button>
          </div>
        )}
        {!msg.system && !msg.deleted && onReply && (
          <div className="mt-1 text-xs">
            <button className="px-2 py-1 rounded-md border text-xs" onClick={onReply}>
              Reply
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
