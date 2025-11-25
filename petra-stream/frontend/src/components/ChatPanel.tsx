// src/components/ChatPanel.tsx
import React, { useEffect, useRef, useState } from "react";
import socket from "../lib/socket";
import { useToast } from "../contexts/ToastContext";
import EmojiPicker from "./EmojiPicker";
import MessageBubble from "./MessageBubble";
import clsx from "clsx";

/**
 * Chat message shape used locally
 */
export type ChatMsg = {
  id: string;
  user: string;
  text: string;
  ts: number;
  system?: boolean;
  deleted?: boolean;
};

export interface ChatPanelProps {
  streamId: string;
  messages?: ChatMsg[]; // initial / seed messages
  inputId?: string;
  currentUser?: string; // if not provided we'll use "You"
  isModerator?: boolean; // enables mod actions UI
  collapsedOnDesktop?: boolean; // start collapsed on desktop
}

const TYPING_TIMEOUT = 3500;

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatPanel({
  streamId,
  messages = [],
  inputId,
  currentUser = "You",
  isModerator = false,
  collapsedOnDesktop = false,
}: ChatPanelProps) {
  const [msgs, setMsgs] = useState<ChatMsg[]>(messages);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(!collapsedOnDesktop);
  const [participants, setParticipants] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();
  const typingTimer = useRef<number | null>(null);

  // sync incoming socket messages
  useEffect(() => {
    setMsgs(messages || []);
  }, [messages]);

  useEffect(() => {
    // handler for incoming messages
    const onMsg = (payload: any) => {
      if (!payload) return;
      if (payload.streamId !== streamId) return;
      const incoming: ChatMsg = {
        id: payload.id ?? genId(),
        user: payload.user ?? "Anon",
        text: payload.text ?? "",
        ts: payload.ts ?? Date.now(),
        system: !!payload.system,
      };
      setMsgs((s) => [...s, incoming]);
    };

    const onTyping = (payload: any) => {
      if (!payload || payload.streamId !== streamId) return;
      const user = payload.user;
      setTypingUsers((prev) => ({ ...prev, [user]: Date.now() }));
      // clear after timeout
      window.setTimeout(() => {
        setTypingUsers((prev) => {
          const t = { ...prev };
          if (Date.now() - (t[user] || 0) > TYPING_TIMEOUT - 200) {
            delete t[user];
          }
          return t;
        });
      }, TYPING_TIMEOUT + 200);
    };

    const onParticipants = (payload: any) => {
      if (!payload || payload.streamId !== streamId) return;
      setParticipants(payload.participants || []);
    };

    const onDeleted = (payload: any) => {
      // moderation delete - update message by id
      if (!payload || payload.streamId !== streamId) return;
      setMsgs((s) => s.map((m) => (m.id === payload.id ? { ...m, deleted: true, text: "[message removed]" } : m)));
      toast.info("Message removed by moderator", undefined, 2500);
    };

    try {
      socket.on("chat:message", onMsg);
      socket.on("chat:typing", onTyping);
      socket.on("chat:participants", onParticipants);
      socket.on("chat:moderation:deleted", onDeleted);
    } catch (err) {
      console.warn("Socket listen failed", err);
    }

    return () => {
      try {
        socket.off("chat:message", onMsg);
        socket.off("chat:typing", onTyping);
        socket.off("chat:participants", onParticipants);
        socket.off("chat:moderation:deleted", onDeleted);
      } catch (err) {}
    };
  }, [streamId, toast]);

  // auto-scroll on new messages (simple)
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    sc.scrollTop = sc.scrollHeight + 200;
  }, [msgs.length]);

  // typing emit (debounced)
  useEffect(() => {
    if (!socket || !socket.connected) return;
    if (!value) return;
    try {
      socket.emit("chat:typing", { streamId, user: currentUser });
    } catch {}
    // cleanup handled in server echo or other clients
  }, [value, streamId, currentUser]);

  // suggestion handling: when user types '@' show participants suggestions
  useEffect(() => {
    const idx = value.lastIndexOf("@");
    if (idx >= 0) {
      const after = value.slice(idx + 1);
      // at least 1 char to filter
      if (after.length >= 1) {
        const set = participants.filter((p) => p.toLowerCase().includes(after.toLowerCase())).slice(0, 6);
        setSuggestions(set);
        setShowSuggestions(set.length > 0);
      } else {
        setSuggestions(participants.slice(0, 6));
        setShowSuggestions(true);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [value, participants]);

  // send message (optimistic)
  const send = async () => {
    const text = value.trim();
    if (!text) return;
    const id = genId();
    const newMsg: ChatMsg = { id, user: currentUser, text, ts: Date.now() };
    setMsgs((s) => [...s, newMsg]); // optimistic
    setValue("");
    setShowEmoji(false);
    // emit
    try {
      if (socket && socket.connected) {
        socket.emit("chat:message", { streamId, id, user: currentUser, text, ts: newMsg.ts });
      } else {
        toast.info("You are offline — message queued locally", undefined, 3000);
      }
    } catch (err) {
      console.error("send failed", err);
      toast.error("Failed to send message", undefined, 3000);
    }
  };

  // moderation actions
  const moderate = async (action: "delete" | "timeout", msgId: string) => {
    if (!isModerator) return;
    try {
      socket.emit("chat:moderate", { streamId, action, id: msgId });
      toast.success("Moderator action sent", undefined, 2000);
      if (action === "delete") {
        setMsgs((s) => s.map((m) => (m.id === msgId ? { ...m, deleted: true, text: "[removed by moderator]" } : m)));
      }
    } catch (err) {
      console.error("moderate failed", err);
      toast.error("Moderator action failed", undefined, 2500);
    }
  };

  // UI helpers
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  const insertSuggestion = (name: string) => {
    // replace last @fragment with the selection
    const idx = value.lastIndexOf("@");
    if (idx >= 0) {
      const head = value.slice(0, idx + 1);
      const tail = value.slice(idx + 1);
      // find end of mention token (whitespace or end)
      const match = tail.match(/^[^\s]*/);
      const endIdx = match ? match[0].length : 0;
      const remaining = tail.slice(endIdx);
      const next = `${head}${name} ${remaining}`; // add a space after mention
      setValue(next);
      setShowSuggestions(false);
      inputRef.current?.focus();
    } else {
      setValue((v) => v + `@${name} `);
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
  };

  // toggle open (mobile: bottom sheet; desktop: collapse to bar)
  const toggleOpen = () => setOpen((s) => !s);

  const typingList = Object.keys(typingUsers).filter((u) => u !== currentUser);

  return (
    <div
      className={clsx(
        "relative flex flex-col",
        // keep small height on mobile by default, expand when open
        open ? "h-full" : "h-14"
      )}
      aria-label="Chat panel"
    >
      {/* Header: collapse toggle */}
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleOpen}
            aria-expanded={open}
            className="inline-flex items-center gap-2 rounded-md p-2 bg-surface border"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
            title={open ? "Collapse chat" : "Open chat"}
          >
            <svg className="h-5 w-5 text-text" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-6 4V5a2 2 0 012-2h16a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-medium text-text">Chat</span>
            <span className="text-xs subtle">• {msgs.length}</span>
          </button>

          <div className="text-xs subtle hidden sm:inline">Live • {participants.length} here</div>
        </div>

        <div className="flex items-center gap-2">
          {typingList.length ? <div className="text-xs subtle pr-2">{typingList.join(", ")} typing…</div> : null}
          <button
            onClick={() => {
              // focus input
              inputRef.current?.focus();
            }}
            className="px-2 py-1 rounded-md border"
            title="Focus chat (c)"
          >
            Focus
          </button>
        </div>
      </div>

      {/* body */}
      <div className={clsx("flex-1 overflow-hidden transition-all", open ? "block" : "hidden sm:block")}>
        <div ref={scrollerRef} className="px-3 pb-3 overflow-y-auto space-y-3" style={{ maxHeight: "min(60vh, 60vh)" }}>
          {/* message grouping render: group contiguous messages by same user within 5 minutes */}
          {msgs.length ? (
            (() => {
              const groups: Array<{ user: string; items: ChatMsg[] }> = [];
              msgs.forEach((m) => {
                const last = groups[groups.length - 1];
                if (!last) {
                  groups.push({ user: m.user, items: [m] });
                } else {
                  const prev = last.items[last.items.length - 1];
                  // group if same user and within 5 minutes
                  if (m.user === last.user && Math.abs(m.ts - prev.ts) < 1000 * 60 * 5) {
                    last.items.push(m);
                  } else {
                    groups.push({ user: m.user, items: [m] });
                  }
                }
              });
              return groups.map((g, i) => (
                <div key={i} className="space-y-2">
                  <div className="text-xs font-semibold text-text">{g.user}</div>
                  <div className="space-y-1">
                    {g.items.map((m) => (
                      <div key={m.id}>
                        <MessageBubble
                          msg={m}
                          mine={m.user === currentUser}
                          onDelete={() => moderate("delete", m.id)}
                          onTimeout={() => moderate("timeout", m.id)}
                          isModerator={isModerator}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          ) : (
            <div className="text-center text-subtle text-sm py-6">No messages yet — be the first to say hi 👋</div>
          )}
        </div>

        {/* input area */}
        <div className="p-3 border-t border-white/6 bg-surface sticky bottom-0">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md p-2"
              onClick={() => setShowEmoji((s) => !s)}
              aria-label="Open emoji picker"
              title="Emoji"
            >
              😀
            </button>

            <div className="flex-1 relative">
              <input
                id={inputId}
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Say something… (Enter to send, Shift+Enter newline)"
                className="w-full rounded-lg p-2 bg-bg/10 text-text outline-none border border-white/6"
              />

              {/* suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 mt-1 w-full bg-surface rounded shadow-md z-40 border border-white/6">
                  {suggestions.map((sug) => (
                    <button
                      key={sug}
                      onClick={() => insertSuggestion(sug)}
                      className="w-full text-left px-3 py-2 hover:bg-surface/80 text-text text-sm"
                    >
                      @{sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={send} className="btn-primary px-3 py-2 rounded-md" aria-label="Send message">
              Send
            </button>
          </div>

          {/* emoji picker */}
          {showEmoji && (
            <div className="mt-2 z-50">
              <EmojiPicker
                onPick={(emoji) => {
                  // insert at cursor position (simple append)
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
  );
}
