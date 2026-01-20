// src/pages/Profile.tsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import StreamCard from "../components/StreamCard";
import ViewerList from "../components/ViewerList";
import ProfileHeader from "../components/ProfileHeader";
import EditProfileModal from "../components/EditProfileModal";
import { useToast } from "../contexts/ToastContext";
import { AuthUser, readAuthUser } from "../lib/auth";

/**
 * Profile page
 * Route: /profile/:id
 *
 * Expects backend endpoints:
 * GET  /api/users/:id           -> { username, displayName, bio, avatar, followers, following, isLive, address }
 * GET  /api/users/:id/streams   -> [ streams... ]
 *
 * If backend isn't present the UI gracefully falls back to placeholder data.
 */

export default function ProfilePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [profile, setProfile] = useState<any | null>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [following, setFollowing] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(readAuthUser());

  useEffect(() => {
    const refresh = () => setAuthUser(readAuthUser());
    window.addEventListener("auth-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("auth-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const resolvedId = React.useMemo(() => {
    if (!id) return null;
    if (id !== "me") return id;
    return authUser?.username || authUser?.id || authUser?.address || "me";
  }, [id, authUser]);

  const isOwner =
    !!authUser &&
    (authUser.username === resolvedId ||
      authUser.address === resolvedId ||
      authUser.id === resolvedId ||
      authUser.username === profile?.username ||
      authUser.address === profile?.username);

  useEffect(() => {
    if (!resolvedId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await api.get(`/api/users/${resolvedId}`).catch(() => null);
        if (res && res.data) setProfile(res.data);
        else {
          // fallback placeholder
          setProfile({
            username: resolvedId,
            displayName: authUser?.displayName || authUser?.username || resolvedId,
            bio: "This user hasn't added a bio yet.",
            avatar: undefined,
            followers: Math.floor(Math.random() * 1200),
            following: Math.floor(Math.random() * 300),
            isLive: false,
            address: resolvedId,
          });
        }

        const sres = await api.get(`/api/users/${resolvedId}/streams`).catch(() => null);
        if (sres && sres.data) setStreams(sres.data);
        else setStreams([]);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load profile", undefined, 3000);
      } finally {
        setLoading(false);
      }
    })();
  }, [resolvedId, authUser, toast]);

  const toggleFollow = async () => {
    // UI optimistic
    setFollowing((s) => !s);
    try {
      // If you have an endpoint, call it:
      const follower = authUser?.username || authUser?.address || authUser?.id;
      const target = resolvedId || id;
      await api.post(`/api/users/${target}/follow`, follower ? { follower } : {}).catch(() => null);
      toast.success(following ? "Unfollowed" : "Followed", undefined, 2000);
    } catch (err) {
      console.error("Follow failed", err);
      toast.error("Action failed", undefined, 2500);
      setFollowing((s) => !s); // revert
    }
  };

  if (loading || !profile) {
    return (
      <div className="glass-card">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-bg/20 rounded w-48" />
          <div className="h-40 bg-bg/20 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileHeader
        username={profile.username}
        displayName={profile.displayName}
        bio={profile.bio}
        avatar={profile.avatar}
        isLive={profile.isLive}
        followers={profile.followers}
        following={profile.following}
      >
        <div className="flex items-center gap-3">
          {isOwner ? (
            <button onClick={() => setEditing(true)} className="px-4 py-2 btn-primary rounded-md">
              Edit profile
            </button>
          ) : (
            <button onClick={toggleFollow} className="px-4 py-2 rounded-md border" aria-pressed={following}>
              {following ? "Following" : "Follow"}
            </button>
          )}

          <button
            onClick={() => {
              // copy profile URL
              navigator.clipboard?.writeText(window.location.href);
              toast.success("Link copied", "Profile link copied to clipboard", 2200);
            }}
            className="px-3 py-2 rounded-md border"
          >
            Share
          </button>
        </div>
      </ProfileHeader>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Streams</h3>
          <div className="text-sm subtle">{streams.length} streams</div>
        </div>

        {streams.length === 0 ? (
          <div className="text-subtle">No streams yet - this streamer hasn't gone live.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map((s) => (
              <StreamCard key={s.id || s.streamer} stream={s} />
            ))}
          </div>
        )}
      </section>

      <aside className="glass-card">
        <h4 className="text-sm subtle mb-2">Supporters</h4>
        <ViewerList streamId={String(resolvedId || id || "me")} />
      </aside>

      {editing && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setProfile((p: any) => ({ ...p, ...next }));
            setEditing(false);
            toast.success("Profile updated", undefined, 2200);
          }}
        />
      )}
    </div>
  );
}



