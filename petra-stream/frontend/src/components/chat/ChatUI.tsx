import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useVirtualizer } from "@tanstack/react-virtual";
import EmojiPicker from "../EmojiPicker";
import MessageBubble from "../MessageBubble";
import { ChatEmoteMap, ChatMessage, ChatModerationAction } from "./types";

export type ChatSendPayload = {
  text: string;
  replyTo?: { id?: string; user?: string; text?: string };
};

export type ChatVariant = "creator" | "viewer" | "monitor";

export interface ChatUIProps {
  streamId: string;
  messages: ChatMessage[];
  currentUser?: string;
  participants?: string[];
  typingUsers?: string[];
  inputId?: string;
  emotes?: ChatEmoteMap;
  showTimestamps?: boolean;
  slowModeMs?: number;
  pinnedNotice?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  variant?: ChatVariant;
  isConnected?: boolean;
  canChat?: boolean;
  isModerator?: boolean;
  showModerationPanel?: boolean;
  collapsedOnDesktop?: boolean;
  onSendMessage?: (payload: ChatSendPayload) => Promise<void> | void;
  onModerateMessage?: (action: ChatModerationAction, id: string) => void;
  onClearChat?: () => void;
  onTyping?: (value: string) => void;
}

const ESTIMATED_ROW = 56;
const SCROLL_BOTTOM_THRESHOLD = 28;

