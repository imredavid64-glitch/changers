"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Plus, Video } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  publicReadAuthenticatedUpdatePermissions,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppEvent, Strand } from "@/lib/social/types";
import { STRAND_LABELS, STRAND_OPTIONS, buildSearchIndex, getDisplayName, normalizeEvent, parseTagInput } from "@/lib/social/utils";

export default function EventsPage() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.events,
      [Query.orderDesc("created_at_ms"), Query.limit(100)],
      (document) => normalizeEvent(document.$id, document),
      (loadedEvents) => {
        setEvents(loadedEvents);
        setLoading(false);
      },
      () => { setEvents([]); setLoading(false); },
    );
  }, []);

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { setStatus("Sign in to create events."); return; }

    const formData = new FormData(event.currentTarget);
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const strand = String(formData.get("strand") || "S") as Strand;
    const date = String(formData.get("date") || "").trim();
    const time = String(formData.get("time") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const isOnline = formData.get("is_online") === "on";
    const onlineUrl = String(formData.get("online_url") || "").trim();
    const tags = parseTagInput(String(formData.get("tags") || ""));

    if (!title || !date) { setStatus("Event title and date are required."); return; }

    try {
      const now = Date.now();
      await createDocument(
        COLLECTIONS.events,
        {
          title, description, strand, date, time, location, is_online: isOnline, online_url: onlineUrl, tags,
          search_index: buildSearchIndex([title, description, location, tags, STRAND_LABELS[strand]]),
          host_id: user.$id,
          host_name: profile?.full_name || getDisplayName(user),
          rsvp_count: 0,
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadAuthenticatedUpdatePermissions(user.$id),
      );
      event.currentTarget.reset();
      setIsCreating(false);
      setStatus("Event created.");
    } catch (error) {
      setStatus("Event creation failed.");
      console.error(error);
    }
  }

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return dateStr; }
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
          <h2><Calendar size={24} style={{ display: "inline", marginRight: 8, color: "var(--moss)", verticalAlign: "middle" }} /> Events</h2>
          <p className="muted">Browse and host changemaker events, workshops, and meetups.</p>
        </div>
        <button className="primary" onClick={() => setIsCreating(!isCreating)} disabled={!user}>
          {isCreating ? "Cancel" : <><Plus size={16} style={{ marginRight: 6 }} /> New Event</>}
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.form
            className="composer-form"
            onSubmit={handleCreateEvent}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <input type="text" name="title" placeholder="Event title" required />
            <textarea name="description" placeholder="Describe the event" style={{ minHeight: 80 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input type="date" name="date" required />
              <input type="time" name="time" />
            </div>
            <input type="text" name="location" placeholder="Location (e.g. Room 204 or Berlin, Germany)" />
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="is_online" />
              <span>Online event</span>
            </label>
            <input type="url" name="online_url" placeholder="Video call link (if online)" />
            <div className="composer-actions">
              <div className="button-row" style={{ flexWrap: "wrap" }}>
                <select name="strand" defaultValue="S">
                  {STRAND_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input type="text" name="tags" placeholder="Tags, comma separated" />
              </div>
              <button type="submit" className="primary">Create event</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {status && <p className="notice" style={{ marginBottom: 16 }}>{status}</p>}

      <div className="event-grid">
        {loading ? (
          <p className="muted">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="muted">No events yet. Host the first one.</p>
        ) : (
          events.map((evt) => (
            <motion.div
              className="event-card"
              key={evt.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{ display: "grid", gap: 12 }}
            >
              <p className="event-date">{formatDate(evt.date)}{evt.time ? ` · ${evt.time}` : ""}</p>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <p className="collab-title">{evt.title}</p>
                  {evt.description && <p className="muted" style={{ fontSize: "0.9rem" }}>{evt.description}</p>}
                </div>
                <span className="strand">{STRAND_LABELS[evt.strand]}</span>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {evt.location && <span className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: "0.85rem" }}><MapPin size={14} /> {evt.location}</span>}
                {evt.is_online && <span className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center", fontSize: "0.85rem" }}><Video size={14} /> Online</span>}
                {evt.rsvp_count > 0 && <span className="chip">{evt.rsvp_count} going</span>}
              </div>

              <div className="tag-row" style={{ margin: 0 }}>
                {evt.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
              </div>

              <Link href={`/events/${evt.id}`} style={{ textDecoration: "none" }}>
                <button className="ghost full">View event</button>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}
