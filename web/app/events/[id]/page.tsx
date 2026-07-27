"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Globe, MapPin, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  getDocument,
  listDocuments,
  privateReadWritePermissions,
  publicReadOwnerWritePermissions,
  watchDocument,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppEvent } from "@/lib/social/types";
import { STRAND_LABELS, getDisplayName, normalizeEvent, normalizeEventRsvp } from "@/lib/social/utils";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.id;
  const { user, profile } = useAuth();
  const [event, setEvent] = useState<AppEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [rsvpCount, setRsvpCount] = useState(0);

  useEffect(() => {
    return watchDocument(
      COLLECTIONS.events,
      eventId,
      (document) => normalizeEvent(document.$id, document),
      (nextEvent) => {
        setEvent(nextEvent);
        if (nextEvent) setRsvpCount(nextEvent.rsvp_count);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [eventId]);

  useEffect(() => {
    if (!user || !event) { setRsvpStatus(null); return; }
    getDocument(COLLECTIONS.eventRsvps, `${eventId}_${user.$id}`).then((doc) => {
      if (doc) setRsvpStatus(String(doc.status || ""));
    });
  }, [user, event, eventId]);

  async function handleRsvp(status: "going" | "interested" | "not_going") {
    if (!user || !event) { setStatus("Sign in to RSVP."); return; }
    try {
      const rsvpId = `${eventId}_${user.$id}`;
      const existing = await getDocument(COLLECTIONS.eventRsvps, rsvpId);
      if (existing) {
        const { updateDocument } = await import("@/lib/appwrite/bridge");
        await updateDocument(COLLECTIONS.eventRsvps, rsvpId, { status, created_at_ms: Date.now() });
      } else {
        await createDocument(
          COLLECTIONS.eventRsvps,
          { event_id: eventId, user_id: user.$id, user_name: profile?.full_name || getDisplayName(user), status, created_at_ms: Date.now() },
          privateReadWritePermissions(user.$id),
          rsvpId,
        );
      }
      setRsvpStatus(status);
      if (status === "going") setRsvpCount((c) => c + 1);

      if (event.host_id !== user.$id) {
        createDocument(
          COLLECTIONS.notifications,
          {
            user_id: event.host_id, type: "event_reminder",
            actor_name: profile?.full_name || getDisplayName(user), actor_id: user.$id,
            event_id: event.id, read: false,
            message: `${profile?.full_name || getDisplayName(user)} is going to ${event.title}.`,
            created_at_ms: Date.now(),
          },
          privateReadWritePermissions(event.host_id),
        ).catch(() => {});
      }
    } catch { setStatus("RSVP failed."); }
  }

  function formatDate(dateStr: string) {
    try { return new Date(dateStr).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }); }
    catch { return dateStr; }
  }

  if (loading) return <p className="muted" style={{ padding: 32 }}>Loading event...</p>;
  if (!event) return <section className="card"><h2>Event not found</h2></section>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: "grid", gap: 24 }}>
      <Link href="/events" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
        <ArrowLeft size={16} /> Back to events
      </Link>

      <section className="card" style={{ display: "grid", gap: 16 }}>
        <div>
          <p className="event-date">{formatDate(event.date)}{event.time ? ` at ${event.time}` : ""}</p>
          <h2>{event.title}</h2>
          {event.description && <p className="muted" style={{ marginTop: 8 }}>{event.description}</p>}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="strand">{STRAND_LABELS[event.strand]}</span>
          {event.location && <span className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><MapPin size={14} /> {event.location}</span>}
          {event.is_online && event.online_url && (
            <a href={event.online_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", gap: 4, alignItems: "center", color: "var(--teal)", fontWeight: 600 }}>
              <Globe size={14} /> Join online
            </a>
          )}
          <span className="muted" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><Users size={14} /> {rsvpCount} going</span>
          <span className="muted" style={{ fontSize: "0.85rem" }}>Hosted by {event.host_name}</span>
        </div>

        {user && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button className={rsvpStatus === "going" ? "primary" : "ghost"} onClick={() => handleRsvp("going")}>
              Going
            </button>
            <button className={rsvpStatus === "interested" ? "primary" : "ghost"} onClick={() => handleRsvp("interested")}>
              Interested
            </button>
            <button className={rsvpStatus === "not_going" ? "primary" : "ghost"} onClick={() => handleRsvp("not_going")}>
              Not going
            </button>
          </div>
        )}

        {event.tags.length > 0 && (
          <div className="tag-row">
            {event.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
          </div>
        )}

        {status && <p className="notice">{status}</p>}
      </section>
    </motion.div>
  );
}
