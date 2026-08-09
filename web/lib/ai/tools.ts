export interface AISuggestion {
  id: string;
  type: "suggestion" | "completion" | "rewrite" | "summary";
  text: string;
  context: string;
}

export interface SlideTemplate {
  id: string;
  name: string;
  description: string;
  slides: SlideDefinition[];
}

export interface SlideDefinition {
  layout: "title" | "content" | "two-column" | "image" | "quote" | "impact" | "cta";
  heading: string;
  body: string;
}

export interface OutlineSection {
  heading: string;
  subpoints: string[];
}

export interface ProjectIdea {
  title: string;
  description: string;
  index: number;
}

export interface AIRewriteResult {
  rewritten: string;
  tone: string;
}

const SAMPLE_TEMPLATES: SlideTemplate[] = [
  {
    id: "project-pitch",
    name: "Project Pitch",
    description: "Present your changemaker project to an audience",
    slides: [
      { layout: "title", heading: "Project Name", body: "A subtitle or tagline" },
      { layout: "content", heading: "The Problem", body: "Describe the issue you are solving" },
      { layout: "two-column", heading: "Our Solution", body: "Left: approach | Right: impact" },
      { layout: "impact", heading: "Expected Impact", body: "Metrics and outcomes" },
      { layout: "cta", heading: "Join Us", body: "How to get involved" },
    ],
  },
  {
    id: "impact-report",
    name: "Impact Report",
    description: "Share your project's results and achievements",
    slides: [
      { layout: "title", heading: "Impact Report", body: "Quarter / Year" },
      { layout: "content", heading: "What We Did", body: "Summary of activities" },
      { layout: "impact", heading: "Key Metrics", body: "Numbers that matter" },
      { layout: "two-column", heading: "Challenges & Learnings", body: "Left: challenges | Right: lessons" },
      { layout: "cta", heading: "What's Next", body: "Future plans and how to support" },
    ],
  },
  {
    id: "workshop",
    name: "Workshop Deck",
    description: "Facilitate a changemaker workshop session",
    slides: [
      { layout: "title", heading: "Workshop Title", body: "Duration and target audience" },
      { layout: "content", heading: "Agenda", body: "List of activities and timing" },
      { layout: "two-column", heading: "Discussion Prompts", body: "Left: question | Right: activity" },
      { layout: "quote", heading: "Key Takeaway", body: "Inspiring quote or call to reflection" },
      { layout: "cta", heading: "Next Steps", body: "Action items and follow-up" },
    ],
  },
];

export function getSlideTemplates(): SlideTemplate[] {
  return SAMPLE_TEMPLATES;
}

export function getTemplateById(id: string): SlideTemplate | undefined {
  return SAMPLE_TEMPLATES.find((t) => t.id === id);
}

export function generateDocumentSuggestions(title: string, body: string): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  if (!body || body.length < 50) {
    suggestions.push({
      id: "expand-intro",
      type: "suggestion",
      text: "Consider adding more detail to your introduction — who is this for and why does it matter?",
      context: "introduction",
    });
  }

  const wordCount = body.split(/\s+/).length;
  if (wordCount < 100) {
    suggestions.push({
      id: "add-impact",
      type: "suggestion",
      text: "Documents with measurable impact statements are more persuasive. Add specific metrics or outcomes.",
      context: "body",
    });
  }

  const hasStrandKeywords = /nature|economy|society|wellbeing|climate|community|health/i.test(body);
  if (!hasStrandKeywords) {
    suggestions.push({
      id: "add-strand",
      type: "suggestion",
      text: "Mention which impact strand(s) your project addresses — Nature, Economy, Society, or Wellbeing.",
      context: "body",
    });
  }

  const hasCallToAction = /join|contact|email|next steps|get involved|sign up/i.test(body + title);
  if (!hasCallToAction) {
    suggestions.push({
      id: "add-cta",
      type: "suggestion",
      text: "Add a call to action at the end — tell readers what you want them to do next.",
      context: "closing",
    });
  }

  suggestions.push({
    id: "refine-clarity",
    type: "rewrite",
    text: "Try breaking long paragraphs into shorter sections with clear headings for better readability.",
    context: "formatting",
  });

  return suggestions;
}

export function generateSlideContent(templateId: string): { slides: SlideDefinition[] } {
  const template = getTemplateById(templateId);
  if (!template) {
    return { slides: [] };
  }
  return { slides: [...template.slides] };
}

export async function callAI<TAction extends string, TData, TResult>(
  action: TAction,
  data: TData,
): Promise<TResult> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `AI request failed with status ${response.status}`);
  }

  return (await response.json()) as TResult;
}

export function callAnalyzeDocument(title: string, content: string) {
  return callAI<"analyze-document", { title: string; content: string }, { suggestions: AISuggestion[] }>(
    "analyze-document",
    { title, content },
  );
}

export function callGenerateOutline(topic: string, audience?: string) {
  return callAI<"generate-outline", { topic: string; audience?: string }, { outline: OutlineSection[] }>(
    "generate-outline",
    { topic, audience },
  );
}

export function callRewriteDocument(content: string, tone: string) {
  return callAI<"rewrite-document", { content: string; tone: string }, AIRewriteResult>(
    "rewrite-document",
    { content, tone },
  );
}

export function callSummarizeDocument(content: string, maxSentences?: number) {
  return callAI<"summarize-document", { content: string; max_sentences?: number }, { summary: string }>(
    "summarize-document",
    { content, max_sentences: maxSentences },
  );
}

export function callSuggestTitles(content: string, topic?: string) {
  return callAI<"suggest-titles", { content: string; topic?: string }, { titles: string[] }>(
    "suggest-titles",
    { content, topic },
  );
}

export function callGenerateProjectIdeas(strand: string) {
  return callAI<"generate-project-ideas", { strand: string }, { ideas: ProjectIdea[] }>(
    "generate-project-ideas",
    { strand },
  );
}
