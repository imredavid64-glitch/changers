"use client";

import Image from "next/image";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Briefcase, Edit3, Eye, MapPin, MessageCircle, Save, ShieldCheck, UserCircle, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { PostCard } from "@/components/PostCard";
import {
  COLLECTIONS,
  createDocument,
  deleteDocument,
  getDocument,
  privateReadWritePermissions,
  publicReadOwnerWritePermissions,
  sharedReadPermissions,
  updateDocument,
  watchDocument,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppPost, AppProfile, Strand } from "@/lib/social/types";
import {
  STRAND_LABELS,
  STRAND_OPTIONS,
  buildProfileSearchIndex,
  normalizePost,
  normalizeProfile,
} from "@/lib/social/utils";
import { deleteMediaAsset, uploadMediaAsset } from "@/lib/media/client";
import { computeImpactScore, impactLevel } from "@/lib/social/impact";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { refreshBadges } from "@/lib/badges/refresh";

type ProfileFormState = {
  fullName: string;
  role: string;
  headline: string;
  bio: string;
  location: string;
  mentorFocus: string;
  interests: Strand[];
  isMentor: boolean;
  theme: AppProfile["theme"];
};

type ThemeOption = { value: AppProfile["theme"]; label: string; swatch: string };

const THEME_OPTIONS: ThemeOption[] = [
  { value: "moss", label: "Moss", swatch: "#20796c" },
  { value: "ocean", label: "Ocean", swatch: "#1f5e8f" },
  { value: "sunset", label: "Sunset", swatch: "#e0784f" },
  { value: "rose", label: "Rose", swatch: "#c2547a" },
];

