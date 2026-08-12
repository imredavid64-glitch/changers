"use client";

import { useEffect, useState } from "react";
import { Models } from "appwrite";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, normalizeNotification } from "@/lib/social/utils";
import { AppNotification } from "@/lib/social/types";
import { COLLECTIONS, updateDocument, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { TINTS } from "@/lib/theme/tints";

export function NotificationsDropdown({ user }: { user: Models.User<Models.Preferences> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.notifications,
      [Query.equal("user_id", user.$id), Query.orderDesc("created_at_ms"), Query.limit(10)],
      (document) => normalizeNotification(document.$id, document),
      setNotifications,
      () => setNotifications([]),
    );
  }, [user]);

  async function markRead(id: string) {
    await updateDocument(COLLECTIONS.notifications, id, { read: true });
  }

  return (
    <div style={{ position: "relative" }}>
      <button 
        className="ghost" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: '8px', position: 'relative' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--coral)', color: 'white', fontSize: '0.7rem', width: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ position: "absolute", top: "100%", right: 0, width: "320px", background: "var(--surface-card-solid)", borderRadius: "12px", boxShadow: "0 12px 32px rgba(16,24,32,0.15)", border: "1px solid rgba(16,24,32,0.08)", zIndex: 100, overflow: 'hidden' }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(16,24,32,0.08)", fontWeight: 600 }}>Notifications</div>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <p className="muted" style={{ padding: "20px", textAlign: "center", margin: 0, fontSize: "0.9rem" }}>You have no notifications right now.</p>
              ) : (
                notifications.map((n) => {
                  let href = `/profile/${n.actor_id}`;
                  if (n.type === "follow") href = `/profile/${n.actor_id}`;
                  else if (n.post_id) href = `/posts/${n.post_id}`;
                  else if (n.project_id) href = `/projects/${n.project_id}`;
                  else if (n.event_id) href = `/events/${n.event_id}`;

                  const message =
                    n.message ||
                    (n.type === "like"
                      ? `${n.actor_name} applauded your post.`
                      : n.type === "comment"
                        ? `${n.actor_name} commented on your post.`
                        : n.type === "follow"
                          ? `${n.actor_name} started following you.`
                          : n.type === "poll_vote"
                            ? `${n.actor_name} voted in your poll.`
                            : n.type === "project_invite"
                              ? `${n.actor_name} invited you to a project.`
                              : n.type === "event_reminder"
                                ? `${n.actor_name} is attending your event.`
                                : `${n.actor_name} sent an update.`);

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        markRead(n.id);
                        setIsOpen(false);
                      }}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid rgba(16,24,32,0.04)",
                        background: n.read ? "transparent" : TINTS.teal5,
                        cursor: "pointer",
                        transition: "background 0.2s ease",
                      }}
                    >
                      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "grid", gap: 4 }}>
                        <span style={{ fontSize: "0.9rem" }}>{message}</span>
                        <span className="muted" style={{ fontSize: "0.8rem" }}>
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
