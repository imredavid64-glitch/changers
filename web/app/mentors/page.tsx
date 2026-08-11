"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  getDocument,
  sharedReadPermissions,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppProfile } from "@/lib/social/types";
import { STRAND_LABELS, normalizeProfile } from "@/lib/social/utils";

export default function MentorsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mentors, setMentors] = useState<AppProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.profiles,
      [Query.equal("is_mentor", true), Query.limit(100)],
      (document) => normalizeProfile(document.$id, document),
      (loadedMentors) => {
        const sortedMentors = loadedMentors
          .filter((mentor) => mentor.is_mentor)
          .sort((a, b) => a.full_name.localeCompare(b.full_name));
        setMentors(sortedMentors);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setMentors([]);
        setStatus("Mentors could not load. Check your Appwrite profile collection.");
        setLoading(false);
      },
    );
  }, []);

  async function openMessageThread(mentor: AppProfile) {
    if (!user) {
      setStatus("Sign in to message mentors.");
      return;
    }

    const participants = [user.$id, mentor.id].sort();
    const threadId = `${participants[0]}_${participants[1]}`;

    try {
      const existingThread = await getDocument(COLLECTIONS.threads, threadId);
      if (!existingThread) {
        await createDocument(
          COLLECTIONS.threads,
          {
            participants,
            last_message: "",
            // eslint-disable-next-line react-hooks/purity -- Date.now() timestamps in event handlers are explicitly permitted by React.
            created_at_ms: Date.now(),
            // eslint-disable-next-line react-hooks/purity -- Date.now() timestamps in event handlers are explicitly permitted by React.
            updated_at_ms: Date.now(),
          },
          sharedReadPermissions(participants),
          threadId,
        );
      }

      setStatus(null);
      router.push(`/messages/${threadId}`);
    } catch (error) {
      console.error(error);
      setStatus("We couldn't open that direct message right now.");
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
            Mentor Network <Users size={24} style={{ display: "inline", marginLeft: 8, color: "var(--moss)", verticalAlign: "middle" }} />
          </h2>
          <p className="muted">People who opted in to coach founders, organizers, and changemaker teams.</p>
        </div>
        <Link href={user ? `/profile/${user.$id}` : "/sign-up"} className="primary">
          {user ? "Complete your profile" : "Join community"}
        </Link>
      </div>

      {status && <p className="notice" style={{ marginBottom: 16 }}>{status}</p>}

      <div className="mentor-grid" style={{ marginTop: 24 }}>
        {loading ? (
          <p className="muted">Loading mentor network...</p>
        ) : mentors.length === 0 ? (
          <p className="muted">No mentors have opted in yet. Turn on mentor mode from your profile to appear here.</p>
        ) : (
          mentors.map((mentor) => (
            <motion.div
              className="mentor-card"
              key={mentor.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{ display: "grid", gap: 14 }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {mentor.avatar_url ? (
                  <Image
                    src={mentor.avatar_url}
                    alt={mentor.full_name}
                    width={46}
                    height={46}
                    unoptimized
                    style={{ width: 46, height: 46, borderRadius: 23, objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      display: "grid",
                      placeItems: "center",
                      background: "linear-gradient(120deg, var(--sand), var(--sage))",
                    }}
                  >
                    <ShieldCheck size={22} color="var(--moss)" />
                  </div>
                )}
                <div>
                  <p className="mentor-name" style={{ marginBottom: 2 }}>{mentor.full_name}</p>
                  <p className="muted" style={{ fontSize: "0.9rem" }}>{mentor.role}</p>
                </div>
              </div>

              {mentor.headline && <p>{mentor.headline}</p>}
              {mentor.mentor_focus && <p className="muted">{mentor.mentor_focus}</p>}

              <div className="tag-row" style={{ margin: 0 }}>
                {mentor.interests.map((strand) => (
                  <span className="tag" key={strand}>{STRAND_LABELS[strand]}</span>
                ))}
              </div>

              <div className="button-row" style={{ flexWrap: "wrap" }}>
                <Link href={`/profile/${mentor.id}`} className="ghost" style={{ textAlign: "center" }}>
                  View profile
                </Link>
                {user?.$id !== mentor.id && (
                  <button className="primary" onClick={() => openMessageThread(mentor)}>
                    Message mentor
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}
