import { NextRequest, NextResponse } from "next/server";

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

        suggestions.push({
          id: "refine-clarity",
          type: "rewrite",
          text: "Try breaking long paragraphs into shorter sections with clear headings for better readability.",
          context: "formatting",
        });

        return NextResponse.json({ suggestions });
      }

      case "generate-outline": {
        const { topic, audience } = data || {};
        if (!topic) {
          return NextResponse.json({ error: "Topic is required" }, { status: 400 });
        }

        const outline = [
          { heading: `Introduction to ${topic}`, subpoints: ["Context and background", "Why this matters"] },
          { heading: "The Problem", subpoints: ["Current challenges", "Root causes", "Who is affected"] },
          { heading: "Our Approach", subpoints: ["Proposed solution", "Key activities", "Timeline"] },
          { heading: "Expected Impact", subpoints: ["Measurable outcomes", "Sustainability considerations"] },
          { heading: "Get Involved", subpoints: ["How to contribute", "Next steps"] },
        ];

        return NextResponse.json({ outline });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
