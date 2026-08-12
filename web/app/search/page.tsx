"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Calendar, FolderKanban, Hash, MessageSquare, Search as SearchIcon, UserCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { COLLECTIONS, listDocuments } from "@/lib/appwrite/bridge";
import { Query } from "@/lib/appwrite/client";
import { appwriteEnabled } from "@/lib/appwrite/config";
import { normalizeCodeSnippet, normalizeDesign, normalizeDocument, normalizeEvent, normalizeFilm, normalizePost, normalizeProfile, normalizeProject, normalizeRoom, normalizeSlideshow, normalizeTable } from "@/lib/social/utils";
import { buildCodeSearchIndex, buildDesignSearchIndex, buildDocumentSearchIndex, buildSlideshowSearchIndex, buildTableSearchIndex, buildFilmSearchIndex } from "@/lib/social/toolSearch";

type SearchType = "all" | "profiles" | "posts" | "rooms" | "projects" | "events" | "tools";

type SearchResult = {
  id: string;
  type: Exclude<SearchType, "all">;
  title: string;
  subtitle: string;
  href: string;
  score: number;
};

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreText(index: string, tokens: string[]) {
  return tokens.reduce((score, token) => {
    if (!index) return score;
    if (index === token) return score + 16;
    if (index.startsWith(token)) return score + 10;
    if (index.includes(` ${token}`) || index.includes(token)) return score + 5;
    return score;
  }, 0);
}

