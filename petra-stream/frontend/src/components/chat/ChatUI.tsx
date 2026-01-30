import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
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
  heightClass?: string;
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

const SCROLL_BOTTOM_THRESHOLD = 24;

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
  heightClass,
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
  const [replyTo, setReplyTo] = useState<{ user: string; text?: string; id?: string } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showModeration, setShowModeration] = useState(false);
  const initialScrollRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(0);

  const typingList = useMemo(
    () => typingUsers.filter((u) => u && u !== currentUser),
    [typingUsers, currentUser]
  );

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
  const openHeightClass = heightClass ?? "h-full";

  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    const el = listRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior });
    });
  };

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handleScroll = () => {
      const scrollHeight = el.scrollHeight || 0;
      const atBottom = el.scrollTop + el.clientHeight >= scrollHeight - SCROLL_BOTTOM_THRESHOLD;
      setIsAtBottom(atBottom);
      if (atBottom) {
        setHasUnread(false);
        setUnreadCount(0);
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    const previous = prevCountRef.current;
    const added = Math.max(0, messages.length - previous);
    prevCountRef.current = messages.length;

    if (!initialScrollRef.current) {
      scrollToBottom("auto");
      initialScrollRef.current = true;
      setHasUnread(false);
      setUnreadCount(0);
      return;
    }

    if (!open) {
      if (added > 0) {
        setHasUnread(true);
        setUnreadCount((count) => count + added);
      }
      return;
    }

    if (isAtBottom) {
      scrollToBottom("smooth");
      setHasUnread(false);
      setUnreadCount(0);
    } else if (added > 0) {
      setHasUnread(true);
      setUnreadCount((count) => count + added);
    }
  }, [messages.length, open, isAtBottom]);

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
    initialScrollRef.current = false;
    prevCountRef.current = 0;
    setHasUnread(false);
    setUnreadCount(0);
    setIsAtBottom(true);
  }, [streamId]);

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
    setUnreadCount(0);
  };

  return (
    <section
      className={clsx(
        "relative flex flex-col min-h-0 overflow-hidden rounded-3xl border border-white/10 bg-surface/80",
        open ? openHeightClass : "h-14"
      )}
      aria-label="Chat panel"
    >
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
          <span className="text-sm font-semibold text-text">{header}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px]">
            {participants.length}
          </span>
          {showModerationPanel ? (
            <button
              type="button"
              onClick={() => setShowModeration(true)}
              className="rounded-full border border-white/10 px-2 py-1 text-[10px]"
            >
              Mod
            </button>
          ) : null}
          <button
            onClick={() => setOpen((s) => !s)}
            aria-expanded={open}
            className="rounded-full border border-white/10 px-2 py-1 text-[10px]"
            title={open ? "Collapse chat" : "Open chat"}
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </header>

      {(pinnedNotice || slowModeMs > 0 || (!isAtBottom && hasUnread)) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-2 text-[11px] text-white/60">
          <div className="flex flex-wrap items-center gap-3">
            {pinnedNotice ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
                {pinnedNotice}
              </span>
            ) : null}
            {slowModeMs > 0 ? (
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em]">
                Slow mode: {(slowModeMs / 1000).toFixed(0)}s
              </span>
            ) : null}
            {!isAtBottom && hasUnread ? (
              <span>
                Chat paused - {unreadCount > 0 ? `${unreadCount} new` : "scroll down"} to resume.
              </span>
            ) : null}
          </div>
        </div>
      )}

      <div className={clsx("flex flex-1 min-h-0 flex-col", open ? "block" : "hidden sm:block")}>
        <div className="relative flex-1 min-h-0">
          <div
            ref={listRef}
            className="h-full overflow-y-auto px-4 py-4 space-y-3"
            data-stream={streamId}
          >
            {messages.length === 0 ? (
              <div className="text-center text-sm text-white/40 py-12">
                No messages yet. Start the conversation.
              </div>
            ) : (
              messages.map((msg) => {
                if (!msg) return null;
                const isMention = currentUser && msg.text?.toLowerCase().includes(`@${currentUser}`.toLowerCase());
                const isReplyToMe = msg.replyToUser && msg.replyToUser === currentUser;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    mine={msg.user === currentUser}
                    emotes={emotes}
                    showTimestamp={showTimestamps}
                    isModerator={isModerator}
                    highlight={Boolean(isMention || isReplyToMe)}
                    onDelete={() => onModerateMessage?.("delete", msg.id)}
                    onTimeout={() => onModerateMessage?.("timeout", msg.id)}
                    onReply={() => {
                      if (msg.system || msg.deleted) return;
                      setReplyTo({ user: msg.user, text: msg.text, id: msg.id });
                      inputRef.current?.focus();
                    }}
                  />
                );
              })
            )}
          </div>

          {hasUnread && (
            <button
              onClick={jumpToLatest}
              className="absolute right-4 bottom-4 px-3 py-2 rounded-full text-xs border border-white/10 bg-black/60 backdrop-blur"
            >
              {unreadCount > 0 ? `New messages (${unreadCount})` : "Jump to latest"}
            </button>
          )}
        </div>

        <div className="border-t border-white/10 bg-black/40 backdrop-blur px-4 py-3">
          {replyTo ? (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
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

          <div className="mt-2 flex items-center justify-between text-[11px] text-white/50">
            {typingList.length ? <span>{typingList.join(", ")} typing...</span> : <span />}
            <span>{canChat ? "Enter to send" : "Chat disabled"}</span>
          </div>

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
    </section>
  );
}
