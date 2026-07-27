import type { User } from "firebase/auth";

export type Strand = "N" | "E" | "S" | "W";

export type BridgeProfile = {
  id: string;
  fullName: string;
  role: string;
  bio?: string;
  location?: string;
};

export type BridgePost = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  title: string;
  body: string;
  strand: Strand;
  likes: string[];
};

export type BridgeComment = {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
};

export type BridgeRoom = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: string[];
  lastMessage?: string;
};

export type BridgeThread = {
  id: string;
  participants: string[];
  lastMessage?: string;
  participantNames?: Record<string, string>;
};

export function buildThreadId(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join("_");
}

export function displayNameForUser(
  user: User | null,
  profile?: BridgeProfile | null
) {
  if (profile?.fullName) {
    return profile.fullName;
  }

  if (user?.displayName) {
    return user.displayName;
  }

  if (user?.email) {
    return user.email.split("@")[0];
  }

  return "Changemaker";
}

export function roleForProfile(profile?: BridgeProfile | null) {
  return profile?.role || "Community member";
}

export function timestampToMillis(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof value.seconds === "number"
  ) {
    return value.seconds * 1000;
  }

  return 0;
}
