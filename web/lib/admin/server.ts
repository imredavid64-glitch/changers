import { NextRequest } from "next/server";
import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import { appwriteConfig } from "@/lib/appwrite/config";

/**
 * Verifies that the request carries a valid Appwrite session whose profile
 * document has `is_admin: true`. Returns `{ ok: true }` on success, or an
 * error payload to return to the client.
 */
export async function verifyAdminUser(
  request: NextRequest,
): Promise<{ ok: boolean; error?: { message: string; status: number } }> {
  const user = await getAuthenticatedAppwriteUser(request);
  if (!user) {
    return { ok: false, error: { message: "Sign in as an admin to perform this action.", status: 401 } };
  }

  const apiKey = process.env.APPWRITE_API_KEY?.trim();
  const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "changers";
  const profilesCollection = process.env.NEXT_PUBLIC_APPWRITE_COLLECTION_PROFILES || "profiles";

  if (!apiKey) {
    return {
      ok: false,
      error: { message: "Server is missing the APPWRITE_API_KEY environment variable.", status: 500 },
    };
  }

  const response = await fetch(
    `${appwriteConfig.endpoint}/databases/${databaseId}/collections/${profilesCollection}/documents/${user.$id}`,
    {
      headers: {
        "X-Appwrite-Project": appwriteConfig.projectId,
        "X-Appwrite-Key": apiKey,
      },
    },
  );

  if (!response.ok) {
    return { ok: false, error: { message: "Could not verify admin access.", status: 403 } };
  }

  const payload = (await response.json()) as { data?: { is_admin?: boolean } };
  if (payload.data?.is_admin !== true) {
    return { ok: false, error: { message: "Only administrators can perform this action.", status: 403 } };
  }

  return { ok: true };
}
