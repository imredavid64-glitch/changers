"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderKanban, Plus, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  publicReadAuthenticatedUpdatePermissions,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppProject, Strand } from "@/lib/social/types";
import { STRAND_LABELS, STRAND_OPTIONS, buildSearchIndex, getDisplayName, normalizeProject, parseTagInput } from "@/lib/social/utils";

export default function ProjectsPage() {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.projects,
      [Query.orderDesc("updated_at_ms"), Query.limit(100)],
      (document) => normalizeProject(document.$id, document),
      (loadedProjects) => {
        setProjects(loadedProjects);
        setLoading(false);
      },
      () => {
        setProjects([]);
        setLoading(false);
      },
    );
  }, []);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) { setStatus("Sign in to create a project."); return; }

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const strand = String(formData.get("strand") || "S") as Strand;
    const tags = parseTagInput(String(formData.get("tags") || ""));

    if (!name || !description) { setStatus("Add both a project name and description."); return; }

    try {
      const now = Date.now();
      await createDocument(
        COLLECTIONS.projects,
        {
          name, description, strand, tags,
          search_index: buildSearchIndex([name, description, profile?.full_name || getDisplayName(user), tags, STRAND_LABELS[strand]]),
          owner_id: user.$id,
          owner_name: profile?.full_name || getDisplayName(user),
          members: [user.$id],
          member_count: 1,
          status: "active",
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadAuthenticatedUpdatePermissions(user.$id),
      );
      event.currentTarget.reset();
      setIsCreating(false);
      setStatus("Project created.");
    } catch (error) {
      setStatus("Project creation failed.");
      console.error(error);
    }
  }

  async function handleJoinProject(project: AppProject) {
    if (!user) { setStatus("Sign in to join projects."); return; }
    if (project.members.includes(user.$id)) { setStatus("You are already a member."); return; }

    const nextMembers = [...project.members, user.$id];
    try {
      const { updateDocument } = await import("@/lib/appwrite/bridge");
      await updateDocument(COLLECTIONS.projects, project.id, {
        members: nextMembers,
        member_count: nextMembers.length,
        updated_at_ms: Date.now(),
      });
      setStatus(`You joined ${project.name}.`);
    } catch (error) {
      setStatus("Failed to join project.");
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
          <h2><FolderKanban size={24} style={{ display: "inline", marginRight: 8, color: "var(--moss)", verticalAlign: "middle" }} /> Projects</h2>
          <p className="muted">Launch changemaker projects and invite collaborators to build together.</p>
        </div>
        <button className="primary" onClick={() => setIsCreating(!isCreating)} disabled={!user}>
          {isCreating ? "Cancel" : <><Plus size={16} style={{ marginRight: 6 }} /> New Project</>}
        </button>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.form
            className="composer-form"
            onSubmit={handleCreateProject}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <input type="text" name="name" placeholder="Project name" required />
            <textarea name="description" placeholder="What is this project about?" required style={{ minHeight: 90 }} />
            <div className="composer-actions">
              <div className="button-row" style={{ flexWrap: "wrap" }}>
                <select name="strand" defaultValue="S">
                  {STRAND_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input type="text" name="tags" placeholder="Tags, comma separated" />
              </div>
              <button type="submit" className="primary">Launch project</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {status && <p className="notice" style={{ marginBottom: 16 }}>{status}</p>}

      <div className="project-grid">
        {loading ? (
          <p className="muted">Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className="muted">No projects yet. Start the first one.</p>
        ) : (
          projects.map((project) => (
            <motion.div
              className="project-card"
              key={project.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
              style={{ display: "grid", gap: 12 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <p className="collab-title">{project.name}</p>
                  <p className="muted" style={{ fontSize: "0.9rem" }}>{project.description}</p>
                </div>
                <span className={`strand ${project.status === "completed" ? "completed" : project.status === "paused" ? "paused" : ""}`}>
                  {project.status === "active" ? STRAND_LABELS[project.strand] : project.status}
                </span>
              </div>

              <div className="tag-row" style={{ margin: 0 }}>
                {project.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="muted" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <Users size={16} /> {project.member_count} members
                </span>
                <span className="muted" style={{ fontSize: "0.85rem" }}>by {project.owner_name}</span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/projects/${project.id}`} style={{ flex: 1, textDecoration: "none" }}>
                  <button className="ghost full">View project</button>
                </Link>
                {user && !project.members.includes(user.$id) && (
                  <button className="primary" onClick={() => handleJoinProject(project)}>Join</button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}
