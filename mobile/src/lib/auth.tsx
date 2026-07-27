import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseEnabled } from "./firebase";
import type { BridgeProfile } from "./bridge";

type AuthContextValue = {
  user: User | null;
  profile: BridgeProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    fullName: string,
    role: string,
    email: string,
    password: string
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BridgeProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseEnabled || !auth || !db) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);

      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      unsubscribeProfile = onSnapshot(doc(db, "profiles", nextUser.uid), (snap) => {
        const data = snap.data() || {};
        setProfile({
          id: nextUser.uid,
          fullName:
            (data.full_name as string | undefined) ||
            nextUser.displayName ||
            nextUser.email?.split("@")[0] ||
            "Changemaker",
          role: (data.role as string | undefined) || "Community member",
          bio: (data.bio as string | undefined) || "",
          location: (data.location as string | undefined) || "",
        });
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  async function signIn(email: string, password: string) {
    if (!firebaseEnabled || !auth) return "Firebase is not configured.";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to sign in.";
    }
  }

  async function signUp(
    fullName: string,
    role: string,
    email: string,
    password: string
  ) {
    if (!firebaseEnabled || !auth || !db) return "Firebase is not configured.";

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      await updateProfile(credential.user, {
        displayName: fullName,
      });

      await setDoc(doc(db, "profiles", credential.user.uid), {
        full_name: fullName,
        role,
        bio: "",
        location: "",
        created_at: serverTimestamp(),
      });

      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to create account.";
    }
  }

  async function signOut() {
    if (!auth) return;
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