function SearchResults() {
  const searchParams = useSearchParams();
  const rawQuery = searchParams.get("q") || "";
  const queryText = rawQuery.trim();

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SearchType>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // The empty-query and no-backend cases are handled by the derived visible* values
    // below, so the effect never resets state synchronously.
    if (!queryText || !appwriteEnabled) return;

    async function performSearch() {
      setLoading(true);
      setStatus(null);
      const tokens = tokenize(queryText);

      try {
        const [profileDocuments, postDocuments, roomDocuments, projectDocuments, eventDocuments, documentDocuments, slideshowDocuments, tableDocuments, codeSnippetDocuments, designDocuments, filmDocuments] = await Promise.all([
          listDocuments(COLLECTIONS.profiles, [Query.limit(200)]),
          listDocuments(COLLECTIONS.posts, [Query.limit(200)]),
          listDocuments(COLLECTIONS.rooms, [Query.limit(200)]),
          listDocuments(COLLECTIONS.projects, [Query.limit(200)]),
          listDocuments(COLLECTIONS.events, [Query.limit(200)]),
          listDocuments(COLLECTIONS.documents, [Query.limit(200)]),
          listDocuments(COLLECTIONS.slideshows, [Query.limit(200)]),
          listDocuments(COLLECTIONS.tables, [Query.limit(200)]),
          listDocuments(COLLECTIONS.codeSnippets, [Query.limit(200)]),
          listDocuments(COLLECTIONS.designs, [Query.limit(200)]),
          listDocuments(COLLECTIONS.films, [Query.limit(200)]),
        ]);

        const profileResults = profileDocuments
          .map((document) => normalizeProfile(document.$id, document))
          .map((profile) => ({
            id: profile.id,
            type: "profiles" as const,
            title: profile.full_name,
            subtitle: [profile.role, profile.location].filter(Boolean).join(" · "),
            href: `/profile/${profile.id}`,
            score: scoreText(profile.search_index, tokens),
          }))
          .filter((result) => result.score > 0);

        const postResults = postDocuments
          .map((document) => normalizePost(document.$id, document))
          .map((post) => ({
            id: post.id,
            type: "posts" as const,
            title: post.title,
            subtitle: `${post.author_name} · ${post.body.slice(0, 80)}${post.body.length > 80 ? "..." : ""}`,
            href: `/posts/${post.id}`,
            score: scoreText(post.search_index, tokens) + post.likes_count + post.comments_count,
          }))
          .filter((result) => result.score > 0);

        const roomResults = roomDocuments
          .map((document) => normalizeRoom(document.$id, document))
          .map((room) => ({
            id: room.id,
            type: "rooms" as const,
            title: room.name,
            subtitle: room.description,
            href: `/rooms/${room.id}`,
            score: scoreText(room.search_index, tokens) + room.member_count,
          }))
          .filter((result) => result.score > 0);

        const projectResults = projectDocuments
          .map((document) => normalizeProject(document.$id, document))
          .map((project) => ({
            id: project.id,
            type: "projects" as const,
            title: project.name,
            subtitle: project.description,
            href: `/projects/${project.id}`,
            score: scoreText(project.search_index, tokens) + project.member_count,
          }))
          .filter((result) => result.score > 0);

        const eventResults = eventDocuments
          .map((document) => normalizeEvent(document.$id, document))
          .map((evt) => ({
            id: evt.id,
            type: "events" as const,
            title: evt.title,
            subtitle: evt.description || evt.location || evt.date,
            href: `/events/${evt.id}`,
            score: scoreText(evt.search_index, tokens) + evt.rsvp_count,
          }))
          .filter((result) => result.score > 0);

        const toolResults = [
          ...documentDocuments.map((document) => normalizeDocument(document.$id, document)).map((doc) => ({
            id: doc.id,
            type: "tools" as const,
            title: doc.title,
            subtitle: `${doc.body.slice(0, 80)}${doc.body.length > 80 ? "..." : ""}`,
            href: `/documents/${doc.id}`,
            score: scoreText(buildDocumentSearchIndex(doc.title, doc.body), tokens) + doc.word_count,
          })),
          ...slideshowDocuments.map((document) => normalizeSlideshow(document.$id, document)).map((show) => ({
            id: show.id,
            type: "tools" as const,
            title: show.title,
            subtitle: show.slides[0]?.heading || `${show.slide_count} slides`,
            href: `/slideshows/${show.id}`,
            score: scoreText(buildSlideshowSearchIndex(show.title, show.slides), tokens) + show.slide_count,
          })),
          ...tableDocuments.map((document) => normalizeTable(document.$id, document)).map((table) => ({
            id: table.id,
            type: "tools" as const,
            title: table.title,
            subtitle: `${table.rows} × ${table.cols} table`,
            href: `/tools/tables/${table.id}`,
            score: scoreText(buildTableSearchIndex(table.title, table.data), tokens),
          })),
          ...codeSnippetDocuments.map((document) => normalizeCodeSnippet(document.$id, document)).map((snippet) => ({
            id: snippet.id,
            type: "tools" as const,
            title: snippet.title,
            subtitle: snippet.language,
            href: `/tools/code/${snippet.id}`,
            score: scoreText(buildCodeSearchIndex(snippet.title, snippet.language, snippet.code), tokens),
          })),
          ...designDocuments.map((document) => normalizeDesign(document.$id, document)).map((design) => ({
            id: design.id,
            type: "tools" as const,
            title: design.title,
            subtitle: "Design",
            href: `/tools/design/${design.id}`,
            score: scoreText(buildDesignSearchIndex(design.title), tokens),
          })),
          ...filmDocuments.map((document) => normalizeFilm(document.$id, document)).map((film) => ({
            id: film.id,
            type: "tools" as const,
            title: film.title,
            subtitle: film.scenes[0]?.setting || `${film.scene_count} scenes`,
            href: `/tools/films/${film.id}`,
            score: scoreText(buildFilmSearchIndex(film.title, film.scenes), tokens) + film.scene_count,
          })),
        ].filter((result) => result.score > 0);

        setResults(
          [...profileResults, ...postResults, ...roomResults, ...projectResults, ...eventResults, ...toolResults].sort((a, b) => b.score - a.score),
        );
      } catch (error) {
        console.error(error);
        setResults([]);
        setStatus("Search is temporarily unavailable. Check your Appwrite collections and indexes.");
      } finally {
        setLoading(false);
      }
    }

    void performSearch();
  }, [queryText]);

  const visibleResults =
    filter === "all" ? results : results.filter((result) => result.type === filter);
  // When the query is empty (or the backend is disabled), present the reset state
  // without writing it to state.
  const visibleLoading = queryText && appwriteEnabled ? loading : false;
  const visibleStatus = queryText
    ? appwriteEnabled
      ? status
      : "Add your Appwrite website environment variables to enable search."
    : null;

  return (
    <section className="card" style={{ minHeight: "60vh" }}>
      <div className="section-header">
        <div>
          <h2>Search Results</h2>
          <p className="muted">
            {visibleLoading ? "Searching Changers..." : `Found ${visibleResults.length} results for "${rawQuery}"`}
          </p>
        </div>

        <div className="filter-row">
          {[
            { key: "all", label: "All" },
            { key: "profiles", label: "People" },
            { key: "posts", label: "Posts" },
            { key: "projects", label: "Projects" },
            { key: "events", label: "Events" },
            { key: "rooms", label: "Rooms" },
            { key: "tools", label: "Tools" },
          ].map((item) => (
            <button
              key={item.key}
              className={`filter ${filter === item.key ? "active" : ""}`}
              onClick={() => setFilter(item.key as SearchType)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleLoading ? (
          <p className="muted">Searching across people, posts, and rooms...</p>
        ) : visibleStatus ? (
          <p className="notice">{visibleStatus}</p>
        ) : visibleResults.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--moss)", opacity: 0.5 }}>
            <SearchIcon size={48} style={{ margin: "0 auto 16px" }} />
            <p>No results found.</p>
            <p style={{ fontSize: "0.85rem" }}>Try a different name, tag, strand, or role.</p>
          </div>
        ) : (
          visibleResults.map((result) => {
            const Icon =
              result.type === "profiles"
                ? UserCircle
                : result.type === "posts"
                  ? MessageSquare
                  : result.type === "projects"
                    ? FolderKanban
                    : result.type === "events"
                      ? Calendar
                      : Hash;

            return (
              <Link key={`${result.type}-${result.id}`} href={result.href} style={{ textDecoration: "none", color: "inherit" }}>
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(16,24,32,0.08)",
                    display: "flex",
                    gap: "16px",
                    alignItems: "center",
                    background: "var(--surface-card-solid)",
                    transition: "all 0.2s ease",
                  }}
                  className="hover-lift"
                >
                  <div
                    style={{
                      background: "color-mix(in srgb, var(--teal) 10%, transparent)",
                      padding: "12px",
                      borderRadius: "8px",
                      color: "var(--moss)",
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, margin: 0, fontSize: "1.05rem" }}>{result.title}</p>
                    <p className="muted" style={{ margin: "2px 0 0 0", fontSize: "0.9rem" }}>
                      {result.subtitle}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="muted">Loading search...</p>}>
      <SearchResults />
    </Suspense>
  );
}
