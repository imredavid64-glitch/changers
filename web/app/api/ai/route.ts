import { NextRequest, NextResponse } from "next/server";

const STRAND_INFO: Record<string, { label: string; ideas: string[] }> = {
  N: {
    label: "Nature",
    ideas: [
      "A school-wide composting program that turns cafeteria waste into soil for local gardens",
      "A neighborhood native-plant corridor that connects green spaces and supports pollinators",
      "A climate literacy workshop series taught by students to younger grades",
      "A plastic-free campus initiative with refill stations and reusable kit swaps",
      "A citizen-science water quality monitoring project for local streams",
    ],
  },
  E: {
    label: "Economy",
    ideas: [
      "A skills-share marketplace where students trade lessons in everything from coding to cooking",
      "A circular economy pop-up shop that repairs, swaps, and upcycles secondhand goods",
      "A financial literacy bootcamp that teaches budgeting and ethical investing",
      "A student-run cooperative café that reinvests profits into community projects",
      "A zero-waste packaging audit tool for local small businesses",
    ],
  },
  S: {
    label: "Society",
    ideas: [
      "A community storytelling zine that amplifies voices from underrepresented groups",
      "An intergenerational mentoring program pairing students with older residents",
      "A neighborhood repair café that builds connections while fixing broken items",
      "A digital inclusion drive collecting and refurbishing devices for families without access",
      "A community welcome kit for newcomers and refugee families",
    ],
  },
  W: {
    label: "Wellbeing",
    ideas: [
      "A 'mindful mornings' drop-in space with breathing exercises before class",
      "A peer-support walking group that combines movement with honest conversation",
      "A sleep hygiene challenge that helps students build healthier routines together",
      "A sensory garden designed as a calm-down space for overwhelmed students",
      "A gratitude wall that celebrates small daily wins and acts of kindness",
    ],
  },
};

