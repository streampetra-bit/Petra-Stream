// src/components/ProfileHeader.tsx
import React from "react";
import clsx from "clsx";

export default function ProfileHeader({
  username,
  displayName,
  bio,
  avatar,
  isLive = false,
  followers,
  following,
  children,
}: {
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  isLive?: boolean;
  followers?: number;
  following?: number;
  children?: React.ReactNode;
}) {
  return (
    <header className="glass-card flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
      <div className="flex items-start gap-4">
        <div
          className={clsx(
            "w-20 h-20 rounded-xl flex items-center justify-center neon-ring text-bg font-mono text-xl",
            "bg-surface/60"
          )}
          style={{ background: avatar ? `url(${avatar}) center/cover` : undefined }}
        >
          {!avatar && (displayName || username).slice(0, 2).toUpperCase()}
        </div>

        <div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-2xl font-extrabold text-primary">{displayName ?? username}</div>
              <div className="text-xs subtle">@{username}</div>
            </div>

            {isLive ? (
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-red-600 text-white text-xs font-semibold">
                ● Live
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-sm muted max-w-xl">{bio}</p>

          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="text-text">
              <span className="font-semibold">{followers ?? 0}</span> followers
            </div>
            <div className="text-text">
              <span className="font-semibold">{following ?? 0}</span> following
            </div>
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">{children}</div>
    </header>
  );
}
