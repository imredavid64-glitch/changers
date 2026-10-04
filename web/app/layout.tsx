import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#20796c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Changers | Changemaker Social Platform",
  description:
    "A collaboration-first social platform for changemakers to share ideas, build projects, and create impact.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Changers",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Enable demo mode for prototype deployments
  if (typeof window !== "undefined") {
    const isPrototype = 
      window.location.hostname.includes("vercel.app") ||
      window.location.hostname.includes("trycloudflare.com") ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    
    if (isPrototype && !localStorage.getItem("changers-fake-user")) {
      localStorage.setItem("changers-fake-user", "1");
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Apply the saved color theme before first paint so there is no flash
         * of the wrong theme. The ThemeToggle keeps it in sync afterwards. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("changers-theme");var dark=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",dark?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`,
          }}
        />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}