export default function ChatUI({
  streamId,
  messages,
  currentUser = "You",
  participants = [],
  typingUsers = [],
  inputId,
  emotes,
  showTimestamps = false,
  slowModeMs = 0,
  pinnedNotice,
  headerTitle,
  headerSubtitle,
  variant = "viewer",
  isConnected = true,
  canChat = true,
  isModerator = false,
  showModerationPanel = false,
  collapsedOnDesktop = false,
  onSendMessage,
  onModerateMessage,
  onClearChat,
  onTyping,
}: ChatUIProps) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(!collapsedOnDesktop);
  const [showEmoji, setShowEmoji] = useState(false);
  const [suggestionMode, setSuggestionMode] = useState<"mention" | "emote" | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<{ user: string; text?: string; id?: string } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showModeration, setShowModeration] = useState(false);
  const initialScrollRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const typingList = useMemo(
    () => typingUsers.filter((u) => u && u !== currentUser),
    [typingUsers, currentUser]
  );

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ESTIMATED_ROW,
    overscan: 8,
  });

  const totalSize = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();

  const cooldownRemaining = cooldownUntil ? Math.max(0, cooldownUntil - Date.now()) : 0;
  const inputEnabled = Boolean(onSendMessage) && isConnected && canChat;
  const canSend = inputEnabled && cooldownRemaining <= 0;

  const statusLabel = isConnected ? "Connected" : "Offline";
  const header = headerTitle
    || (variant === "creator"
      ? "Creator chat"
      : variant === "monitor"
        ? "Moderation chat"
        : "Live chat");
  const subtitle = headerSubtitle
    || (variant === "creator"
      ? "Broadcast lounge"
      : variant === "monitor"
        ? "Community pulse"
        : "Join the conversation");
  const variantTag = variant === "creator" ? "Studio" : variant === "monitor" ? "Monitor" : "Viewer";
  const shellTone =
    variant === "creator"
      ? "from-primary/20 via-transparent to-emerald-400/10"
      : variant === "monitor"
        ? "from-amber-400/15 via-transparent to-rose-400/10"
        : "from-white/5 via-transparent to-white/5";

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = listRef.current;
    if (!el) return;
    const top = rowVirtualizer.getTotalSize();
    window.requestAnimationFrame(() => {
      el.scrollTo({ top, behavior });
    });
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= totalSize - SCROLL_BOTTOM_THRESHOLD;
      setIsAtBottom(atBottom);
      if (atBottom) setHasUnread(false);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [totalSize]);

  useEffect(() => {
    if (!messages.length) return;
    if (!initialScrollRef.current) {
      scrollToBottom("auto");
      initialScrollRef.current = true;
      return;
    }
    if (isAtBottom) {
      scrollToBottom("smooth");
    } else {
      setHasUnread(true);
    }
  }, [messages.length, isAtBottom]);

  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= cooldownUntil) setCooldownUntil(null);
    }, 200);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!onTyping) return;
    if (!value.trim()) return;
    onTyping(value);
  }, [value, onTyping]);

  useEffect(() => {
    const match = value.match(/(^|\s)([@:])([^\s]*)$/);
    if (!match) {
      setSuggestions([]);
      setSuggestionMode(null);
      return;
    }
    const symbol = match[2];
    const query = match[3] || "";
    if (symbol === "@") {
      const list = participants.filter((p) => p.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
      setSuggestions(list);
      setSuggestionMode(list.length ? "mention" : null);
      return;
    }
    if (symbol === ":" && emotes) {
      const emoteKeys = Object.keys(emotes);
      const list = emoteKeys.filter((e) => e.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
      setSuggestions(list);
      setSuggestionMode(list.length ? "emote" : null);
      return;
    }
    setSuggestions([]);
    setSuggestionMode(null);
  }, [value, participants, emotes]);

  const insertSuggestion = (name: string) => {
    const match = value.match(/(^|\s)([@:])([^\s]*)$/);
    if (!match || match.index === undefined) {
      setValue((prev) => `${prev}${name} `);
      setSuggestions([]);
      setSuggestionMode(null);
      return;
    }
    const symbol = match[2];
    const prefix = match[1] || "";
    const start = match.index + prefix.length;
    const before = value.slice(0, start);
    const after = value.slice(start + 1 + match[3].length);
    const token = symbol === "@" ? `@${name}` : `:${name}:`;
    const next = `${before}${token} ${after}`.replace(/\s{2,}/g, " ");
    setValue(next);
    setSuggestions([]);
    setSuggestionMode(null);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    const text = value.trim();
    if (!text || !onSendMessage) return;
    if (!canSend) return;
    try {
      await onSendMessage({
        text,
        replyTo: replyTo ? { id: replyTo.id, user: replyTo.user, text: replyTo.text } : undefined,
      });
    } catch {
      // ignore send errors; surface via transport layer if needed
    }
    setValue("");
    setReplyTo(null);
    setShowEmoji(false);
    if (slowModeMs > 0) {
      setCooldownUntil(Date.now() + slowModeMs);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  const jumpToLatest = () => {
    scrollToBottom("smooth");
    setHasUnread(false);
  };

  return (
    <div
      className={clsx(
        `relative flex flex-col rounded-3xl border border-white/10 bg-gradient-to-br ${shellTone}`,
        open ? "h-full" : "h-14"
      )}
      aria-label="Chat panel"
    >
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-white/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen((s) => !s)}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 bg-white/5 border border-white/10 text-xs uppercase tracking-[0.2em]"
            title={open ? "Collapse chat" : "Open chat"}
          >
            <span className="text-primary">Chat</span>
            <span className="text-white/50">{open ? "Hide" : "Open"}</span>
          </button>
          <div>
            <div className="text-sm font-semibold text-text">{header}</div>
            <div className="text-[11px] text-white/40">{subtitle}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span className="px-2 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest text-white/60">
            {variantTag}
          </span>
          <span>{participants.length} here</span>
          <span className={clsx("px-2 py-1 rounded-full border text-[10px] uppercase tracking-widest", isConnected ? "border-emerald-400/40 text-emerald-200" : "border-amber-400/40 text-amber-200")}>
            {statusLabel}
          </span>
          {showModerationPanel ? (
            <button
              type="button"
              className="px-2 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest"
              onClick={() => setShowModeration(true)}
            >
              Moderation
            </button>
          ) : null}
        </div>
      </div>

      {(pinnedNotice || slowModeMs > 0 || (!isAtBottom && hasUnread)) && (
        <div className="px-4 py-2 border-b border-white/10 bg-white/5 text-xs text-white/60 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {pinnedNotice ? <span>{pinnedNotice}</span> : null}
            {slowModeMs > 0 ? (
              <span className="px-2 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest">
                Slow mode: {(slowModeMs / 1000).toFixed(0)}s
              </span>
            ) : null}
            {!isAtBottom && hasUnread ? <span>Chat paused - scroll down to resume.</span> : null}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className={clsx("relative flex-1 overflow-hidden", open ? "block" : "hidden sm:block")}>
            <div ref={listRef} className="h-full overflow-y-auto px-4 py-4" data-stream={streamId}>
              {messages.length === 0 ? (
                <div className="text-center text-sm text-white/40 py-12">
                  No messages yet. Start the conversation.
                </div>
              ) : (
                <div style={{ height: totalSize, position: "relative" }}>
                  {virtualItems.map((virtualRow) => {
                    const msg = messages[virtualRow.index];
                    if (!msg) return null;
                    const isNew = !seenIdsRef.current.has(msg.id);
                    if (isNew) seenIdsRef.current.add(msg.id);
                    return (
                      <div
                        key={msg.id}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        className={clsx("absolute left-0 w-full pr-2", isNew ? "chat-in" : null)}
                        style={{ transform: `translateY(${virtualRow.start}px)`, top: 0 }}
                      >
                        <MessageBubble
                          msg={msg}
                          mine={msg.user === currentUser}
                          emotes={emotes}
                          showTimestamp={showTimestamps}
                          shade={virtualRow.index % 2 === 0}
                          isModerator={isModerator}
                          onDelete={() => onModerateMessage?.("delete", msg.id)}
                          onTimeout={() => onModerateMessage?.("timeout", msg.id)}
                          onReply={() => {
                            if (msg.system || msg.deleted) return;
                            setReplyTo({ user: msg.user, text: msg.text, id: msg.id });
                            inputRef.current?.focus();
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {hasUnread && (
              <button
                onClick={jumpToLatest}
                className="absolute right-5 bottom-5 px-3 py-2 rounded-full text-xs border border-white/10 bg-black/40 backdrop-blur"
              >
                Jump to latest
              </button>
            )}
          </div>

          <div className="border-t border-white/10 bg-black/40 backdrop-blur px-4 py-3">
            {replyTo ? (
              <div className="mb-2 flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs">
                <div className="text-text">
                  Replying to <span className="font-semibold">@{replyTo.user}</span>
                  {replyTo.text ? `: "${replyTo.text.slice(0, 80)}"` : ""}
                </div>
                <button
                  className="text-white/60 hover:text-text"
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                className="rounded-md px-2 py-1 border border-white/10 text-xs"
                onClick={() => setShowEmoji((s) => !s)}
                aria-label="Open emoji picker"
                title="Emoji"
              >
                Emoji
              </button>

              <div className="flex-1 relative">
                <input
                  id={inputId}
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={inputEnabled ? "Send a message..." : "Chat disabled"}
                  className="w-full rounded-lg p-2 bg-bg/10 text-text outline-none border border-white/6"
                  disabled={!inputEnabled}
                />

                {suggestionMode && suggestions.length > 0 && (
                  <div className="absolute left-0 bottom-[calc(100%+8px)] w-full bg-surface rounded-lg shadow-md z-40 border border-white/6 overflow-hidden">
                    {suggestions.map((sug) => (
                      <button
                        key={`${suggestionMode}-${sug}`}
                        onClick={() => insertSuggestion(sug)}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 text-text text-sm flex items-center gap-2"
                      >
                        {suggestionMode === "emote" && emotes?.[sug] ? (
                          <img src={emotes[sug]} alt={sug} className="h-5 w-5" />
                        ) : null}
                        <span>{suggestionMode === "mention" ? `@${sug}` : `:${sug}:`}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => void handleSend()}
                className="btn-primary px-3 py-2 rounded-md text-sm"
                aria-label="Send message"
                disabled={!canSend}
              >
                {cooldownRemaining > 0 ? `Wait ${Math.ceil(cooldownRemaining / 1000)}s` : "Send"}
              </button>
            </div>

            {typingList.length ? (
              <div className="mt-2 text-[11px] text-white/50">
                {typingList.join(", ")} typing...
              </div>
            ) : null}

            {showEmoji && (
              <div className="mt-2 z-50">
                <EmojiPicker
                  onPick={(emoji) => {
                    setValue((v) => v + emoji);
                    setShowEmoji(false);
                    inputRef.current?.focus();
                  }}
                />
              </div>
            )}
          </div>
        </div>

      </div>

      {showModeration && showModerationPanel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close moderation panel"
            onClick={() => setShowModeration(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-surface/90 p-5 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-text">Moderation</div>
                <div className="text-[11px] text-white/40">Quick actions for live chat.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowModeration(false)}
                className="px-2 py-1 rounded-full border border-white/10 text-[10px] uppercase tracking-widest"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <button
                className="w-full px-3 py-2 rounded-lg border border-white/10 text-xs text-left"
                onClick={onClearChat}
              >
                Clear chat
              </button>
              <button
                className="w-full px-3 py-2 rounded-lg border border-white/10 text-xs text-left"
                onClick={() => onModerateMessage?.("timeout", "bulk")}
              >
                Timeout last user
              </button>
              <button
                className="w-full px-3 py-2 rounded-lg border border-white/10 text-xs text-left"
                onClick={() => onModerateMessage?.("ban", "bulk")}
              >
                Ban last user
              </button>
              <div className="text-[11px] text-white/50">
                Use inline actions on messages for precision.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
