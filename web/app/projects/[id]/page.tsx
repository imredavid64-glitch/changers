"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FolderKanban, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, updateDocument, watchDocument } from "@/lib/appwrite/bridge";
import { AppProject } from "@/lib/social/types";
import { STRAND_LABELS, normalizeProject } from "@/lib/social/utils";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user } = useAuth();
  const [project, setProject] = useState<AppProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return watchDocument(
      COLLECTIONS.projects,
      projectId,
      (document) => normalizeProject(document.$id, document),
      (nextProject) => {
        setProject(nextProject);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [projectId]);

  async function handleJoin() {
    if (!user || !project) return;
    if (project.members.includes(user.$id)) { setStatus("Already a member."); return; }
    const nextMembers = [...project.members, user.$id];
    try {
      await updateDocument(COLLECTIONS.projects, projectId, {
        members: nextMembers,
        member_count: nextMembers.length,
        updated_at_ms: Date.now(),
      });
      setStatus(`You joined ${project.name}.`);
    } catch { setStatus("Failed to join."); }
  }

  if (loading) return <p className="muted" style={{ padding: 32 }}>Loading project...</p>;
  if (!project) return <section className="card"><h2>Project not found</h2></section>;

  const isMember = user && project.members.includes(user.$id);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: "grid", gap: 24 }}>
      <Link href="/projects" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
        <ArrowLeft size={16} /> Back to projects
      </Link>

      <section className="card" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FolderKanban size={28} color="var(--moss)" /> {project.name}
            </h2>
            <p className="muted" style={{ marginTop: 8 }}>{project.description}</p>
          </div>
          <span className="strand">{STRAND_LABELS[project.strand]}</span>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Users size={16} /> {project.member_count} members
          </span>
          <span className="muted" style={{ fontSize: "0.85rem" }}>by {project.owner_name}</span>
          <span className={`tag ${project.status === "completed" ? "completed" : project.status === "paused" ? "paused" : ""}`}>
            {project.status}
          </span>
        </div>

        {user && !isMember && (
          <button className="primary" onClick={handleJoin} style={{ alignSelf: "flex-start" }}>
            Join project
          </button>
        )}

        {isMember && (
          <div className="bridge-results">
            <p style={{ fontWeight: 700, marginBottom: 4 }}>You are a member</p>
            <p className="muted">Collaborate with the team to move this project forward.</p>
          </div>
        )}

        {status && <p className="notice">{status}</p>}
      </section>

      <section className="card">
        <div className="section-header">
          <h3>Members</h3>
        </div>
        <p className="muted">{project.member_count} changemaker{project.member_count !== 1 ? "s" : ""} are part of this project.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {project.members.map((memberId) => (
            <Link key={memberId} href={`/profile/${memberId}`} style={{ textDecoration: "none" }}>
              <span className="chip">{memberId === project.owner_id ? "Owner" : "Member"}</span>
            </Link>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
