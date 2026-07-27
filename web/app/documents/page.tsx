"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

interface Document {
  id: string;
  title: string;
  updatedAt: string;
  wordCount: number;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents] = useState<Document[]>([]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Documents</h1>
          <p className="muted">Sign in to create and manage your documents.</p>
          <Link href="/sign-in" className="primary" style={{ textAlign: "center", display: "block", padding: 12, borderRadius: 999, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="section-header">
        <div>
          <p className="eyebrow">Collaborative documents</p>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-head)" }}>Documents</h1>
        </div>
        <Link href="/documents/new" className="primary" style={{ padding: "10px 20px", borderRadius: 999, textDecoration: "none" }}>
          + New document
        </Link>
      </div>

      {documents.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>📄</div>
          <h3 style={{ fontFamily: "var(--font-head)", marginBottom: 8 }}>No documents yet</h3>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
            Create your first collaborative document with AI-powered suggestions.
          </p>
          <Link href="/documents/new" className="primary" style={{ padding: "10px 24px", borderRadius: 999, textDecoration: "none", display: "inline-block" }}>
            Create your first document
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="card hover-lift"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none" }}
            >
              <div>
                <div className="collab-title" style={{ marginBottom: 4 }}>{doc.title}</div>
                <p className="muted" style={{ fontSize: "0.85rem" }}>
                  Updated {doc.updatedAt} · {doc.wordCount} words
                </p>
              </div>
              <span style={{ fontSize: "0.85rem", color: "var(--moss)", fontWeight: 600 }}>Edit →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
