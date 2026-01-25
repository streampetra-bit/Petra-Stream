export type ChatBadge = "moderator" | "subscriber" | "partner" | "vip" | "owner";

export type ChatMessage = {
  id: string;
  user: string;
  text: string;
  ts: number;
  system?: boolean;
  deleted?: boolean;
  replyToUser?: string;
  replyToText?: string;
  badges?: ChatBadge[];
  color?: string;
};

export type ChatModerationAction = "delete" | "timeout" | "ban" | "clear";

export type ChatEmoteMap = Record<string, string>;
