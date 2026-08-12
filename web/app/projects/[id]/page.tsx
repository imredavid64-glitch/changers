"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, FolderKanban, Trash2, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, privateReadWritePermissions, updateDocument, watchDocument } from "@/lib/appwrite/bridge";
import { AppProject, AppProfile } from "@/lib/social/types";
import { STRAND_LABELS, getDisplayName, normalizeProfile, normalizeProject } from "@/lib/social/utils";
import { getDocument } from "@/lib/appwrite/bridge";
import { TaskBoard } from "@/components/TaskBoard";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user, profile: currentProfile } = useAuth();
  const [project, setProject] = useState<AppProject | null>(null);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, AppProfile | null>>({});
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

  useEffect(() => {
    if (!project) return;
    const projectMembers = project.members;
    let active = true;

    async function loadMembers() {
      const loaded: Record<string, AppProfile | null> = {};
      await Promise.all(
        projectMembers.map(async (memberId) => {
          const doc = await getDocument(COLLECTIONS.profiles, memberId);
          loaded[memberId] = doc ? normalizeProfile(doc.$id, doc) : null;
        }),
      );
      if (active) setMemberProfiles(loaded);
    }

    void loadMembers();
    return () => { active = false; };
  }, [project]);

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

      if (project.owner_id !== user.$id) {
        createDocument(
          COLLECTIONS.notifications,
          {
            user_id: project.owner_id,
            type: "project_invite",
            actor_name: currentProfile?.full_name || getDisplayName(user),
            actor_id: user.$id,
            project_id: project.id,
            read: false,
            message: `${currentProfile?.full_name || getDisplayName(user)} joined your project ${project.name}.`,
            created_at_ms: Date.now(),
          },
          privateReadWritePermissions(project.owner_id),
        ).catch(() => {});
      }
    } catch { setStatus("Failed to join."); }
  }

  async function handleSetStatus(nextStatus: AppProject["status"]) {
    if (!project) return;
    try {
      await updateDocument(COLLECTIONS.projects, projectId, {
        status: nextStatus,
        // eslint-disable-next-line react-hooks/purity -- Date.now() timestamps in event handlers are explicitly permitted by React.
        updated_at_ms: Date.now(),
      });
      setStatus(`Project marked as ${nextStatus}.`);
    } catch { setStatus("Failed to update status."); }
  }

  async function handleRemoveMember(memberId: string) {
    if (!project || !user) return;
    if (user.$id !== project.owner_id) { setStatus("Only the project owner can remove members."); return; }
    if (memberId === project.owner_id) { setStatus("You can't remove yourself as owner."); return; }

    const nextMembers = project.members.filter((id) => id !== memberId);
    try {
      await updateDocument(COLLECTIONS.projects, projectId, {
        members: nextMembers,
        member_count: nextMembers.length,
        // eslint-disable-next-line react-hooks/purity -- Date.now() timestamps in event handlers are explicitly permitted by React.
        updated_at_ms: Date.now(),
      });
      setStatus("Member removed.");
    } catch { setStatus("Failed to remove member."); }
  }

  if (loading) return <p className="muted" style={{ padding: 32 }}>Loading project...</p>;
  if (!project) return <section className="card"><h2>Project not found</h2></section>;

  const isMember = Boolean(user && project.members.includes(user.$id));
  const isOwner = Boolean(user && project.owner_id === user.$id);

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

        {isOwner && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["active", "completed", "paused"] as AppProject["status"][]).map((s) => (
              <button key={s} className={`filter ${project.status === s ? "active" : ""}`} onClick={() => handleSetStatus(s)}>
                {s === "active" ? "Mark active" : s === "completed" ? "Mark completed" : "Mark paused"}
              </button>
            ))}
          </div>
        )}

        {user && !isMember && (
          <button className="primary" onClick={handleJoin} style={{ alignSelf: "flex-start" }}>
            Join project
          </button>
        )}

        {isMember && !isOwner && (
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
        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {project.members.map((memberId) => {
            const memberProfile = memberProfiles[memberId];
            const isOwner = project.owner_id === memberId;
            return (
              <div key={memberId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--surface-card-solid)", border: "1px solid rgba(16,24,32,0.08)" }}>
                <Link href={`/profile/${memberId}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                  <p style={{ fontWeight: 600, color: "var(--ink)" }}>
                    {memberProfile?.full_name || "Changemaker"}
                    <span className="tag" style={{ marginLeft: 8 }}>{isOwner ? "Owner" : "Member"}</span>
                  </p>
                  <p className="muted" style={{ fontSize: "0.8rem" }}>{memberProfile?.role}</p>
                </Link>
                {isOwner && user?.$id === project.owner_id && memberId !== user.$id && (
                  <button className="ghost" onClick={() => handleRemoveMember(memberId)} style={{ color: "var(--coral)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Trash2 size={14} /> Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {project.status !== "completed" && (
        <section className="card">
          <TaskBoard project={project} />
        </section>
      )}
    </motion.div>
  );
}