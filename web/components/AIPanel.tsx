"use client";

import { useState } from "react";
import { Sparkles, Wand2, FileText, ListTree, Type } from "lucide-react";
import { AISuggestion, OutlineSection, SustainabilityAnalysis, callAnalyzeDocument, callAnalyzeSustainability, callGenerateOutline, callRewriteDocument, callSummarizeDocument, callSuggestTitles } from "@/lib/ai/tools";

interface AIPanelProps {
  title: string;
  content: string;
  onApplyTitle?: (title: string) => void;
  onApplyContent?: (content: string) => void;
}

const TONES = [
  { value: "concise", label: "Concise" },
  { value: "persuasive", label: "Persuasive" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
];

export function AIPanel({ title, content, onApplyTitle, onApplyContent }: AIPanelProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [tone, setTone] = useState("concise");
  const [rewriteResult, setRewriteResult] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [sustainabilityTopic, setSustainabilityTopic] = useState("");
  const [sustainability, setSustainability] = useState<SustainabilityAnalysis | null>(null);

  async function run<T>(key: string, fn: () => Promise<T>) {
    setBusy(key);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI request failed. Please try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleAnalyze() {
    const result = await run("analyze", () => callAnalyzeDocument(title, content));
    if (result) setSuggestions(result.suggestions);
  }

  async function handleOutline() {
    const topic = title || content.slice(0, 60);
    const result = await run("outline", () => callGenerateOutline(topic, "changemakers"));
    if (result) setOutline(result.outline);
  }

  async function handleRewrite() {
    const result = await run("rewrite", () => callRewriteDocument(content, tone));
    if (result) setRewriteResult(result.rewritten);
  }

  async function handleSummarize() {
    const result = await run("summarize", () => callSummarizeDocument(content, 3));
    if (result) setSummary(result.summary);
  }

  async function handleTitles() {
    const result = await run("titles", () => callSuggestTitles(content, title));
    if (result) setTitles(result.titles);
  }

  async function handleSustainability() {
    const topic = sustainabilityTopic.trim() || title || content.slice(0, 80);
    if (!topic) return;
    const result = await run("sustainability", () => callAnalyzeSustainability(topic));
    if (result) setSustainability(result);
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="section-header">
        <h3 style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-head)" }}>
          <Sparkles size={18} color="var(--moss)" /> AI Assistant
        </h3>
      </div>

      {error && (
        <p className="notice" style={{ color: "var(--coral)" }}>{error}</p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <div className="button-row" style={{ flexWrap: "wrap" }}>
          <button className="ghost" onClick={handleAnalyze} disabled={busy !== null || !content.trim()}>
            {busy === "analyze" ? "Analyzing..." : "Analyze document"}
          </button>
          <button className="ghost" onClick={handleOutline} disabled={busy !== null}>
            {busy === "outline" ? "Building..." : "Generate outline"}
          </button>
          <button className="ghost" onClick={handleSummarize} disabled={busy !== null || !content.trim()}>
            {busy === "summarize" ? "Summarizing..." : "Summarize"}
          </button>
          <button className="ghost" onClick={handleTitles} disabled={busy !== null || !content.trim()}>
            {busy === "titles" ? "Suggesting..." : "Suggest titles"}
          </button>
        </div>

        <div className="button-row" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <select value={tone} onChange={(e) => setTone(e.target.value)} style={{ width: "auto" }}>
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            className="primary"
            onClick={handleRewrite}
            disabled={busy !== null || !content.trim()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Wand2 size={16} /> {busy === "rewrite" ? "Rewriting..." : "Rewrite tone"}
          </button>
          {rewriteResult && onApplyContent && (
            <button className="ghost" onClick={() => onApplyContent(rewriteResult)}>
              Apply rewrite
            </button>
          )}
        </div>
      </div>

      {rewriteResult && (
        <div className="bridge-results" style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> Rewritten ({tone})
          </p>
          <p className="muted" style={{ fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{rewriteResult}</p>
        </div>
      )}

      {summary && (
        <div className="bridge-results" style={{ marginTop: 12, background: "rgba(244,184,96,0.14)" }}>
          <p style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText size={14} /> Summary
          </p>
          <p className="muted" style={{ fontSize: "0.9rem" }}>{summary}</p>
          {onApplyContent && (
            <button className="ghost" onClick={() => onApplyContent(summary)} style={{ marginTop: 10 }}>
              Insert as opening summary
            </button>
          )}
        </div>
      )}

      {titles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Type size={14} /> Title suggestions
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {titles.map((t) => (
              <div key={t} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.9rem" }}>{t}</span>
                {onApplyTitle && (
                  <button className="ghost" onClick={() => onApplyTitle(t)} style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
                    Use
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Suggestions</p>
          <div style={{ display: "grid", gap: 8 }}>
            {suggestions.map((s) => (
              <div key={s.id} style={{ padding: 12, borderRadius: 14, background: "rgba(44,138,125,0.08)", fontSize: "0.9rem" }}>
                {s.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {outline.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <ListTree size={14} /> Outline
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {outline.map((section) => (
              <div key={section.heading} style={{ padding: 12, borderRadius: 14, background: "rgba(31,94,84,0.06)" }}>
                <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>{section.heading}</p>
                <ul style={{ marginTop: 6, paddingLeft: 18, display: "grid", gap: 2 }}>
                  {section.subpoints.map((point) => (
                    <li key={point} className="muted" style={{ fontSize: "0.85rem" }}>{point}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(16,24,32,0.08)" }}>
        <p style={{ fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          🌍 Sustainability Analyzer
        </p>
        <p className="muted" style={{ fontSize: "0.8rem", marginBottom: 10 }}>
          Score any topic for accuracy, bias, and environmental footprint.
        </p>
        <div className="button-row" style={{ alignItems: "center" }}>
          <input
            value={sustainabilityTopic}
            onChange={(e) => setSustainabilityTopic(e.target.value)}
            placeholder="Topic or query"
            style={{ flex: 1, padding: "10px 12px" }}
          />
          <button className="ghost" onClick={handleSustainability} disabled={busy !== null}>
            {busy === "sustainability" ? "Analyzing..." : "Analyze"}
          </button>
        </div>
        {sustainability && (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <div style={{ padding: 12, borderRadius: 14, background: "rgba(44,138,125,0.1)" }}>
              <p style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                Sustainability score: {Math.round(sustainability.sustainabilityScore * 100)}%
              </p>
              <p className="muted" style={{ fontSize: "0.8rem" }}>
                Accuracy {Math.round(sustainability.accuracy * 100)}% · Bias {Math.round(sustainability.bias * 100)}% ·
                ~{sustainability.environmental.energy_kwh.toFixed(4)} kWh · {sustainability.environmental.water_liters.toFixed(1)} L water
              </p>
            </div>
            {sustainability.sustainabilityTips.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                {sustainability.sustainabilityTips.map((tip) => (
                  <p key={tip} className="muted" style={{ fontSize: "0.85rem", background: "rgba(244,184,96,0.12)", padding: "10px 12px", borderRadius: 12 }}>{tip}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
