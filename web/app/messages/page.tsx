"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, UserCircle } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, getDocument, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppThread, TimestampLike } from "@/lib/social/types";
import { normalizeProfile, normalizeThread, timestampToMillis } from "@/lib/social/utils";

interface ThreadWithOtherUser extends AppThread {
  other_user?: { id: string; name: string; role: string };
}

export default function MessagesInboxPage() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadWithOtherUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Reset the thread list only when the user actually transitions to signed-out;
  // while signed in the subscription callback owns `threads`/`loading` end-to-end.
  const [prevMessagesUserId, setPrevMessagesUserId] = useState<string | null>(user?.$id ?? null);
  const messagesUserId = user?.$id ?? null;
  if (messagesUserId !== prevMessagesUserId) {
    setPrevMessagesUserId(messagesUserId);
    if (messagesUserId === null) {
      setThreads([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) return;

    return watchDocuments(
      COLLECTIONS.threads,
      [Query.orderDesc("updated_at_ms"), Query.limit(100)],
      (document) => normalizeThread(document.$id, document),
      async (loadedThreads) => {
        const relevantThreads = loadedThreads.filter((thread) => thread.participants.includes(user.$id));
        const withOtherUsers = await Promise.all(
          relevantThreads.map(async (thread) => {
            const otherUserId = thread.participants.find((id) => id !== user.$id) || user.$id;
            const profileDocument = await getDocument(COLLECTIONS.profiles, otherUserId);

            return {
              ...thread,
              other_user: profileDocument
                ? {
                    id: otherUserId,
                    name: normalizeProfile(profileDocument.$id, profileDocument).full_name,
                    role: normalizeProfile(profileDocument.$id, profileDocument).role,
                  }
                : { id: otherUserId, name: "Unknown", role: "" },
            };
          }),
        );

        withOtherUsers.sort((a, b) => {
          const timeA = timestampToMillis(a.updated_at as TimestampLike);
          const timeB = timestampToMillis(b.updated_at as TimestampLike);
          return timeB - timeA;
        });
        setThreads(withOtherUsers);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [user]);

  if (!user) {
    return (
      <section className="card" style={{ padding: "40px", textAlign: "center" }}>
        <h2>Direct Messages</h2>
        <p className="muted">Please sign in to view your inbox.</p>
        <Link href="/sign-in"><button className="primary" style={{ marginTop: 24 }}>Sign In</button></Link>
      </section>
    );
  }

  return (
    <section className="card" style={{ minHeight: "60vh", display: "flex", flexDirection: "column" }}>
      <div className="section-header" style={{ marginBottom: "20px" }}>
        <div>
          <h2>Inbox</h2>
          <p className="muted">Your direct Appwrite-backed conversations.</p>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
        {loading ? (
          <p className="muted">Loading messages...</p>
        ) : threads.length === 0 ? (
          <div style={{ textAlign: "center", margin: "auto", color: "var(--moss)", opacity: 0.5 }}>
            <Send size={48} style={{ margin: "0 auto 16px" }} />
            <p>Your inbox is empty.</p>
            <p style={{ fontSize: "0.85rem" }}>Go to an author&apos;s profile on the timeline to send them a direct message.</p>
          </div>
        ) : (
          <AnimatePresence>
            {threads.map((thread) => (
              <motion.div
                key={thread.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link href={`/messages/${thread.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ padding: "16px", borderRadius: "12px", border: "1px solid rgba(16,24,32,0.08)", display: "flex", gap: "16px", alignItems: "center", transition: "all 0.2s ease", cursor: "pointer", background: "white" }} className="hover-lift">
                    <UserCircle size={40} color="var(--sage)" strokeWidth={1.5} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, margin: 0, fontSize: "1.05rem" }}>{thread.other_user?.name}</p>
                      <p className="muted" style={{ margin: "2px 0 0 0", fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {thread.last_message || "Started a conversation..."}
                      </p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
