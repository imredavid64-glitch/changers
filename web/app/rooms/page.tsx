"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, MonitorPlay, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  publicReadAuthenticatedUpdatePermissions,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppRoom, Strand } from "@/lib/social/types";
import { STRAND_LABELS, STRAND_OPTIONS, buildRoomSearchIndex, getDisplayName, normalizeRoom, parseTagInput } from "@/lib/social/utils";

export default function RoomsPage() {
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<AppRoom[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.rooms,
      [Query.orderDesc("updated_at_ms"), Query.limit(100)],
      (document) => normalizeRoom(document.$id, document),
      (loadedRooms) => {
        setRooms(loadedRooms);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setRooms([]);
        setStatus("Rooms could not load. Check your Appwrite room collection.");
        setLoading(false);
      },
    );
  }, []);

  async function handleCreateRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setStatus("Sign in to create a room.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const strand = String(formData.get("strand") || "S") as Strand;
    const tags = parseTagInput(String(formData.get("tags") || ""));

    if (!name || !description) {
      setStatus("Add both a room name and a description.");
      return;
    }

    try {
      const now = Date.now();
      await createDocument(
        COLLECTIONS.rooms,
        {
          name,
          description,
          strand,
          tags,
          search_index: buildRoomSearchIndex({
            name,
            description,
            owner_name: profile?.full_name || getDisplayName(user),
            tags,
            strand,
          }),
          owner_id: user.$id,
          owner_name: profile?.full_name || getDisplayName(user),
          members: [user.$id],
          member_count: 1,
          last_message: "",
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadAuthenticatedUpdatePermissions(user.$id),
      );

      event.currentTarget.reset();
      setIsCreating(false);
      setStatus("Room created.");
    } catch (error) {
      setStatus("Room creation failed.");
      console.error(error);
    }
  }

  return (
    <motion.section
      className="card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="section-header">
        <div>
          <h2>
            Co-Lab Rooms <MonitorPlay size={24} style={{ display: "inline", marginLeft: 8, color: "var(--moss)", verticalAlign: "middle" }} />
          </h2>
          <p className="muted">Persistent spaces for project chat, planning, and quick collaboration sprints.</p>
        </div>
        <button className="primary" onClick={() => setIsCreating((prev) => !prev)} disabled={!user}>
          {isCreating ? "Cancel" : "Create room"}
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.form
            className="composer-form"
            onSubmit={handleCreateRoom}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            style={{ overflow: "hidden" }}
          >
            <input type="text" name="name" placeholder="Room name" required />
            <textarea
              name="description"
              placeholder="What is this room for and what kind of collaborators are welcome?"
              required
              style={{ minHeight: 90 }}
            />
            <div className="composer-actions">
              <div className="button-row" style={{ flexWrap: "wrap" }}>
                <select name="strand" defaultValue="S">
                  {STRAND_OPTIONS.map((strand) => (
                    <option key={strand.value} value={strand.value}>
                      {strand.label}
                    </option>
                  ))}
                </select>
                <input type="text" name="tags" placeholder="Tags, comma separated" />
              </div>
              <button type="submit" className="primary">Start collaborating</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {status && <p className="notice" style={{ marginBottom: 16 }}>{status}</p>}

      <div className="collab-grid">
        {loading ? (
          <p className="muted">Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <p className="muted">No rooms yet. Start the first collaboration hub.</p>
        ) : (
          rooms.map((room) => (
            <motion.div
              className="collab-card"
              key={room.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{ display: "grid", gap: 14 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <p className="collab-title" style={{ fontSize: "1.1rem", marginBottom: 8 }}>{room.name}</p>
                  <p className="muted" style={{ fontSize: "0.92rem" }}>{room.description}</p>
                </div>
                <span className="strand">{STRAND_LABELS[room.strand]}</span>
              </div>

              <div className="tag-row" style={{ margin: 0 }}>
                {room.tags.map((tag) => (
                  <span className="tag" key={tag}>#{tag}</span>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="muted" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <Users size={16} /> {room.member_count} members
                </span>
                {room.last_message && (
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    Last update: {room.last_message.slice(0, 50)}{room.last_message.length > 50 ? "..." : ""}
                  </span>
                )}
              </div>

              <Link href={`/rooms/${room.id}`} style={{ textDecoration: "none" }}>
                <button className="ghost full" style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <Hash size={16} /> Open room
                </button>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}
