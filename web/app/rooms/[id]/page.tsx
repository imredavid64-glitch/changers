"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Hash, MessageSquare, Send, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  publicReadOwnerWritePermissions,
  updateDocument,
  watchDocument,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppRoom, TimestampLike } from "@/lib/social/types";
import { STRAND_LABELS, getDisplayName, normalizeRoom, timestampToMillis } from "@/lib/social/utils";

interface RoomMessage {
  id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at?: TimestampLike;
}

export default function RoomWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.id;
  const { user: currentUser, profile } = useAuth();

  const [room, setRoom] = useState<AppRoom | null>(null);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return watchDocument(
      COLLECTIONS.rooms,
      roomId,
      (document) => normalizeRoom(document.$id, document),
      (nextRoom) => {
        setRoom(nextRoom);
        setLoadingRoom(false);
      },
      (error) => {
        console.error(error);
        setRoom(null);
        setStatus("This room could not be loaded.");
        setLoadingRoom(false);
      },
    );
  }, [roomId]);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.roomMessages,
      [Query.equal("room_id", roomId), Query.orderAsc("created_at_ms"), Query.limit(500)],
      (document) => ({
        id: document.$id,
        author_id: String(document.author_id || ""),
        author_name: String(document.author_name || "Changemaker"),
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
        setStatus("Room messages could not load.");
        setLoadingMessages(false);
      },
    );
  }, [roomId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isMember = Boolean(currentUser && room?.members.includes(currentUser.$id));

  async function handleJoinRoom() {
    if (!currentUser || !room) {
      setStatus("Sign in to join this room.");
      return;
    }

    try {
      const nextMembers = Array.from(new Set([...room.members, currentUser.$id]));
      await updateDocument(COLLECTIONS.rooms, roomId, {
        members: nextMembers,
        member_count: nextMembers.length,
        updated_at_ms: Date.now(),
      });
      setStatus(`You joined ${room.name}.`);
    } catch (error) {
      setStatus("Joining the room failed.");
      console.error(error);
    }
  }

  async function handleSendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!currentUser || !room || !newMessage.trim() || !isMember) return;

    const text = newMessage.trim();
    setNewMessage("");
    setStatus(null);

    try {
      await createDocument(
        COLLECTIONS.roomMessages,
        {
          room_id: roomId,
          author_id: currentUser.$id,
          author_name: profile?.full_name || getDisplayName(currentUser),
          text,
          created_at_ms: Date.now(),
        },
        publicReadOwnerWritePermissions(currentUser.$id),
      );

      await updateDocument(COLLECTIONS.rooms, roomId, {
        last_message: text,
        updated_at_ms: Date.now(),
      });
    } catch (error) {
      setStatus("Message failed to send.");
      setNewMessage(text);
      console.error(error);
    }
  }

  if (loadingRoom) {
    return <p className="muted" style={{ padding: 40 }}>Loading workspace...</p>;
  }

  if (!room) {
    return (
      <section className="card" style={{ padding: 32 }}>
        <h2>Room not found</h2>
        <p className="muted">This collaboration room does not exist or is temporarily unavailable.</p>
      </section>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}
    >
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/rooms"
          className="muted"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16, fontWeight: 600 }}
        >
          <ArrowLeft size={16} /> Back to rooms
        </Link>

        <div className="card" style={{ padding: "20px 24px", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
                <Hash size={24} color="var(--moss)" /> {room.name}
              </h2>
              <p className="muted" style={{ marginTop: 6 }}>{room.description}</p>
            </div>
            <span className="strand">{STRAND_LABELS[room.strand]}</span>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Users size={16} /> {room.member_count} members
            </span>
            {!isMember && currentUser && (
              <button className="primary" onClick={handleJoinRoom}>
                Join room
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "rgba(253, 251, 247, 0.4)",
          }}
        >
          {loadingMessages ? (
            <p className="muted">Loading conversation...</p>
          ) : messages.length === 0 ? (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--moss)", opacity: 0.65 }}>
              <MessageSquare size={48} style={{ margin: "0 auto 16px" }} />
              <p>Welcome to the beginning of the {room.name} room.</p>
              <p style={{ fontSize: "0.85rem" }}>
                {isMember ? "Say hello to kick things off." : "Join the room to take part in the conversation."}
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.author_id === currentUser?.$id;
              return (
                <div key={message.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                  <span style={{ fontSize: "0.75rem", color: "rgba(16, 24, 32, 0.5)", marginBottom: 4, fontWeight: 600 }}>
                    {message.author_name}
                  </span>
                  <div
                    style={{
                      background: isMe ? "linear-gradient(120deg, var(--teal), var(--moss))" : "var(--cloud)",
                      color: isMe ? "white" : "var(--ink)",
                      padding: "12px 16px",
                      borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      boxShadow: "0 4px 12px rgba(16, 24, 32, 0.05)",
                      maxWidth: "80%",
                    }}
                  >
                    <p style={{ margin: 0 }}>{message.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div style={{ padding: 16, borderTop: "1px solid rgba(16, 24, 32, 0.08)", background: "var(--white)" }}>
          <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 12 }}>
            <input
              type="text"
              placeholder={
                !currentUser
                  ? "Sign in to join the room"
                  : isMember
                    ? `Message #${room.name}`
                    : "Join the room to send messages"
              }
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              disabled={!currentUser || !isMember}
              style={{ flex: 1, padding: "12px 16px", borderRadius: 999 }}
            />
            <button
              type="submit"
              className="primary"
              disabled={!currentUser || !isMember || !newMessage.trim()}
              style={{ width: 48, height: 48, padding: 0, display: "grid", placeItems: "center", flexShrink: 0 }}
            >
              <Send size={18} />
            </button>
          </form>
          {status && <p className="notice">{status}</p>}
        </div>
      </div>
    </motion.div>
  );
}
