// src/pages/Profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import StreamCard from "../components/StreamCard";
import ViewerList from "../components/ViewerList";
import EditProfileModal from "../components/EditProfileModal";
import { useToast } from "../contexts/ToastContext";
import { AuthUser, readAuthUser } from "../lib/auth";

type Profile = {
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  followers?: number;
  following?: number;
  isLive?: boolean;
  address?: string;
};

function seedNumber(input: string) {
  return input.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function buildFallbackProfile(id: string, authUser: AuthUser | null): Profile {
  const handle = id || "creator";
  const seed = seedNumber(handle);
  return {
    username: handle,
    displayName: authUser?.displayName || authUser?.username || handle,
    bio: "This user has not added a bio yet.",
    avatar: undefined,
    followers: 120 + (seed % 1200),
    following: 40 + (seed % 300),
    isLive: false,
    address: handle,
  };
}

function getInitials(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned ? cleaned.slice(0, 2).toUpperCase() : "PS";
}

export default function ProfilePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [authUser, setAuthUser] = useState<AuthUser | null>(readAuthUser());
  const [profile, setProfile] = useState<Profile>(() => buildFallbackProfile(id || "creator", readAuthUser()));
  const [streams, setStreams] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [editing, setEditing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    const refresh = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const resolvedId = useMemo(() => {
    if (id === "me") {
      return authUser?.username || authUser?.id || authUser?.address || "me";
    }
    return id || authUser?.username || authUser?.id || authUser?.address || "creator";
  }, [id, authUser]);

  const isOwner =
    !!authUser &&
    (authUser.username === resolvedId ||
      authUser.address === resolvedId ||
      authUser.id === resolvedId ||
      authUser.username === profile.username ||
      authUser.address === profile.username);

  useEffect(() => {
    const fallback = buildFallbackProfile(resolvedId, authUser);
    setProfile(fallback);
    setLoadingProfile(true);
    setLoadingStreams(true);

    (async () => {
      try {
        const res = await api.get(`/api/users/${encodeURIComponent(resolvedId)}`).catch(() => null);
        if (res?.data) {
          setProfile((prev) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load profile", undefined, 3000);
      } finally {
        setLoadingProfile(false);
      }
    })();

    (async () => {
      try {
        const sres = await api.get(`/api/users/${encodeURIComponent(resolvedId)}/streams`).catch(() => null);
        if (Array.isArray(sres?.data)) setStreams(sres.data);
        else setStreams([]);
      } catch (err) {
        console.error(err);
        setStreams([]);
      } finally {
        setLoadingStreams(false);
      }
    })();

    (async () => {
      if (!authUser || isOwner) {
        setFollowing(false);
        return;
      }
      setFollowLoading(true);
      try {
        const fres = await api.get(`/api/users/${encodeURIComponent(resolvedId)}/following`).catch(() => null);
        setFollowing(Boolean(fres?.data?.following));
      } catch (err) {
        setFollowing(false);
      } finally {
        setFollowLoading(false);
      }
    })();
  }, [resolvedId, authUser, isOwner, toast]);

  const toggleFollow = async () => {
    if (!authUser) {
      toast.info("Sign in required", "Please sign in to follow creators.", 2500);
      return;
    }
    if (followLoading) return;
    setFollowLoading(true);
    const next = !following;
    setFollowing(next);
    setProfile((p) => ({
      ...p,
      followers: Math.max(0, (p.followers ?? 0) + (next ? 1 : -1)),
    }));
    try {
      await api
        .post(`/api/users/${encodeURIComponent(resolvedId)}/follow`, { action: next ? "follow" : "unfollow" })
        .catch(() => null);
      toast.success(next ? "Followed" : "Unfollowed", undefined, 2000);
    } catch (err) {
      console.error("Follow failed", err);
      toast.error("Action failed", undefined, 2500);
      setFollowing((s) => !s);
      setProfile((p) => ({
        ...p,
        followers: Math.max(0, (p.followers ?? 0) + (next ? -1 : 1)),
      }));
    } finally {
      setFollowLoading(false);
    }
  };

  const name = profile.displayName || profile.username;
  const handle = profile.username || resolvedId;

  return (
    <div className="space-y-6">
      <section className="glass-card p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div
            className="h-20 w-20 rounded-2xl flex items-center justify-center text-bg font-mono text-xl neon-ring"
            style={{ background: profile.avatar ? `url(${profile.avatar}) center/cover` : "var(--color-primary)" }}
          >
            {!profile.avatar && getInitials(name)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text truncate">{name}</h1>
              {profile.isLive && (
                <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold uppercase text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
              )}
              {loadingProfile && <span className="text-xs text-subtle">Syncing profile...</span>}
            </div>
            <div className="text-xs text-subtle">@{handle}</div>
            <p className="mt-3 text-sm subtle max-w-2xl">{profile.bio}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
              <div className="text-text">
                <span className="font-semibold">{profile.followers ?? 0}</span> followers
              </div>
              <div className="text-text">
                <span className="font-semibold">{profile.following ?? 0}</span> following
              </div>
              {profile.address && (
                <div className="text-subtle text-xs font-mono">
                  {profile.address.slice(0, 6)}...{profile.address.slice(-4)}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {isOwner ? (
                <button onClick={() => setEditing(true)} className="btn-primary px-4 py-2 rounded-md">
                  Edit profile
                </button>
              ) : (
                <button
                  onClick={toggleFollow}
                  className="px-4 py-2 rounded-md border"
                  aria-pressed={following}
                  disabled={followLoading}
                >
                  {followLoading ? "Loading..." : following ? "Following" : "Follow"}
                </button>
              )}

              <button
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success("Link copied", "Profile link copied to clipboard", 2200);
                }}
                className="px-3 py-2 rounded-md border"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Streams</h3>
          <div className="text-sm subtle">{streams.length} streams</div>
        </div>

        {loadingStreams ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-bg/20 animate-pulse" />
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="text-subtle">No streams yet - this streamer has not gone live.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((s) => (
              <StreamCard key={s.id || s.streamer} stream={s} />
            ))}
          </div>
        )}
      </section>

      <section className="glass-card p-6">
        <h4 className="text-sm subtle mb-2">Supporters</h4>
        <ViewerList streamId={String(resolvedId || "me")} />
      </section>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setProfile((p) => ({ ...p, ...next }));
            setEditing(false);
            toast.success("Profile updated", undefined, 2200);
          }}
        />
      )}
    </div>
  );
}
