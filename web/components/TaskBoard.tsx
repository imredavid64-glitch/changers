"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, createDocument, deleteDocument, publicReadAuthenticatedUpdatePermissions, updateDocument, watchDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { AppProject, AppTask, TaskPriority, TaskStatus } from "@/lib/social/types";
import { getDisplayName, normalizeTask, timestampToMillis } from "@/lib/social/utils";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in-progress", label: "In progress" },
  { status: "done", label: "Done" },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: "rgba(44,138,125,0.15)",
  medium: "rgba(244,184,96,0.25)",
  high: "rgba(255,111,79,0.2)",
};

interface TaskBoardProps {
  project: AppProject;
}

export function TaskBoard({ project }: TaskBoardProps) {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canEdit = Boolean(user && project.members.includes(user.$id));

  useEffect(() => {
    return watchDocuments(
      COLLECTIONS.tasks,
      [Query.equal("project_id", project.id), Query.orderAsc("updated_at_ms")],
      (document) => normalizeTask(document.$id, document),
      (loadedTasks) => {
        setTasks(loadedTasks.sort((a, b) => timestampToMillis(b.updated_at) - timestampToMillis(a.updated_at)));
        setLoading(false);
      },
      () => {
        setTasks([]);
        setLoading(false);
      },
    );
  }, [project.id]);

  const byStatus = useMemo(() => {
    const grouped: Record<TaskStatus, AppTask[]> = { todo: [], "in-progress": [], done: [] };
    for (const task of tasks) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  const assigneeOptions = useMemo(
    () => project.members.filter((memberId) => memberId !== user?.$id),
    [project.members, user],
  );

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      const now = Date.now();
      const assigneeName = assigneeId
        ? assigneeId === user.$id
          ? profile?.full_name || getDisplayName(user)
          : project.members.includes(assigneeId)
            ? "Team member"
            : ""
        : "";
      await createDocument(
        COLLECTIONS.tasks,
        {
          project_id: project.id,
          title: title.trim(),
          description,
          status,
          assignee_id: assigneeId,
          assignee_name: assigneeName,
          priority,
          created_by: user.$id,
          created_at_ms: now,
          updated_at_ms: now,
        },
        publicReadAuthenticatedUpdatePermissions(user.$id),
      );
      setTitle("");
      setDescription("");
      setShowForm(false);
      setStatusMessage("Task created.");
    } catch (error) {
      setStatusMessage("Failed to create task.");
      console.error(error);
    }
    setSaving(false);
  }

  async function handleMove(task: AppTask, nextStatus: TaskStatus) {
    if (!canEdit) return;
    setMovingId(task.id);
    try {
      await updateDocument(COLLECTIONS.tasks, task.id, {
        status: nextStatus,
        updated_at_ms: Date.now(),
      });
    } catch (error) {
      setStatusMessage("Failed to move task.");
      console.error(error);
    }
    setMovingId(null);
  }

  async function handleAssign(task: AppTask, assigneeIdValue: string) {
    if (!canEdit) return;
    try {
      await updateDocument(COLLECTIONS.tasks, task.id, {
        assignee_id: assigneeIdValue,
        assignee_name: assigneeIdValue === user?.$id ? profile?.full_name || getDisplayName(user) : "",
        updated_at_ms: Date.now(),
      });
    } catch (error) {
      setStatusMessage("Failed to assign task.");
      console.error(error);
    }
  }

  async function handleDelete(task: AppTask) {
    if (!canEdit) return;
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(COLLECTIONS.tasks, task.id);
    } catch (error) {
      setStatusMessage("Failed to delete task.");
      console.error(error);
    }
  }

  if (!canEdit) {
    return (
      <div className="bridge-results">
        <p style={{ fontWeight: 700 }}>Project tasks</p>
        <p className="muted">Join this project to create and manage tasks with the team.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="section-header">
        <div>
          <h3 style={{ fontFamily: "var(--font-head)" }}>Project tasks</h3>
          <p className="muted">A shared Kanban board — updates appear for the whole team in real time.</p>
        </div>
        <button className="primary" onClick={() => setShowForm(!showForm)} disabled={saving}>
          {showForm ? "Cancel" : <><Plus size={16} style={{ marginRight: 6 }} /> Add task</>}
        </button>
      </div>

      {showForm && (
        <motion.form
          className="composer-form"
          onSubmit={handleCreate}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
          style={{ overflow: "hidden" }}
        >
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to happen? (optional)" style={{ minHeight: 70 }} />
          <div className="button-row" style={{ flexWrap: "wrap" }}>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label} priority</option>)}
            </select>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {project.members.map((memberId) => (
                <option key={memberId} value={memberId}>
                  {memberId === user?.$id ? `${profile?.full_name || getDisplayName(user)} (you)` : "Team member"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="primary" disabled={saving || !title.trim()}>
              {saving ? "Creating..." : "Create task"}
            </button>
          </div>
        </motion.form>
      )}

      {statusMessage && <p className="notice">{statusMessage}</p>}

      {loading ? (
        <p className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={16} className="spin" /> Loading tasks...
        </p>
      ) : tasks.length === 0 ? (
        <div className="bridge-results">
          <p style={{ fontWeight: 700 }}>No tasks yet</p>
          <p className="muted">Create the first task to get the board started.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {COLUMNS.map((col) => {
            const columnTasks = byStatus[col.status];
            return (
              <div
                key={col.status}
                style={{ padding: 12, borderRadius: 16, background: "rgba(16,24,32,0.04)", minHeight: 120 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: 1 }}>
                    {col.label}
                  </p>
                  <span className="chip">{columnTasks.length}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      style={{ padding: 12, borderRadius: 12, background: "white", border: "1px solid rgba(16,24,32,0.08)", boxShadow: "0 2px 8px rgba(16,24,32,0.04)" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <p style={{ fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.4 }}>{task.title}</p>
                        <button
                          onClick={() => void handleDelete(task)}
                          style={{ background: "none", border: "none", color: "var(--coral)", cursor: "pointer", padding: 2 }}
                          aria-label="Delete task"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {task.description && (
                        <p className="muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>{task.description}</p>
                      )}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        <span className="tag" style={{ background: PRIORITY_COLOR[task.priority] }}>
                          {task.priority}
                        </span>
                        {task.assignee_id && <span className="tag">{task.assignee_name || "Assignee"}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {COLUMNS.filter((c) => c.status !== task.status).map((c) => (
                          <button
                            key={c.status}
                            className="ghost"
                            onClick={() => void handleMove(task, c.status)}
                            disabled={movingId === task.id}
                            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                          >
                            {movingId === task.id ? "..." : c.status === "done" ? "✓ Done" : c.status === "in-progress" ? "→ Doing" : "↩ Back"}
                          </button>
                        ))}
                        <select
                          value={task.assignee_id}
                          onChange={(e) => void handleAssign(task, e.target.value)}
                          style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: 8, marginLeft: "auto" }}
                        >
                          <option value="">Assign</option>
                          {project.members.map((memberId) => (
                            <option key={memberId} value={memberId}>
                              {memberId === user?.$id ? "You" : "Team"}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
