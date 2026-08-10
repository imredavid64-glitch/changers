import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.APPWRITE_API_KEY?.trim();
  const adminEmail = process.env.ADMIN_EMAIL;
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";
  const profilesCollection = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES || "profiles";

  if (!apiKey || !projectId) {
    return NextResponse.json({ error: "APPWRITE_API_KEY not set on server." }, { status: 500 });
  }

  if (!adminEmail) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL not set on server. Contact the developer." },
      { status: 500 }
    );
  }

  try {
    // Only grant admin to the *authenticated session*. The userId/email in the
    // request body are attacker-controlled and must never be trusted: anyone
    // who knows the admin email could otherwise grant themselves admin.
    const user = await getAuthenticatedAppwriteUser(request);
    if (!user) {
      return NextResponse.json(
        { error: "Sign in first. Your session could not be verified." },
        { status: 401 }
      );
    }

    if (!user.email || user.email.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "Your account email does not match the designated admin email. Access denied." },
        { status: 403 }
      );
    }

    const response = await fetch(
      `${endpoint}/databases/${databaseId}/collections/${profilesCollection}/documents/${user.$id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": projectId,
          "X-Appwrite-Key": apiKey,
        },
        body: JSON.stringify({
          data: {
            is_admin: true,
            updated_at_ms: Date.now(),
          },
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Appwrite API error: ${response.status} ${errorBody}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Admin access granted!" });
  } catch (error) {
    console.error("Setup admin error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
