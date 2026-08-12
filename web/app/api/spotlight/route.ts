import { NextRequest, NextResponse } from "next/server";
import { verifyAdminUser } from "@/lib/admin/server";
import {
  deleteSpotlight,
  getActiveSpotlight,
  listSpotlights,
  upsertSpotlight,
} from "@/lib/spotlight/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRANDS = ["N", "E", "S", "W"];

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/**
 * GET /api/spotlight — the active spotlight (public).
 * GET /api/spotlight?all=1 — every spotlight (admins only, for the dashboard).
 */
export async function GET(request: NextRequest) {
  const all = request.nextUrl.searchParams.get("all") === "1";
  if (all) {
    const auth = await verifyAdminUser(request);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status ?? 403 });
    }
    try {
      const spotlights = await listSpotlights();
      return NextResponse.json({ spotlights });
    } catch {
      return NextResponse.json(
        { error: "Could not load spotlights. Is DATABASE_URL set?" },
        { status: 503 },
      );
    }
  }

  try {
    const spotlight = await getActiveSpotlight();
    return NextResponse.json({ spotlight });
  } catch {
    return NextResponse.json({ spotlight: null, error: "Spotlight storage unavailable." });
  }
}

/** Admin: upsert a spotlight (create when no id, update otherwise). */
export async function POST(request: NextRequest) {
  const auth = await verifyAdminUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status ?? 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const title = cleanString(record.title, 120);
  const blurb = cleanString(record.blurb, 500);
  if (!title || !blurb) {
    return NextResponse.json({ error: "Title and blurb are required." }, { status: 400 });
  }

  const strand = cleanString(record.strand, 1);
  if (strand && !STRANDS.includes(strand)) {
    return NextResponse.json({ error: "Strand must be N, E, S, or W." }, { status: 400 });
  }

  const id = cleanString(record.id, 64);
  const input = {
    id: id || undefined,
    title,
    blurb,
    profileUrl: cleanString(record.profileUrl, 300) || null,
    projectUrl: cleanString(record.projectUrl, 300) || null,
    strand: strand || null,
    active: record.active === true,
  };

  try {
    const saved = await upsertSpotlight(input, "admin");
    return NextResponse.json({ spotlight: saved }, { status: id ? 200 : 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not save the spotlight. Is DATABASE_URL set?" },
      { status: 503 },
    );
  }
}

/** Admin: delete a spotlight by id. */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminUser(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status ?? 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  try {
    const deleted = await deleteSpotlight(id);
    if (!deleted) {
      return NextResponse.json({ error: "Spotlight not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not delete the spotlight. Is DATABASE_URL set?" },
      { status: 503 },
    );
  }
}