function rewriteTone(content: string, tone: string): string {
  const paragraphs = content.split(/\n+/).map((p) => p.trim()).filter(Boolean);

  switch (tone) {
    case "concise": {
      return paragraphs
        .map((p) => {
          const sentences = p.split(/(?<=[.!?])\s+/).filter(Boolean);
          return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ");
        })
        .join("\n\n");
    }
    case "persuasive": {
      return paragraphs
        .map((p) => {
          const first = p[0]?.toUpperCase() ?? "";
          return `We should act now: ${first}${p.slice(1)}`;
        })
        .join("\n\n");
    }
    case "friendly": {
      return paragraphs
        .map((p) => {
          const greeting = "Here's something to think about: ";
          const hasGreeting = p.toLowerCase().startsWith("here's");
          return hasGreeting ? p : `${greeting}${p}`;
        })
        .join("\n\n");
    }
    case "formal": {
      return paragraphs
        .map((p) => {
          const replacements: [RegExp, string][] = [
            [/\bit's\b/gi, "it is"],
            [/\bdon't\b/gi, "do not"],
            [/\bcan't\b/gi, "cannot"],
            [/\bwon't\b/gi, "will not"],
            [/\bI'm\b/gi, "I am"],
            [/\bwe're\b/gi, "we are"],
            [/\byou're\b/gi, "you are"],
            [/\bwhat's\b/gi, "what is"],
            [/\bthat's\b/gi, "that is"],
          ];
          return replacements.reduce((text, [regex, replacement]) => text.replace(regex, replacement), p);
        })
        .join("\n\n");
    }
    default:
      return content;
  }
}

function summarizeContent(content: string, maxSentences = 3): string {
  const sentences = content.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return "";

  const stopWords = new Set(["and", "the", "of", "to", "in", "for", "on", "with", "a", "an"]);
  const scored = sentences.map((sentence) => {
    const words = sentence.toLowerCase().split(/\s+/).filter((w) => !stopWords.has(w));
    const score = words.reduce((sum, word) => sum + word.length, 0) / Math.max(words.length, 1);
    return { sentence, score };
  });

  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => scored.indexOf(a) - scored.indexOf(b));

  return top.map((t) => t.sentence).join(" ");
}

function suggestTitles(content: string, topic?: string): string[] {
  const words = content
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 3)
    .slice(0, 3);

  const topicLabel = (topic || "").trim() || (words.length ? words.join(" ") : "our changemaker project");

  return [
    `Building a Better Future: ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)}`,
    `How We're Making a Difference with ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)}`,
    `The Changemaker's Guide to ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)}`,
    `From Idea to Impact: ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)}`,
    `Together for Change: ${topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1)}`,
  ];
}

function generateProjectIdeas(strand: string): { title: string; description: string }[] {
  const info = STRAND_INFO[strand] || STRAND_INFO.S;
  return info.ideas.slice(0, 4).map((idea, index) => ({
    title: idea,
    description: `A ${info.label.toLowerCase()} strand project that turns a local challenge into an opportunity for changemakers.`,
    index,
  }));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    switch (action) {
      case "analyze-document": {
        const { title, content } = data || {};
        const suggestions = [];

        if (!content || content.length < 50) {
          suggestions.push({
            id: "expand-intro",
            type: "suggestion",
            text: "Consider adding more detail to your introduction — who is this for and why does it matter?",
            context: "introduction",
          });
        }

        const wordCount = (content || "").split(/\s+/).length;
        if (wordCount < 100) {
          suggestions.push({
            id: "add-impact",
            type: "suggestion",
            text: "Documents with measurable impact statements are more persuasive. Add specific metrics or outcomes.",
            context: "body",
          });
        }

        const hasStrand = /nature|economy|society|wellbeing|climate|community|health/i.test(content || "");
        if (!hasStrand) {
          suggestions.push({
            id: "add-strand",
            type: "suggestion",
            text: "Mention which impact strand(s) your project addresses — Nature, Economy, Society, or Wellbeing.",
            context: "body",
          });
        }

        const hasCTA = /join|contact|email|next steps|get involved|sign up/i.test((content || "") + (title || ""));
        if (!hasCTA) {
          suggestions.push({
            id: "add-cta",
            type: "suggestion",
            text: "Add a call to action at the end — tell readers what you want them to do next.",
            context: "closing",
          });
        }

        const longParagraphs = (content || "")
          .split(/\n+/)
          .filter((p: string) => p.trim().length > 400).length;
        if (longParagraphs > 0) {
          suggestions.push({
            id: "break-paragraphs",
            type: "rewrite",
            text: `You have ${longParagraphs} very long paragraph${longParagraphs > 1 ? "s" : ""}. Break them into shorter sections with headings for better readability.`,
            context: "formatting",
          });
        }

        if (wordCount > 800) {
          suggestions.push({
            id: "tighten-document",
            type: "summary",
            text: "This is a long document. Consider adding a short executive summary at the top for readers short on time.",
            context: "overview",
          });
        }

        return NextResponse.json({ suggestions });
      }

      case "generate-outline": {
        const { topic, audience } = data || {};
        if (!topic) {
          return NextResponse.json({ error: "Topic is required" }, { status: 400 });
        }

        const outline = [
          { heading: `Introduction to ${topic}`, subpoints: ["Context and background", "Why this matters", audience ? `Who this is for: ${audience}` : "Who this is for"] },
          { heading: "The Problem", subpoints: ["Current challenges", "Root causes", "Who is affected"] },
          { heading: "Our Approach", subpoints: ["Proposed solution", "Key activities", "Timeline"] },
          { heading: "Expected Impact", subpoints: ["Measurable outcomes", "Sustainability considerations"] },
          { heading: "Get Involved", subpoints: ["How to contribute", "Next steps"] },
        ];

        return NextResponse.json({ outline });
      }

      case "rewrite-document": {
        const { content, tone } = data || {};
        if (!content) {
          return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }
        const validTones = ["concise", "persuasive", "friendly", "formal"];
        const selectedTone = validTones.includes(tone) ? tone : "concise";
        return NextResponse.json({ rewritten: rewriteTone(content, selectedTone), tone: selectedTone });
      }

      case "summarize-document": {
        const { content, max_sentences } = data || {};
        if (!content) {
          return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }
        return NextResponse.json({ summary: summarizeContent(content, max_sentences || 3) });
      }

      case "suggest-titles": {
        const { content, topic } = data || {};
        if (!content && !topic) {
          return NextResponse.json({ error: "Content or topic is required" }, { status: 400 });
        }
        return NextResponse.json({ titles: suggestTitles(content || "", topic) });
      }

      case "generate-project-ideas": {
        const { strand } = data || {};
        return NextResponse.json({ ideas: generateProjectIdeas(strand || "S") });
      }

      case "analyze-sustainability": {
        const { topic } = data || {};
        if (!topic || typeof topic !== "string") {
          return NextResponse.json({ error: "Topic is required" }, { status: 400 });
        }

        try {
          const { SustainableAnalyst } = await import("@/src/lib/sustainable-ai");
          const analyst = new SustainableAnalyst();
          const result = await analyst.analyzeQuery(topic);
          return NextResponse.json(result);
        } catch (error) {
          console.error("Sustainability analysis error:", error);
          return NextResponse.json(
            { error: "Sustainability analysis failed. Please try again." },
            { status: 502 },
          );
        }
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
