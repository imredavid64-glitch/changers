"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FolderKanban, Plus, Search, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  COLLECTIONS,
  createDocument,
  publicReadMemberUpdatePermissions,
  updateDocument,
  watchDocuments,
} from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppProject, Strand } from "@/lib/social/types";
import { STRAND_LABELS, STRAND_OPTIONS, buildSearchIndex, normalizeProject, parseTagInput, timestampToMillis } from "@/lib/social/utils";
import { ProjectIdea, callGenerateProjectIdeas } from "@/lib/ai/tools";
import { refreshBadges } from "@/lib/badges/refresh";

type SortMode = "recent" | "members" | "name";

export default function ProjectsPage() {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<AppProject[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [strandFilter, setStrandFilter] = useState<Strand | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AppProject["status"] | "all">("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [onlyInterests, setOnlyInterests] = useState(false);
  const [savedProjectIds, setSavedProjectIds] = useState<string[]>(
    Array.isArray(profile?.saved_project_ids) ? profile!.saved_project_ids : [],
  );
  const [showIdeaGen, setShowIdeaGen] = useState(false);
  const [ideaStrand, setIdeaStrand] = useState<Strand>("S");
  const [ideas, setIdeas] = useState<ProjectIdea[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);

  useEffect(() => {
    setSavedProjectIds(Array.isArray(profile?.saved_project_ids) ? profile!.saved_project_ids : []);
  }, [profile]);

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.projects,
      [Query.orderDesc("updated_at_ms"), Query.limit(200)],
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

  const preferredStrands = (profile?.interests?.length ? profile.interests : ["S"]) as Strand[];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = projects.filter((project) => {
      if (strandFilter !== "all" && project.strand !== strandFilter) return false;
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (onlyInterests && !preferredStrands.includes(project.strand)) return false;
      if (query) {
        const haystack = [
          project.name,
          project.description,
          project.owner_name,
          STRAND_LABELS[project.strand],
          ...project.tags,
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    if (sortMode === "recent") list = [...list].sort((a, b) => timestampToMillis(b.updated_at) - timestampToMillis(a.updated_at));
    else if (sortMode === "members") list = [...list].sort((a, b) => b.member_count - a.member_count);
    else list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [projects, search, strandFilter, statusFilter, onlyInterests, preferredStrands, sortMode]);

  const suggested = useMemo(() => {
    if (!user || !preferredStrands.length) return [];
    return projects
      .filter((project) => preferredStrands.includes(project.strand) && !project.members.includes(user.$id))
      .sort((a, b) => b.member_count - a.member_count)
      .slice(0, 3);
  }, [projects, preferredStrands, user]);

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
          search_index: buildSearchIndex([name, description, profile?.full_name || user.name || "", tags, STRAND_LABELS[strand]]),
          owner_id: user.$id,
          owner_name: profile?.full_name || user.name || "Changemaker",
          members: [user.$id],
          member_count: 1,
          status: "active",
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadMemberUpdatePermissions(user.$id, []),
      );
      event.currentTarget.reset();
      setIsCreating(false);
      setStatus("Project created.");
      void refreshBadges(user.$id).then((badgeResult) => {
        if (badgeResult?.newlyAwarded?.length) {
          setStatus(`🏆 Badge earned: ${badgeResult.newlyAwarded[0].badge_name}!`);
        }
      });
    } catch (error) {
      setStatus("Project creation failed.");
      console.error(error);
    }
  }

  async function handleGenerateIdeas() {
    setGeneratingIdeas(true);
    setStatus(null);
    try {
      const result = await callGenerateProjectIdeas(ideaStrand);
      setIdeas(result.ideas);
      setShowIdeaGen(true);
    } catch (error) {
      setIdeas([]);
      setStatus("Idea generation failed. Please try again.");
      console.error(error);
    }
    setGeneratingIdeas(false);
  }

  function handleUseIdea() {
    if (ideaStrand) {
      setIdeaStrand(ideaStrand);
    }
    setIsCreating(true);
  }

  async function handleJoinProject(project: AppProject) {
    if (!user) { setStatus("Sign in to join projects."); return; }
    if (project.members.includes(user.$id)) { setStatus("You are already a member."); return; }

    const nextMembers = [...project.members, user.$id];
    try {
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

  async function toggleInterested(project: AppProject) {
    if (!user) { setStatus("Sign in to save projects you are interested in."); return; }

    const has = savedProjectIds.includes(project.id);
    const next = has ? savedProjectIds.filter((id) => id !== project.id) : [...savedProjectIds, project.id];

    setSavedProjectIds(next);
    try {
      await updateDocument(COLLECTIONS.profiles, user.$id, {
        saved_project_ids: next,
        updated_at_ms: Date.now(),
      });
      setStatus(has ? `Removed ${project.name} from your interests.` : `Saved ${project.name} to your interests.`);
    } catch (error) {
      console.error(error);
      setSavedProjectIds(savedProjectIds);
      setStatus("Failed to update interest.");
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
          <p className="muted">Discover changemaker projects and build together with teams that share your interests.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="ghost" onClick={() => setShowIdeaGen(!showIdeaGen)} disabled={!user}>
            <Sparkles size={16} style={{ marginRight: 6 }} />
            {showIdeaGen ? "Close ideas" : "AI project ideas"}
          </button>
          <button className="primary" onClick={() => setIsCreating(!isCreating)} disabled={!user}>
            {isCreating ? "Cancel" : <><Plus size={16} style={{ marginRight: 6 }} /> New Project</>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showIdeaGen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div className="card" style={{ padding: 20, background: "linear-gradient(135deg, rgba(255,111,79,0.08), rgba(244,184,96,0.12))" }}>
              <div className="section-header" style={{ marginBottom: 0 }}>
                <div>
                  <h3 style={{ fontFamily: "var(--font-head)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={18} color="var(--moss)" /> AI Project Idea Generator
                  </h3>
                  <p className="muted">Pick an impact strand and get changemaker project ideas you could launch.</p>
                </div>
              </div>
              <div className="button-row" style={{ marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={ideaStrand}
                  onChange={(e) => setIdeaStrand(e.target.value as Strand)}
                  style={{ width: "auto" }}
                >
                  {STRAND_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button className="primary" onClick={() => void handleGenerateIdeas()} disabled={generatingIdeas}>
                  {generatingIdeas ? "Generating..." : "Generate ideas"}
                </button>
              </div>

              {ideas.length > 0 && (
                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  {ideas.map((idea) => (
                    <div
                      key={idea.title}
                      style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 14, borderRadius: 14, background: "white", border: "1px solid rgba(16,24,32,0.08)" }}
                    >
                      <div>
                        <p style={{ fontWeight: 700, fontSize: "0.95rem" }}>{idea.title}</p>
                        <p className="muted" style={{ fontSize: "0.85rem" }}>{idea.description}</p>
                      </div>
                      <button className="ghost" onClick={() => handleUseIdea()}>
                        Use idea
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {suggested.length > 0 && (
        <div className="card" style={{ padding: 20, background: "linear-gradient(135deg, rgba(44,138,125,0.08), rgba(244,184,96,0.1))" }}>
          <div className="section-header" style={{ marginBottom: 0 }}>
            <div>
              <h3 style={{ fontFamily: "var(--font-head)" }}>✨ Suggested for you</h3>
              <p className="muted">Projects aligned with your {preferredStrands.map((s) => STRAND_LABELS[s]).join(", ")} interests.</p>
            </div>
          </div>
          <div className="project-grid" style={{ marginTop: 16 }}>
            {suggested.map((project) => {
              const isSaved = savedProjectIds.includes(project.id);
              return (
                <div className="project-card" key={project.id} style={{ display: "grid", gap: 10 }}>
                  <div>
                    <p className="collab-title">{project.name}</p>
                    <p className="muted" style={{ fontSize: "0.9rem" }}>{project.description}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="tag">{STRAND_LABELS[project.strand]}</span>
                    <span className="tag">{project.member_count} members</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/projects/${project.id}`} style={{ flex: 1, textDecoration: "none" }}>
                      <button className="ghost full">View project</button>
                    </Link>
                    <button className={isSaved ? "primary" : "ghost"} onClick={() => toggleInterested(project)}>
                      {isSaved ? "★ Saved" : "☆ Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      <div className="composer-form" style={{ display: "grid", gap: 12, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--moss)", opacity: 0.7 }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name, tag, or owner"
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select value={strandFilter} onChange={(e) => setStrandFilter(e.target.value as Strand | "all")}>
            <option value="all">All strands</option>
            {STRAND_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AppProject["status"] | "all")}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
          </select>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            <option value="recent">Sort: Recently updated</option>
            <option value="members">Sort: Most members</option>
            <option value="name">Sort: Name A→Z</option>
          </select>
        </div>
        <div className="filter-row">
          <button
            className={`filter ${onlyInterests ? "active" : ""}`}
            onClick={() => setOnlyInterests((value) => !value)}
            title="Only show projects matching your selected impact strands"
          >
            My interests only
          </button>
          {savedProjectIds.length > 0 && (
            <span className="muted" style={{ fontSize: "0.85rem", alignSelf: "center" }}>
              {savedProjectIds.length} saved to interests
            </span>
          )}
        </div>
      </div>

      {status && <p className="notice" style={{ marginBottom: 16 }}>{status}</p>}

      <div className="project-grid">
        {loading ? (
          <p className="muted">Loading projects...</p>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "48px 24px", background: "white" }}>
            <div style={{ fontSize: "2.6rem", marginBottom: 12 }}>🔎</div>
            <p className="muted">No projects match those filters. Try widening your search.</p>
          </div>
        ) : (
          filtered.map((project) => {
            const isSaved = savedProjectIds.includes(project.id);
            const isInterested = preferredStrands.includes(project.strand);
            return (
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
                  <span className="muted" style={{ fontSize: "0.85rem" }}>
                    by {project.owner_name} {isInterested && <span className="tag">matches your interests</span>}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Link href={`/projects/${project.id}`} style={{ flex: 1, textDecoration: "none" }}>
                    <button className="ghost full">View project</button>
                  </Link>
                  {user && !project.members.includes(user.$id) && (
                    <button className="primary" onClick={() => handleJoinProject(project)}>Join</button>
                  )}
                  <button
                    className={isSaved ? "primary" : "ghost"}
                    onClick={() => toggleInterested(project)}
                    title={isSaved ? "Remove from interests" : "Mark as interested"}
                  >
                    {isSaved ? "★ Saved" : "☆ Interested"}
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.section>
  );
}