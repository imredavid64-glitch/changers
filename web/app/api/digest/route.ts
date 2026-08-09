import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const apiKey = process.env.APPWRITE_API_KEY || process.env.NEXT_PUBLIC_APPWRITE_API_KEY;
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";
  const notificationsCollection =
    process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_NOTIFICATIONS || "notifications";
  const profilesCollection = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES || "profiles";

  if (!apiKey || !projectId) {
    return NextResponse.json({ error: "Appwrite not configured" }, { status: 500 });
  }

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId query param required" }, { status: 400 });
  }

  try {
    const [notificationsResponse, profileResponse] = await Promise.all([
      fetch(
        `${endpoint}/databases/${databaseId}/collections/${notificationsCollection}/documents?queries[]=${encodeURIComponent(
          JSON.stringify({
            method: "equal",
            attribute: "user_id",
            values: [userId],
          }),
        )}&queries[]=${encodeURIComponent(
          JSON.stringify({
            method: "equal",
            attribute: "read",
            values: [false],
          }),
        )}&queries[]=${encodeURIComponent(
          JSON.stringify({ method: "orderDesc", attribute: "created_at_ms" }),
        )}&queries[]=${encodeURIComponent(
          JSON.stringify({ method: "limit", values: [50] }),
        )}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Appwrite-Project": projectId,
            "X-Appwrite-Key": apiKey,
          },
        },
      ),
      fetch(
        `${endpoint}/databases/${databaseId}/collections/${profilesCollection}/documents/${userId}`,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Appwrite-Project": projectId,
            "X-Appwrite-Key": apiKey,
          },
        },
      ),
    ]);

    if (!notificationsResponse.ok) {
      const errorBody = await notificationsResponse.text();
      return NextResponse.json(
        { error: `Appwrite API error: ${notificationsResponse.status} ${errorBody}` },
        { status: 500 },
      );
    }

    const notificationsResult = await notificationsResponse.json();
    const notifications = notificationsResult.documents || [];
    const profile = profileResponse.ok ? (await profileResponse.json()) : null;

    const unread = notifications.filter(
      (notification: Record<string, unknown>) => notification.read !== true,
    );

    const emailNotificationsEnabled = profile?.email_notifications !== false;

    return NextResponse.json({
      userId,
      emailNotificationsEnabled,
      count: unread.length,
      notifications: unread.map((notification: Record<string, unknown>) => ({
        id: notification.$id,
        type: notification.type,
        message: notification.message || "",
        actor_name: notification.actor_name || "",
        created_at_ms: notification.created_at_ms || null,
      })),
    });
  } catch (error) {
    console.error("Digest error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
