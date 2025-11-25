// src/components/EmojiPicker.tsx
import React from "react";

const EMOJIS = [
  "😀","😁","😂","🤣","😅","😊","😍","😘","😎","🤩",
  "😇","🙂","🙃","😉","😜","🤔","😴","😬","😢","😭",
  "👏","👍","👎","🙏","🔥","💯","🎉","🥳","💖","✨"
];

export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="bg-surface rounded-lg p-2 grid grid-cols-10 gap-2 border border-white/6">
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => onPick(e)}
          className="p-1 rounded hover:bg-surface/80 text-lg"
          aria-label={`Pick ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