const THEME_GRADIENTS: Record<AppProfile["theme"], string> = {
  moss: "linear-gradient(130deg, color-mix(in srgb, var(--moss) 95%, transparent), color-mix(in srgb, var(--teal) 82%, transparent), color-mix(in srgb, var(--sun) 72%, transparent))",
  ocean: "linear-gradient(130deg, rgba(20, 60, 99, 0.95), rgba(31, 105, 164, 0.85), rgba(116, 178, 224, 0.7))",
  sunset: "linear-gradient(130deg, rgba(178, 72, 46, 0.95), rgba(224, 120, 79, 0.85), color-mix(in srgb, var(--sun) 75%, transparent))",
  rose: "linear-gradient(130deg, rgba(150, 50, 92, 0.95), rgba(194, 84, 122, 0.85), color-mix(in srgb, var(--sun) 70%, transparent))",
};

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const profileId = resolvedParams.id;
  const router = useRouter();
  const { user: currentUser, profile: currentProfile, syncProfileName } = useAuth();

  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [posts, setPosts] = useState<AppPost[]>([]);
  const [savedPosts, setSavedPosts] = useState<AppPost[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeCollection, setActiveCollection] = useState<"posts" | "saved">("posts");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [privacy, setPrivacy] = useState<"public" | "followers" | "private">("public");
  const [dmPermission, setDmPermission] = useState<"everyone" | "followers" | "none">("everyone");
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [editForm, setEditForm] = useState<ProfileFormState>({
    fullName: "",
    role: "",
    headline: "",
    bio: "",
    location: "",
    mentorFocus: "",
    interests: ["S"],
    isMentor: false,
    theme: "moss",
  });

  const isOwner = currentUser?.$id === profileId;
  const followDocumentId = currentUser ? `${currentUser.$id}_${profileId}` : "";

  useEffect(() => {
    if (currentUser?.$id && currentUser.$id === profileId) {
      void refreshBadges(profileId);
    }
  }, [currentUser?.$id, profileId]);

  useEffect(() => {
    return watchDocument(
      COLLECTIONS.profiles,
      profileId,
      (document) => normalizeProfile(document.$id, document),
      (nextProfile) => {
        if (nextProfile) {
          setProfile(nextProfile);
          setEditForm({
            fullName: nextProfile.full_name,
            role: nextProfile.role,
            headline: nextProfile.headline,
            bio: nextProfile.bio,
            location: nextProfile.location,
            mentorFocus: nextProfile.mentor_focus,
            interests: nextProfile.interests,
            isMentor: nextProfile.is_mentor,
            theme: nextProfile.theme,
          });
        } else {
          setProfile(null);
        }
        setLoadingProfile(false);
      },
      () => setLoadingProfile(false),
    );
  }, [profileId]);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.posts,
      [Query.equal("author_id", profileId), Query.orderDesc("created_at_ms"), Query.limit(100)],
      (document) => normalizePost(document.$id, document),
      setPosts,
      () => setPosts([]),
    );
  }, [profileId]);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.follows,
      [Query.equal("followee_id", profileId), Query.limit(500)],
      (document) => document.$id,
      (documents) => setFollowersCount(documents.length),
      () => setFollowersCount(0),
    );
  }, [profileId]);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.follows,
      [Query.equal("follower_id", profileId), Query.limit(500)],
      (document) => document.$id,
      (documents) => setFollowingCount(documents.length),
      () => setFollowingCount(0),
    );
  }, [profileId]);

  // Reset follow/block flags only when the view or signed-in user transitions to a
  // state where no subscription applies; otherwise the callbacks own these values.
  const [prevFollowKey, setPrevFollowKey] = useState(`${currentUser?.$id ?? ""}:${isOwner ? "1" : "0"}`);
  const followKey = `${currentUser?.$id ?? ""}:${isOwner ? "1" : "0"}`;
  if (followKey !== prevFollowKey) {
    setPrevFollowKey(followKey);
    if (!currentUser || isOwner) {
      setIsFollowing(false);
      setIsBlocked(false);
    }
  }

  useEffect(() => {
    if (!currentUser || isOwner) return;

    const unsubFollow = watchDocument(
      COLLECTIONS.follows,
      followDocumentId,
      (document) => document,
      (document) => setIsFollowing(Boolean(document)),
      () => setIsFollowing(false),
    );

    const unsubBlock = watchDocument(
      COLLECTIONS.blocks,
      `${currentUser.$id}_${profileId}`,
      (document) => document,
      (document) => setIsBlocked(Boolean(document)),
      () => setIsBlocked(false),
    );

    return () => { unsubFollow(); unsubBlock(); };
  }, [currentUser, followDocumentId, isOwner, profileId]);

  const [prevSavedKey, setPrevSavedKey] = useState(`${currentUser?.$id ?? ""}:${isOwner ? "1" : "0"}`);
  const savedKey = `${currentUser?.$id ?? ""}:${isOwner ? "1" : "0"}`;
  if (savedKey !== prevSavedKey) {
    setPrevSavedKey(savedKey);
    if (!isOwner || !currentUser) setSavedPosts([]);
  }

  useEffect(() => {
    if (!isOwner || !currentUser) return;

    return watchDocuments(
      COLLECTIONS.savedPosts,
      [Query.equal("user_id", currentUser.$id), Query.orderDesc("created_at_ms"), Query.limit(24)],
      (document) => document,
      async (documents) => {
        const loadedPosts = await Promise.all(
          documents.map(async (savedDocument) => {
            const post = await getDocument(COLLECTIONS.posts, String(savedDocument.post_id || ""));
            return post ? normalizePost(post.$id, post) : null;
          }),
        );
        setSavedPosts(loadedPosts.filter((post): post is AppPost => Boolean(post)));
      },
      () => setSavedPosts([]),
    );
  }, [currentUser, isOwner]);

  function toggleInterest(strand: Strand) {
    setEditForm((current) => ({
      ...current,
      interests: current.interests.includes(strand)
        ? current.interests.filter((item) => item !== strand)
        : [...current.interests, strand],
    }));
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOwner || !currentUser || !profile) return;

    if (editForm.interests.length === 0) {
      setStatus("Choose at least one strand so the feed can personalize around you.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const avatar = formData.get("avatar");
    let avatarMediaId = profile.avatar_media_id || "";
    let avatarMediaStorageKey = profile.avatar_media_storage_key || "";
    let avatarMediaUrl = profile.avatar_media_url || "";
    const previousAvatarMediaId = profile.avatar_media_id || "";
    const previousAvatarFileId = profile.avatar_file_id || "";
    let uploadedAvatarMediaId = "";

    setSaving(true);
    setStatus(null);

    try {
      if (avatar instanceof File && avatar.size > 0) {
        const uploaded = await uploadMediaAsset(avatar, { purpose: "avatar", visibility: "public" });
        uploadedAvatarMediaId = uploaded.mediaId;
        avatarMediaId = uploaded.mediaId;
        avatarMediaStorageKey = uploaded.storageKey;
        avatarMediaUrl = uploaded.publicUrl;
      }

      if (editForm.fullName.trim() !== profile.full_name) {
        await syncProfileName(editForm.fullName.trim());
      }

      await updateDocument(COLLECTIONS.profiles, profileId, {
        full_name: editForm.fullName.trim(),
        role: editForm.role.trim(),
        headline: editForm.headline.trim(),
        bio: editForm.bio.trim(),
        location: editForm.location.trim(),
        avatar_file_id: uploadedAvatarMediaId ? "" : previousAvatarFileId,
        avatar_media_id: avatarMediaId,
        avatar_media_storage_key: avatarMediaStorageKey,
        avatar_media_url: avatarMediaUrl,
        avatar_url: avatarMediaUrl || profile.avatar_url,
        interests: editForm.interests,
        is_mentor: editForm.isMentor,
        mentor_focus: editForm.isMentor ? editForm.mentorFocus.trim() : "",
        theme: editForm.theme,
        search_index: buildProfileSearchIndex({
          full_name: editForm.fullName.trim(),
          role: editForm.role.trim(),
          headline: editForm.headline.trim(),
          bio: editForm.bio.trim(),
          location: editForm.location.trim(),
          mentor_focus: editForm.isMentor ? editForm.mentorFocus.trim() : "",
          interests: editForm.interests,
        }),
        updated_at_ms: Date.now(),
      });

      setStatus("Profile updated.");
      setIsEditing(false);

      if (
        uploadedAvatarMediaId &&
        previousAvatarMediaId &&
        previousAvatarMediaId !== uploadedAvatarMediaId
      ) {
        void deleteMediaAsset(previousAvatarMediaId).catch(() => {});
      }
    } catch (error) {
      if (uploadedAvatarMediaId) {
        void deleteMediaAsset(uploadedAvatarMediaId).catch(() => {});
      }
      setStatus(error instanceof Error ? error.message : "Profile save failed.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleFollow() {
    if (!currentUser || !profile) {
      setStatus("Sign in to follow people.");
      return;
    }

    try {
      if (isFollowing) {
        await deleteDocument(COLLECTIONS.follows, followDocumentId);
        setStatus(`You unfollowed ${profile.full_name}.`);
        return;
      }

      await createDocument(
        COLLECTIONS.follows,
        {
          follower_id: currentUser.$id,
          followee_id: profileId,
          created_at_ms: Date.now(),
        },
        publicReadOwnerWritePermissions(currentUser.$id),
        followDocumentId,
      );

      await createDocument(
        COLLECTIONS.notifications,
        {
          user_id: profileId,
          type: "follow",
          actor_name: currentProfile?.full_name || currentUser.name,
          actor_id: currentUser.$id,
          post_id: "",
          room_id: "",
          read: false,
          message: `${currentProfile?.full_name || currentUser.name} started following you.`,
          created_at_ms: Date.now(),
        },
        privateReadWritePermissions(profileId),
      );

      setStatus(`You are now following ${profile.full_name}.`);
    } catch (error) {
      setStatus("Follow action failed.");
      console.error(error);
    }
  }

  async function handleBlockUser() {
    if (!currentUser || !profile) {
      setStatus("Sign in to block users.");
      return;
    }

    if (isBlocked) {
      await deleteDocument(COLLECTIONS.blocks, `${currentUser.$id}_${profileId}`).catch(() => {});
      setIsBlocked(false);
      setStatus(`Unblocked ${profile.full_name}.`);
    } else {
      await createDocument(
        COLLECTIONS.blocks,
        { blocker_id: currentUser.$id, blocked_id: profileId, created_at_ms: Date.now() },
        privateReadWritePermissions(currentUser.$id),
        `${currentUser.$id}_${profileId}`,
      ).catch(() => {});
      setIsBlocked(true);
      setStatus(`Blocked ${profile.full_name}.`);
    }
  }

  async function handleSavePrivacy() {
    if (!currentUser) return;
    try {
      await updateDocument(COLLECTIONS.profiles, profileId, { privacy, dm_permission: dmPermission, updated_at_ms: Date.now() });
      setStatus("Privacy settings updated.");
      setShowPrivacySettings(false);
    } catch {
      setStatus("Failed to update privacy settings.");
    }
  }

  async function handleMessageUser() {
    if (!currentUser || !profile) {
      setStatus("Sign in to start direct messages.");
      return;
    }

    const participants = [currentUser.$id, profileId].sort();
    const threadId = `${participants[0]}_${participants[1]}`;

    const existingThread = await getDocument(COLLECTIONS.threads, threadId);
    if (!existingThread) {
      await createDocument(
        COLLECTIONS.threads,
        {
          participants,
          last_message: "",
          updated_at_ms: Date.now(),
        },
        sharedReadPermissions(participants),
        threadId,
      );
    }

    router.push(`/messages/${threadId}`);
  }

  if (loadingProfile) {
    return <p className="muted" style={{ padding: 40 }}>Loading profile...</p>;
  }

  if (!profile) {
    return (
      <section className="card" style={{ padding: 32 }}>
        <h2>Profile not found</h2>
        <p className="muted">This changemaker profile does not exist yet.</p>
      </section>
    );
  }

  const collectionPosts = activeCollection === "saved" ? savedPosts : posts;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: "grid", gap: 24 }}
    >
      <section className="card" style={{ position: "relative", overflow: "hidden" }}>
        <div
          style={{
            height: 160,
            margin: "-24px -24px 0",
            background: THEME_GRADIENTS[profile.theme] || THEME_GRADIENTS.moss,
          }}
        />

        <div style={{ marginTop: -54, display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.full_name}
              width={112}
              height={112}
              unoptimized
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                objectFit: "cover",
                border: "4px solid white",
                boxShadow: "var(--shadow)",
              }}
            />
          ) : (
            <div
              style={{
                width: 112,
                height: 112,
                borderRadius: 56,
                display: "grid",
                placeItems: "center",
                background: "var(--surface-card-solid)",
                border: "4px solid var(--surface-card-solid)",
                boxShadow: "var(--shadow)",
              }}
            >
              <UserCircle size={72} color="var(--moss)" />
            </div>
          )}

          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontFamily: "var(--font-head)" }}>{profile.full_name}</h1>
              {profile.is_mentor && (
                <span className="chip" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={14} /> Mentor
                </span>
              )}
            </div>

            <p
              className="muted"
              style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Briefcase size={16} /> {profile.role}
              </span>
              {profile.location && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={16} /> {profile.location}
                </span>
              )}
            </p>

            {profile.headline && <p style={{ marginTop: 10, fontWeight: 600 }}>{profile.headline}</p>}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {currentUser && !isOwner && (
              <>
                <button className={isFollowing ? "ghost" : "primary"} onClick={toggleFollow}>
                  {isFollowing ? "Following" : "Follow"}
                </button>
                <button className="ghost" onClick={handleMessageUser}>
                  <MessageCircle size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Message
                </button>
                <button className="ghost" onClick={handleBlockUser} style={{ color: "var(--coral)" }}>
                  {isBlocked ? "Unblock" : "Block"}
                </button>
              </>
            )}

            {isOwner && !isEditing && (
              <>
                <button className="ghost" onClick={() => setIsEditing(true)}>
                  <Edit3 size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Edit profile
                </button>
                <button className="ghost" onClick={() => setShowPrivacySettings(!showPrivacySettings)}>
                  <Eye size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  Privacy
                </button>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 14,
            marginTop: 24,
          }}
        >
          <div className="mini-card">
            <p className="meta-label">Followers</p>
            <p className="meta-value">{followersCount}</p>
          </div>
          <div className="mini-card">
            <p className="meta-label">Following</p>
            <p className="meta-value">{followingCount}</p>
          </div>
          <div className="mini-card">
            <p className="meta-label">Posts</p>
            <p className="meta-value">{posts.length}</p>
          </div>
          <div className="mini-card">
            <p className="meta-label">Saved</p>
            <p className="meta-value">{isOwner ? savedPosts.length : "Private"}</p>
          </div>
          <div className="mini-card">
            <p className="meta-label">Impact score</p>
            <p className="meta-value" style={{ fontSize: "0.95rem" }}>
              {computeImpactScore({
                posts: posts.length,
                projects: 0,
                documents: 0,
                slideshows: 0,
                eventsHosted: 0,
                roomsJoined: 0,
                followers: followersCount,
              })}
            </p>
          </div>
          <div className="mini-card">
            <p className="meta-label">Level</p>
            <p className="meta-value" style={{ fontSize: "0.8rem" }}>
              {impactLevel(computeImpactScore({
                posts: posts.length,
                projects: 0,
                documents: 0,
                slideshows: 0,
                eventsHosted: 0,
                roomsJoined: 0,
                followers: followersCount,
              }))}
            </p>
          </div>
        </div>

        {profile && <BadgeDisplay profile={profile} />}

        <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
          <p>{profile.bio || "This changemaker hasn't added a bio yet."}</p>
          {profile.mentor_focus && (
            <div className="bridge-results">
              <p style={{ fontWeight: 700, marginBottom: 4 }}>Mentor focus</p>
              <p className="muted">{profile.mentor_focus}</p>
            </div>
          )}
          <div className="tag-row" style={{ marginTop: 0 }}>
            {profile.interests.map((strand) => (
              <span className="tag" key={strand}>
                {STRAND_LABELS[strand]}
              </span>
            ))}
          </div>
        </div>
      </section>

      {isEditing && (
        <section className="card">
          <form className="composer-form" onSubmit={handleSaveProfile}>
            <div className="section-header" style={{ marginBottom: 0 }}>
              <div>
                <h2>Edit Profile</h2>
                <p className="muted">Keep your public identity, mentor presence, and feed interests up to date.</p>
              </div>
            </div>

            <input
              type="text"
              value={editForm.fullName}
              onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })}
              placeholder="Full name"
              required
            />
            <input
              type="text"
              value={editForm.role}
              onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
              placeholder="Role"
              required
            />
            <input
              type="text"
              value={editForm.headline}
              onChange={(event) => setEditForm({ ...editForm, headline: event.target.value })}
              placeholder="Short headline"
            />
            <input
              type="text"
              value={editForm.location}
              onChange={(event) => setEditForm({ ...editForm, location: event.target.value })}
              placeholder="Location"
            />
            <textarea
              value={editForm.bio}
              onChange={(event) => setEditForm({ ...editForm, bio: event.target.value })}
              placeholder="Write a short bio"
              style={{ minHeight: 110 }}
            />

            <div style={{ display: "grid", gap: 10 }}>
              <span style={{ fontWeight: 600 }}>Impact strands</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {STRAND_OPTIONS.map((strand) => (
                  <label
                    key={strand.value}
                    style={{
                      display: "inline-flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: editForm.interests.includes(strand.value)
                        ? "color-mix(in srgb, var(--teal) 12%, transparent)"
                        : "rgba(16, 24, 32, 0.05)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.interests.includes(strand.value)}
                      onChange={() => toggleInterest(strand.value)}
                    />
                    {strand.label}
                  </label>
                ))}
              </div>
            </div>

            <label
              style={{
                display: "inline-flex",
                gap: 10,
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: 14,
                background: "color-mix(in srgb, var(--teal) 8%, transparent)",
              }}
            >
              <input
                type="checkbox"
                checked={editForm.isMentor}
                onChange={(event) => setEditForm({ ...editForm, isMentor: event.target.checked })}
              />
              Show me in the mentor network
            </label>

            {editForm.isMentor && (
              <textarea
                value={editForm.mentorFocus}
                onChange={(event) => setEditForm({ ...editForm, mentorFocus: event.target.value })}
                placeholder="What kinds of founders, organizers, or projects can you help?"
                style={{ minHeight: 90 }}
              />
            )}

            <div style={{ display: "grid", gap: 10 }}>
              <span style={{ fontWeight: 600 }}>Profile theme</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {THEME_OPTIONS.map((themeOption) => (
                  <button
                    type="button"
                    key={themeOption.value}
                    onClick={() => setEditForm({ ...editForm, theme: themeOption.value })}
                    style={{
                      display: "inline-flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: editForm.theme === themeOption.value ? "2px solid var(--teal)" : "1px solid rgba(16,24,32,0.1)",
                      background: editForm.theme === themeOption.value ? "color-mix(in srgb, var(--teal) 8%, transparent)" : "var(--surface-card-solid)",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    <span style={{ width: 16, height: 16, borderRadius: 8, background: themeOption.swatch }} />
                    {themeOption.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <span style={{ fontWeight: 600 }}>Profile theme</span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {THEME_OPTIONS.map((themeOption) => (
                  <button
                    type="button"
                    key={themeOption.value}
                    onClick={() => setEditForm({ ...editForm, theme: themeOption.value })}
                    style={{
                      display: "inline-flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: editForm.theme === themeOption.value ? "2px solid var(--teal)" : "1px solid rgba(16,24,32,0.1)",
                      background: editForm.theme === themeOption.value ? "color-mix(in srgb, var(--teal) 8%, transparent)" : "var(--surface-card-solid)",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    <span style={{ width: 16, height: 16, borderRadius: 8, background: themeOption.swatch }} />
                    {themeOption.label}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Avatar image</span>
              <input type="file" name="avatar" accept="image/*" />
            </label>

            {status && <p className="notice">{status}</p>}

            <div className="button-row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={saving}>
                <Save size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                {saving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        </section>
      )}

      {showPrivacySettings && isOwner && (
        <section className="card">
          <div className="section-header">
            <div>
              <h2>Privacy & Safety</h2>
              <p className="muted">Control who can see your content and contact you.</p>
            </div>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Profile visibility</span>
              <select value={privacy} onChange={e => setPrivacy(e.target.value as typeof privacy)}>
                <option value="public">Public (anyone can see)</option>
                <option value="followers">Followers only</option>
                <option value="private">Private (only you)</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Who can message you</span>
              <select value={dmPermission} onChange={e => setDmPermission(e.target.value as typeof dmPermission)}>
                <option value="everyone">Everyone</option>
                <option value="followers">Followers only</option>
                <option value="none">No one</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="ghost" onClick={() => setShowPrivacySettings(false)}>Cancel</button>
              <button className="primary" onClick={handleSavePrivacy}>Save</button>
            </div>
          </div>
        </section>
      )}

      {!isEditing && !showPrivacySettings && status && (
        <p className="notice" style={{ marginTop: -10 }}>
          {status}
        </p>
      )}

      <section className="card">
        <div className="feed-header">
          <div>
            <h2>{isOwner && activeCollection === "saved" ? "Saved Posts" : "Activity"}</h2>
            <p className="muted">
              {isOwner && activeCollection === "saved"
                ? "A private list of posts you want to revisit."
                : "Recent posts and conversations from this profile."}
            </p>
          </div>

          <div className="filter-row">
            <button
              className={`filter ${activeCollection === "posts" ? "active" : ""}`}
              onClick={() => setActiveCollection("posts")}
            >
              Posts
            </button>
            {isOwner && (
              <button
                className={`filter ${activeCollection === "saved" ? "active" : ""}`}
                onClick={() => setActiveCollection("saved")}
              >
                Saved
              </button>
            )}
          </div>
        </div>

        <div className="feed" style={{ marginTop: 18 }}>
          {collectionPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 12px" }}>
              <Users size={38} color="var(--moss)" style={{ marginBottom: 12 }} />
              <p style={{ fontWeight: 700, marginBottom: 6 }}>
                {activeCollection === "saved" ? "No saved posts yet." : "No posts yet."}
              </p>
              <p className="muted">
                {activeCollection === "saved"
                  ? "Save a few posts from the feed and they will appear here."
                  : "This profile will fill up as soon as they start publishing."}
              </p>
            </div>
          ) : (
            collectionPosts.map((post) => <PostCard key={post.id} post={post} user={currentUser} />)
          )}
        </div>
      </section>
    </motion.div>
  );
}
