"use client";

import { useEffect, useState, use, useRef } from "react";
import { motion } from "framer-motion";
import { Send, ArrowLeft, UserCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  getDocument,
  sharedReadPermissions,
  updateDocument,
  watchDocument,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppThread, TimestampLike } from "@/lib/social/types";
import { getDisplayName, normalizeProfile, normalizeThread, timestampToMillis } from "@/lib/social/utils";

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at?: TimestampLike;
}

export default function DirectMessageThread({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const threadId = resolvedParams.id;
  const { user: currentUser, profile } = useAuth();
  const [thread, setThread] = useState<AppThread | null>(null);
  const [otherUser, setOtherUser] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser) {
      setThread(null);
      setOtherUser(null);
      setLoadingThread(false);
      return;
    }

    return watchDocument(
      COLLECTIONS.threads,
      threadId,
      (document) => normalizeThread(document.$id, document),
      (nextThread) => {
        setThread(nextThread);
        setLoadingThread(false);
      },
      (error) => {
        console.error(error);
        setThread(null);
        setLoadingThread(false);
      },
    );
  }, [currentUser, threadId]);

  useEffect(() => {
    if (!currentUser || !thread) {
      setOtherUser(null);
      return;
    }

    const otherUserId = thread.participants.find((participantId) => participantId !== currentUser.$id);
    if (!otherUserId) {
      setOtherUser({ id: currentUser.$id, name: profile?.full_name || getDisplayName(currentUser) });
      return;
    }

    const resolvedOtherUserId = otherUserId;
    let active = true;

    async function loadOtherUser() {
      const profileDocument = await getDocument(COLLECTIONS.profiles, resolvedOtherUserId);
      if (!active) return;

      if (profileDocument) {
        const normalized = normalizeProfile(profileDocument.$id, profileDocument);
        setOtherUser({ id: resolvedOtherUserId, name: normalized.full_name });
      } else {
        setOtherUser({ id: resolvedOtherUserId, name: "Unknown" });
      }

      // Check if blocked
      const blockDoc = currentUser ? await getDocument(COLLECTIONS.blocks, `${resolvedOtherUserId}_${currentUser.$id}`) : null;
      if (active) {
        setIsBlocked(Boolean(blockDoc));
      }
    }

    void loadOtherUser();

    return () => {
      active = false;
    };
  }, [currentUser, profile, thread]);

  useEffect(() => {
    const isParticipant = Boolean(currentUser && thread?.participants.includes(currentUser.$id));
    if (!currentUser || !thread || !isParticipant) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    return watchDocuments(
      COLLECTIONS.threadMessages,
      [Query.equal("thread_id", threadId), Query.orderAsc("created_at_ms"), Query.limit(500)],
      (document) => ({
        id: document.$id,
        sender_id: String(document.sender_id || ""),
        sender_name: String(document.sender_name || "Changemaker"),
        text: String(document.text || ""),
        created_at:
          typeof document.created_at_ms === "number" ? document.created_at_ms : undefined,
      }),
      (loadedMessages) => {
        loadedMessages.sort(
          (a, b) => timestampToMillis(a.created_at) - timestampToMillis(b.created_at),
        );
        setMessages(loadedMessages);
        setLoadingMessages(false);
      },
      (error) => {
        console.error(error);
        setMessages([]);
        setLoadingMessages(false);
        setStatus("Messages could not load.");
      },
    );
  }, [currentUser, thread, threadId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      setStatus("Sign in to send messages.");
      return;
    }

    if (!thread || !thread.participants.includes(currentUser.$id)) {
      setStatus("You no longer have access to this conversation.");
      return;
    }

    if (!newMessage.trim()) return;

    const txt = newMessage.trim();
    setNewMessage("");
    setStatus(null);

    try {
      await createDocument(
        COLLECTIONS.threadMessages,
        {
          thread_id: threadId,
          sender_id: currentUser.$id,
          sender_name: profile?.full_name || getDisplayName(currentUser),
          text: txt,
          created_at_ms: Date.now(),
        },
        sharedReadPermissions(thread.participants, [currentUser.$id]),
      );

      await updateDocument(COLLECTIONS.threads, threadId, {
        last_message: txt,
        updated_at_ms: Date.now(),
      });
    } catch (error) {
      console.error(error);
      setNewMessage(txt);
      setStatus("Message failed to send.");
    }
  }

  if (!currentUser) {
    return (
      <section className="card" style={{ padding: 40, textAlign: "center" }}>
        <h2>Private messages</h2>
        <p className="muted">Please sign in to open your direct conversations.</p>
        <Link href="/sign-in"><button className="primary" style={{ marginTop: 24 }}>Sign In</button></Link>
      </section>
    );
  }

  if (loadingThread) {
    return <p className="muted" style={{ padding: 32 }}>Loading conversation...</p>;
  }

  const isParticipant = Boolean(thread && thread.participants.includes(currentUser.$id));
  if (!thread || !isParticipant) {
    return (
      <section className="card" style={{ padding: 32 }}>
        <h2>Conversation unavailable</h2>
        <p className="muted">This thread does not exist or you do not have access to it anymore.</p>
        <Link href="/messages" className="ghost" style={{ display: "inline-flex", marginTop: 16 }}>
          Back to inbox
        </Link>
      </section>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}
    >
      <div style={{ marginBottom: "20px" }}>
        <Link href="/messages" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "16px", textDecoration: "none", fontSize: "0.9rem" }}>
          <ArrowLeft size={16} /> Back to Inbox
        </Link>
        <div className="card" style={{ padding: "16px 24px", display: "flex", alignItems: "center", gap: "16px" }}>
          <UserCircle size={32} color="var(--moss)" />
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
            {otherUser ? otherUser.name : "Loading..."}
          </h2>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(253, 251, 247, 0.4)" }}>
          {loadingMessages ? (
            <p className="muted">Loading messages...</p>
          ) : messages.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--moss)", opacity: 0.5 }}>
              <p>This is the start of your private conversation.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUser.$id;
              return (
                <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                  {!isMe && (
                    <span style={{ fontSize: "0.75rem", color: "rgba(16, 24, 32, 0.5)", marginBottom: 4, fontWeight: 600 }}>
                      {msg.sender_name}
                    </span>
                  )}
                  <div style={{
                    background: isMe ? "linear-gradient(120deg, var(--teal), var(--moss))" : "var(--cloud)",
                    color: isMe ? "white" : "var(--ink)",
                    padding: "10px 16px",
                    borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    boxShadow: "0 4px 12px rgba(16, 24, 32, 0.05)",
                    maxWidth: "75%"
                  }}>
                    <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endOfMessagesRef} />
        </div>
        
        <div style={{ padding: "16px", borderTop: "1px solid rgba(16, 24, 32, 0.08)", background: "var(--white)" }}>
          {isBlocked ? (
            <p className="notice" style={{ padding: "12px 16px", textAlign: "center" }}>This user has blocked you. You cannot send messages.</p>
          ) : (
            <form onSubmit={handleSendMessage} style={{ display: "flex", gap: "12px" }}>
              <input 
                type="text" 
                placeholder="Write a message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                style={{ flex: 1, padding: "12px 16px", borderRadius: "999px", background: "var(--cloud)", border: "1px solid rgba(16,24,32,0.1)" }}
              />
              <button type="submit" className="primary" disabled={!newMessage.trim()} style={{ width: 48, height: 48, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 24, flexShrink: 0 }}>
                <Send size={20} />
              </button>
            </form>
          )}
          {status && <p className="notice">{status}</p>}
        </div>
      </div>
    </motion.div>
  );
}
