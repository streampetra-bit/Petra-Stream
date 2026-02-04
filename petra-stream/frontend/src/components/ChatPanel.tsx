// src/components/ChatPanel.tsx
import React, { useEffect, useRef, useState } from "react";
import socket from "../lib/socket";
import { useToast } from "../contexts/ToastContext";
import ChatUI, { ChatSendPayload, ChatVariant } from "./chat/ChatUI";
import { ChatBadge, ChatEmoteMap, ChatMessage, ChatModerationAction } from "./chat/types";

const TYPING_TIMEOUT = 3500;
const TYPING_THROTTLE = 1200;

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeBadges(existing: ChatBadge[] = [], incoming: ChatBadge[] = []) {
  const set = new Set<ChatBadge>([...existing, ...incoming]);
  return Array.from(set);
}

export interface ChatPanelProps {
  streamId: string;
  messages?: ChatMessage[];
  inputId?: string;
  currentUser?: string;
  currentBadges?: ChatBadge[];
  emotes?: ChatEmoteMap;
  showTimestamps?: boolean;
  slowModeMs?: number;
  pinnedNotice?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  variant?: ChatVariant;
  heightClass?: string;
  canChat?: boolean;
  isConnected?: boolean;
  isModerator?: boolean;
  showModerationPanel?: boolean;
  collapsedOnDesktop?: boolean;
  autoScrollMode?: "smart" | "always";
  useSocket?: boolean;
  onSendMessage?: (payload: ChatSendPayload) => Promise<void> | void;
  onModerateMessage?: (action: ChatModerationAction, id: string) => void;
  onClearChat?: () => void;
}

