"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Mail } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { COLLECTIONS, updateDocument } from "@/lib/appwrite/bridge";

export default function NotificationsSettingsPage() {
  const { user, profile } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    setPushSupported("Notification" in window && "serviceWorker" in navigator);
  }, []);

  async function handleTogglePush() {
    if (!pushSupported) { setStatus("Push notifications are not supported in this browser."); return; }

    try {
      if (pushEnabled) {
        setPushEnabled(false);
        setStatus("Push notifications disabled.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Notification permission denied. Update your browser settings.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicVapidKey) {
          setStatus("Push notifications are not configured yet. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in your environment.");
          return;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicVapidKey,
        });
      }

      // Store subscription in user profile for future use
      await updateDocument(COLLECTIONS.profiles, user!.$id, {
        push_subscription: JSON.stringify(subscription),
        updated_at_ms: Date.now(),
      });

      setPushEnabled(true);
      setStatus("Push notifications enabled.");
    } catch (error) {
      setStatus("Failed to enable push notifications.");
      console.error(error);
    }
  }

  if (!user) {
    return <section className="card"><h2>Notification Settings</h2><p className="muted">Sign in to manage your notification preferences.</p></section>;
  }

  return (
    <motion.section
      className="card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="section-header">
        <div>
          <h2><Bell size={24} style={{ display: "inline", marginRight: 8, color: "var(--moss)", verticalAlign: "middle" }} /> Notification Settings</h2>
          <p className="muted">Control how Changers notifies you about activity.</p>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderRadius: 16, border: "1px solid rgba(16,24,32,0.08)", background: "white" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {pushEnabled ? <Bell size={24} color="var(--teal)" /> : <BellOff size={24} />}
            <div>
              <p style={{ fontWeight: 600 }}>Push notifications</p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>Receive alerts when someone interacts with your posts or messages you.</p>
            </div>
          </div>
          <button className={pushEnabled ? "primary" : "ghost"} onClick={handleTogglePush}>
            {pushEnabled ? "Enabled" : "Enable"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 20px", borderRadius: 16, border: "1px solid rgba(16,24,32,0.08)", background: "white" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Mail size={24} />
            <div>
              <p style={{ fontWeight: 600 }}>Email notifications</p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>Get email digests of your unanswered messages and trending posts.</p>
            </div>
          </div>
          <button className={emailEnabled ? "primary" : "ghost"} onClick={() => { setEmailEnabled(!emailEnabled); setStatus(emailEnabled ? "Email notifications disabled." : "Email notifications enabled."); }}>
            {emailEnabled ? "Enabled" : "Enable"}
          </button>
        </div>
      </div>

      {status && <p className="notice" style={{ marginTop: 16 }}>{status}</p>}

      <div className="bridge-results" style={{ marginTop: 16 }}>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>In-app notifications</p>
        <p className="muted">
          In-app notifications in the bell icon are always active and do not need configuration.
          Push and email notifications are optional extras.
        </p>
      </div>
    </motion.section>
  );
}
