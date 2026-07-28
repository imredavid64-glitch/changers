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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshAuth() {
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
    void refreshAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

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