export default function ChatPanel({
  streamId,
  messages,
  inputId,
  currentUser = "You",
  currentBadges = [],
  emotes,
  showTimestamps = false,
  slowModeMs = 0,
  pinnedNotice,
  headerTitle,
  headerSubtitle,
  variant = "viewer",
  heightClass,
  canChat = true,
  isConnected,
  isModerator = false,
  showModerationPanel = false,
  collapsedOnDesktop = false,
  autoScrollMode,
  useSocket = true,
  onSendMessage,
  onModerateMessage,
  onClearChat,
}: ChatPanelProps) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<ChatMessage[]>(messages ?? []);
  const [participants, setParticipants] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(socket.connected);
  const storageKey = `chat-history:${streamId}`;
  const typingSentAt = useRef(0);

  useEffect(() => {
    if (!useSocket) {
      setMsgs(messages ?? []);
    }
  }, [messages, useSocket]);

  useEffect(() => {
    if (!useSocket || !streamId) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          setMsgs(parsed);
          return;
        }
      }
    } catch {
      // ignore cache errors
    }
    setMsgs([]);
  }, [storageKey, streamId, useSocket]);

  useEffect(() => {
    if (!useSocket || !streamId) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(msgs.slice(-200)));
    } catch {
      // ignore storage errors
    }
  }, [msgs, storageKey, streamId, useSocket]);

  useEffect(() => {
    if (!useSocket || !streamId) return;
    if (!socket.connected) {
      socket.auth = { user: currentUser };
      socket.connect();
    }
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [streamId, currentUser, useSocket]);

  useEffect(() => {
    if (!useSocket || !streamId) return;
    const room = `stream:${streamId}`;
    try {
      socket.emit?.("join", { room, user: currentUser });
    } catch {
      // ignore
    }
    return () => {
      try {
        socket.emit?.("leave", { room });
      } catch {
        // ignore
      }
    };
  }, [streamId, currentUser, useSocket]);

  useEffect(() => {
    if (!useSocket || !streamId) return;

    const appendMessage = (incoming: ChatMessage) => {
      setMsgs((s) => {
        if (incoming.id && s.some((m) => m.id === incoming.id)) return s;
        const dupe = s.find(
          (m) =>
            m.user === incoming.user &&
            m.text === incoming.text &&
            Math.abs(m.ts - incoming.ts) < 2000
        );
        if (dupe) return s;
        return [...s, incoming];
      });
    };

    const onMsg = (payload: any) => {
      if (!payload || payload.streamId !== streamId) return;
      const user = payload.user ?? "Anon";
      const text = payload.text ?? "";
      const incoming: ChatMessage = {
        id: payload.id ?? genId(),
        user,
        text,
        ts: payload.ts ?? Date.now(),
        system: !!payload.system,
        replyToUser: payload.replyToUser,
        replyToText: payload.replyToText,
        badges: payload.badges,
      };
      appendMessage(incoming);
    };

    const onTyping = (payload: any) => {
      if (!payload || payload.streamId !== streamId) return;
      const user = payload.user;
      setTypingUsers((prev) => ({ ...prev, [user]: Date.now() }));
      window.setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (Date.now() - (next[user] || 0) > TYPING_TIMEOUT - 200) {
            delete next[user];
          }
          return next;
        });
      }, TYPING_TIMEOUT + 200);
    };

    const onParticipants = (payload: any) => {
      if (!payload || payload.streamId !== streamId) return;
      setParticipants(payload.participants || []);
    };

    const onDeleted = (payload: any) => {
      if (!payload || payload.streamId !== streamId) return;
      setMsgs((s) =>
        s.map((m) => (m.id === payload.id ? { ...m, deleted: true, text: "[message removed]" } : m))
      );
      toast.info("Message removed by moderator", undefined, 2500);
    };

    const onHistory = (payload: any) => {
      if (!payload || payload.streamId !== streamId || !Array.isArray(payload.messages)) return;
      const sanitized = payload.messages.map((m: any) => ({
        id: m.id ?? genId(),
        user: m.user ?? "Anon",
        text: m.text ?? "",
        ts: m.ts ?? Date.now(),
        system: !!m.system,
        deleted: !!m.deleted,
        replyToUser: m.replyToUser,
        replyToText: m.replyToText,
        badges: m.badges,
      }));
      if (!sanitized.length) return;
      setMsgs(sanitized);
    };

    try {
      socket.on("chat:message", onMsg);
      socket.on("chat:typing", onTyping);
      socket.on("chat:participants", onParticipants);
      socket.on("chat:moderation:deleted", onDeleted);
      socket.on("chat:history", onHistory);
    } catch {
      // ignore
    }

    return () => {
      try {
        socket.off("chat:message", onMsg);
        socket.off("chat:typing", onTyping);
        socket.off("chat:participants", onParticipants);
        socket.off("chat:moderation:deleted", onDeleted);
        socket.off("chat:history", onHistory);
      } catch {
        // ignore
      }
    };
  }, [streamId, toast, useSocket]);

  const handleSend = async ({ text, replyTo }: ChatSendPayload) => {
    if (!useSocket) {
      const id = genId();
      const nextMsg: ChatMessage = {
        id,
        user: currentUser,
        text,
        ts: Date.now(),
        replyToUser: replyTo?.user,
        replyToText: replyTo?.text,
        badges: mergeBadges(currentBadges, isModerator ? ["moderator"] : []),
      };
      if (!messages) {
        setMsgs((s) => [...s, nextMsg]);
      }
      await onSendMessage?.({ text, replyTo });
      return;
    }
    const id = genId();
    const nextMsg: ChatMessage = {
      id,
      user: currentUser,
      text,
      ts: Date.now(),
      replyToUser: replyTo?.user,
      replyToText: replyTo?.text,
      badges: mergeBadges(currentBadges, isModerator ? ["moderator"] : []),
    };
    setMsgs((s) => [...s, nextMsg]);
    try {
      socket.emit("chat:message", {
        streamId,
        id,
        user: currentUser,
        text,
        ts: nextMsg.ts,
        replyToUser: replyTo?.user,
        replyToText: replyTo?.text,
        badges: nextMsg.badges,
      });
    } catch (err) {
      console.error("send failed", err);
      toast.error("Failed to send message", undefined, 3000);
    }
  };

  const handleModeration = (action: ChatModerationAction, msgId: string) => {
    if (!useSocket) {
      onModerateMessage?.(action, msgId);
      return;
    }
    if (!isModerator) return;
    try {
      socket.emit("chat:moderate", { streamId, action, id: msgId });
      toast.success("Moderator action sent", undefined, 2000);
      if (action === "delete") {
        setMsgs((s) => s.map((m) => (m.id === msgId ? { ...m, deleted: true, text: "[removed by moderator]" } : m)));
      }
      if (action === "clear") {
        setMsgs([]);
      }
    } catch (err) {
      console.error("moderate failed", err);
      toast.error("Moderator action failed", undefined, 2500);
    }
  };

  const handleClear = () => {
    if (!useSocket) {
      onClearChat?.();
      return;
    }
    handleModeration("clear", "bulk");
  };

  const handleTyping = (value: string) => {
    if (!useSocket || !value.trim()) return;
    const now = Date.now();
    if (now - typingSentAt.current < TYPING_THROTTLE) return;
    typingSentAt.current = now;
    try {
      socket.emit("chat:typing", { streamId, user: currentUser });
    } catch {
      // ignore
    }
  };

  const resolvedMessages = useSocket ? msgs : messages ?? msgs;
  const resolvedConnected = useSocket ? connected : isConnected ?? true;

  return (
    <ChatUI
      streamId={streamId}
      messages={resolvedMessages}
      currentUser={currentUser}
      participants={participants}
      typingUsers={Object.keys(typingUsers)}
      inputId={inputId}
      emotes={emotes}
      showTimestamps={showTimestamps}
      slowModeMs={slowModeMs}
      pinnedNotice={pinnedNotice}
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      variant={variant}
      heightClass={heightClass}
      isConnected={resolvedConnected}
      canChat={canChat}
      isModerator={isModerator}
      showModerationPanel={showModerationPanel}
      collapsedOnDesktop={collapsedOnDesktop}
      autoScrollMode={autoScrollMode}
      onSendMessage={handleSend}
      onModerateMessage={handleModeration}
      onClearChat={handleClear}
      onTyping={handleTyping}
    />
  );
}
