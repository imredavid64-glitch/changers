"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Models } from "appwrite";
import { account, ID } from "@/lib/appwrite/client";
import {
  COLLECTIONS,
  buildDefaultProfileDocument,
  createDocument,
  updateDocument,
  watchDocument,
} from "@/lib/appwrite/bridge";
import { appwriteEnabled } from "@/lib/appwrite/config";
import { FAKE_PROFILE, isFakeDataMode } from "@/lib/qa/fixtures";
import { AppProfile } from "@/lib/social/types";
import { buildProfileSearchIndex, normalizeProfile } from "@/lib/social/utils";

type AuthContextValue = {
  user: Models.User<Models.Preferences> | null;
  profile: AppProfile | null;
  loading: boolean;
  refreshAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    fullName: string,
    role: string,
    email: string,
    password: string,
    options?: {
      headline?: string;
      location?: string;
      interests?: string[];
    },
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncProfileName: (nextName: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * QA/test hook: setting localStorage["changers-fake-user"] = "1" renders the
 * signed-in shell (topbar, nav, theme toggle) with a mock identity so UI can be
 * exercised without a live backend (used by the Playwright theme suite). It is
 * UI-only — every API route still requires a real Appwrite JWT, and the mock is
 * dormant unless the flag is set in the browser.
 */
const FAKE_USER_KEY = "changers-fake-user";

export function readFakeUser(): Models.User<Models.Preferences> | null {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(FAKE_USER_KEY) !== "1") return null;
  return {
    $id: "e2e-qa-user",
    name: "QA Tester",
    email: "qa@test.hu",
    registration: "",
    status: true,
    emailVerification: false,
    prefs: {},
    passwordUpdate: "",
    phone: "",
    phoneVerification: false,
    labels: [],
    accessedAt: "",
    $createdAt: "",
    $updatedAt: "",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshAuth() {
    const fakeUser = readFakeUser();
    if (fakeUser) {
      setUser(fakeUser);
      // The data seam (changers-fake-data) also provides a fixture profile so
      // data-driven pages render their real states; otherwise profile stays
      // null exactly as before.
      setProfile(isFakeDataMode() ? FAKE_PROFILE : null);
      setLoading(false);
      return;
    }

    if (!appwriteEnabled) {
      setLoading(false);
      setUser(null);
      setProfile(null);
      return;
    }

    try {
      const nextUser = await account.get();
      setUser(nextUser);
    } catch {
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Defer past the effect's synchronous body: refreshAuth() may synchronously set
    // loading/user/profile when Appwrite is disabled. A 0ms timer keeps the same
    // first-paint timing while satisfying react-hooks/set-state-in-effect.
    const timer = setTimeout(() => void refreshAuth(), 0);
    return () => clearTimeout(timer);
  }, []);

  // Reset the profile only when the signed-in user actually transitions (including to
  // signed-out); while signed in the subscription below owns `profile` end-to-end.
  const [prevAuthUserId, setPrevAuthUserId] = useState<string | null>(user?.$id ?? null);
  const authUserId = user?.$id ?? null;
  if (authUserId !== prevAuthUserId) {
    setPrevAuthUserId(authUserId);
    if (authUserId === null) setProfile(null);
  }

  useEffect(() => {
    if (!user) return;
    // The data seam's profile is fixture data — skip the (backend-less) watch
    // so it doesn't overwrite FAKE_PROFILE with a default document.
    if (isFakeDataMode()) return;

    return watchDocument(
      COLLECTIONS.profiles,
      user.$id,
      (document) => normalizeProfile(document.$id, document),
      (nextProfile) => {
        if (nextProfile) {
          setProfile(nextProfile);
          return;
        }

        const fallbackProfile = normalizeProfile(user.$id, buildDefaultProfileDocument(user.$id, user.name || "Changemaker"));
        setProfile(fallbackProfile);
      },
    );
  }, [user]);

  async function signIn(email: string, password: string) {
    if (!appwriteEnabled) return "Appwrite is not configured.";

    try {
      await account.createEmailSession(email, password);
      await refreshAuth();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to sign in.";
    }
  }

  async function signUp(
    fullName: string,
    role: string,
    email: string,
    password: string,
    options?: { headline?: string; location?: string; interests?: string[] },
  ) {
    if (!appwriteEnabled) return "Appwrite is not configured.";

    try {
      await account.create(ID.unique(), email, password, fullName);

      await account.createEmailSession(email, password);
      const nextUser = await account.get();
      const interests = (options?.interests?.length ? options.interests : ["S"]).slice(0, 4);

      await createDocument(
        COLLECTIONS.profiles,
        {
          ...buildDefaultProfileDocument(nextUser.$id, fullName, role),
          headline: options?.headline || "",
          location: options?.location || "",
          interests,
          search_index: buildProfileSearchIndex({
            full_name: fullName,
            role,
            headline: options?.headline || "",
            location: options?.location || "",
            interests: interests as AppProfile["interests"],
          }),
        },
        undefined,
        nextUser.$id,
      );

      await refreshAuth();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to create account.";
    }
  }

  async function signOut() {
    if (!appwriteEnabled) return;

    try {
      await account.deleteSession("current");
    } finally {
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }

  async function syncProfileName(nextName: string) {
    if (!user || !profile) return;

    await account.updateName(nextName);
    await updateDocument(COLLECTIONS.profiles, user.$id, {
      full_name: nextName,
      search_index: buildProfileSearchIndex({
        full_name: nextName,
        role: profile.role,
        headline: profile.headline,
        bio: profile.bio,
        location: profile.location,
        mentor_focus: profile.mentor_focus,
        interests: profile.interests,
      }),
      updated_at_ms: Date.now(),
    });
    await refreshAuth();
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, refreshAuth, signIn, signUp, signOut, syncProfileName }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
