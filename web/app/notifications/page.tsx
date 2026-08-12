"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, CheckCheck, Inbox, Mail } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, updateDocument, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppNotification } from "@/lib/social/types";
import { formatRelativeTime, normalizeNotification } from "@/lib/social/utils";
import { TINTS } from "@/lib/theme/tints";

type Tab = "inbox" | "settings";

const TYPE_FILTERS: { key: AppNotification["type"] | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "like", label: "Likes" },
  { key: "comment", label: "Comments" },
  { key: "follow", label: "Follows" },
  { key: "event_reminder", label: "Events" },
  { key: "poll_vote", label: "Polls" },
  { key: "project_invite", label: "Invites" },
];

function notificationHref(notification: AppNotification) {
  if (notification.type === "follow") return `/profile/${notification.actor_id}`;
  if (notification.post_id) return `/posts/${notification.post_id}`;
  if (notification.project_id) return `/projects/${notification.project_id}`;
  if (notification.event_id) return `/events/${notification.event_id}`;
  return `/profile/${notification.actor_id}`;
}

export default function NotificationsPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("inbox");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [typeFilter, setTypeFilter] = useState<AppNotification["type"] | "all">("all");
  const [markingAll, setMarkingAll] = useState(false);

  // --- Settings state ---
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchDocuments(
      COLLECTIONS.notifications,
      [Query.equal("user_id", user.$id), Query.orderDesc("created_at_ms"), Query.limit(100)],
      (document) => normalizeNotification(document.$id, document),
      setNotifications,
      () => setNotifications([]),
    );
  }, [user]);

  useEffect(() => {
    // Browser-capability detection must run post-hydration: computing it in render
    // would mismatch the SSR output (window/navigator don't exist server-side).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPushSupported("Notification" in window && "serviceWorker" in navigator);
  }, []);

  // Sync the email toggle from the profile when it (re)loads, without clobbering the
  // optimistic toggle: adjust state only when the profile object changes.
  const [prevProfileForEmail, setPrevProfileForEmail] = useState(profile);
  if (profile !== prevProfileForEmail) {
    setPrevProfileForEmail(profile);
    setEmailEnabled(Boolean(profile?.email_notifications));
  }

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const visibleNotifications = useMemo(
    () => (typeFilter === "all" ? notifications : notifications.filter((n) => n.type === typeFilter)),
    [notifications, typeFilter],
  );

  async function markRead(id: string) {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await updateDocument(COLLECTIONS.notifications, id, { read: true }).catch(() => {});
  }

  async function markAllRead() {
    if (unreadCount === 0 || !user) return;
    setMarkingAll(true);
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    await Promise.all(
      notifications.filter((n) => !n.read).map((n) => updateDocument(COLLECTIONS.notifications, n.id, { read: true })),
    ).catch(() => {});
    setMarkingAll(false);
  }

  async function handleToggleEmail() {
    if (!user) return;
    const next = !emailEnabled;
    setEmailEnabled(next);
    setStatus(next ? "Email notifications enabled." : "Email notifications disabled.");

    try {
      await updateDocument(COLLECTIONS.profiles, user.$id, {
        email_notifications: next,
        updated_at_ms: Date.now(),
      });
    } catch (error) {
      setEmailEnabled(!next);
      setStatus("Failed to update email notification preference.");
      console.error(error);
    }
  }

  async function handleTogglePush() {
    if (!pushSupported) { setStatus("Push notifications are not supported in this browser."); return; }

    try {
      if (pushEnabled) {
        setPushEnabled(false);
        setStatus("Push notifications disabled.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Notification permission denied. Update your browser settings.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) {
          setStatus("Push notifications are not configured yet. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in your environment.");
          return;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicVapidKey,
        });
      }

      await updateDocument(COLLECTIONS.profiles, user!.$id, {
        push_subscription: JSON.stringify(subscription),
        updated_at_ms: Date.now(),
      });

      setPushEnabled(true);
      setStatus("Push notifications enabled.");
    } catch (error) {
      setStatus("Failed to enable push notifications.");
      console.error(error);
    }
  }

  if (!user) {
    return <section className="card"><h2>Notifications</h2><p className="muted">Sign in to see your notifications.</p></section>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: "grid", gap: 24 }}
    >
      <section className="card">
        <div className="section-header">
          <div>
            <h2><Bell size={24} style={{ display: "inline", marginRight: 8, color: "var(--moss)", verticalAlign: "middle" }} /> Notifications</h2>
            <p className="muted">Realtime alerts for likes, comments, follows, and event activity.</p>
          </div>
          <div className="filter-row" style={{ display: "flex", gap: 8 }}>
            <button className={`filter ${tab === "inbox" ? "active" : ""}`} onClick={() => setTab("inbox")}>
              Inbox {unreadCount > 0 && <span className="chip" style={{ marginLeft: 6 }}>{unreadCount}</span>}
            </button>
            <button className={`filter ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
              Settings
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {tab === "inbox" ? (
            <motion.div
              key="inbox"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                <div className="filter-row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {TYPE_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      className={`filter ${typeFilter === filter.key ? "active" : ""}`}
                      onClick={() => setTypeFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
                <button className="ghost" onClick={markAllRead} disabled={unreadCount === 0 || markingAll}>
                  <CheckCheck size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {markingAll ? "Marking..." : "Mark all read"}
                </button>
              </div>

              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {visibleNotifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "44px 16px" }}>
                    <Inbox size={40} color="var(--moss)" style={{ marginBottom: 12 }} />
                    <p style={{ fontWeight: 700, marginBottom: 6 }}>Nothing here</p>
                    <p className="muted">
                      {typeFilter === "all"
                        ? "When someone likes your post, comments, follows you, or RSVPs to your event, it shows up here."
                        : "No notifications of this type yet."}
                    </p>
                  </div>
                ) : (
                  visibleNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => markRead(notification.id)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 14,
                        border: "1px solid var(--border-card)",
                        background: notification.read ? "var(--surface-card-solid)" : TINTS.teal6,
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <Link
                        href={notificationHref(notification)}
                        style={{ textDecoration: "none", color: "inherit", display: "grid", gap: 2 }}
                      >
                        <span style={{ fontWeight: notification.read ? 400 : 600 }}>
                          {notification.message ||
                            `${notification.actor_name} ${notification.type === "like" ? "applauded your post" : notification.type === "comment" ? "commented on your post" : notification.type === "follow" ? "started following you" : notification.type === "event_reminder" ? "is attending your event" : "sent an update"}.`}
                        </span>
                        <span className="muted" style={{ fontSize: "0.8rem" }}>
                          {notification.actor_name} · {formatRelativeTime(notification.created_at)}
                        </span>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ display: "grid", gap: 16, marginTop: 6 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderRadius: 16, border: "1px solid var(--border-card)", background: "var(--surface-card-solid)" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {pushEnabled ? <Bell size={24} color="var(--teal)" /> : <BellOff size={24} />}
                  <div>
                    <p style={{ fontWeight: 600 }}>Push notifications</p>
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Receive alerts when someone interacts with your posts or messages you.</p>
                  </div>
                </div>
                <button className={pushEnabled ? "primary" : "ghost"} onClick={handleTogglePush}>
                  {pushEnabled ? "Enabled" : "Enable"}
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderRadius: 16, border: "1px solid var(--border-card)", background: "var(--surface-card-solid)" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Mail size={24} />
                  <div>
                    <p style={{ fontWeight: 600 }}>Email notifications</p>
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Get email digests of your unanswered messages and trending posts.</p>
                  </div>
                </div>
                <button className={emailEnabled ? "primary" : "ghost"} onClick={handleToggleEmail}>
                  {emailEnabled ? "Enabled" : "Enable"}
                </button>
              </div>

              {status && <p className="notice">{status}</p>}

              <div className="bridge-results">
                <p style={{ fontWeight: 700, marginBottom: 4 }}>In-app notifications</p>
                <p className="muted">
                  In-app notifications in the bell icon are always active and do not need configuration.
                  Push and email notifications are optional extras.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
