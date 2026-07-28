import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";
  const profilesCollection = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES || "profiles";

  if (!apiKey || !projectId) {
    return NextResponse.json({ error: "Appwrite not configured" }, { status: 500 });
  }

  if (!adminEmail) {
    return NextResponse.json(
      { error: "ADMIN_EMAIL not set on server. Contact the developer." },
      { status: 500 }
    );
  }

  try {
    const { userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: "userId and email required" }, { status: 400 });
    }

    if (email.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "Your email does not match the designated admin email. Access denied." },
        { status: 403 }
      );
    }

    const response = await fetch(
      `${endpoint}/databases/${databaseId}/collections/${profilesCollection}/documents/${userId}`,
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
