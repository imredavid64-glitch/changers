import type { NextConfig } from "next";

const rawAppwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT?.trim();

function getAppwriteUrl() {
  if (rawAppwriteEndpoint) {
    try {
      return new URL(rawAppwriteEndpoint);
    } catch {
      return new URL("https://cloud.appwrite.io/v1");
    }
  }

  return new URL("http://localhost:8080/v1");
}

const appwriteUrl = getAppwriteUrl();
const appwriteOrigin = appwriteUrl.origin;
const appwriteWsOrigin = `${appwriteUrl.protocol === "https:" ? "wss" : "ws"}://${appwriteUrl.host}`;
const appwritePathPrefix = appwriteUrl.pathname.replace(/\/$/, "");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob: ${appwriteOrigin}`,
      "font-src 'self' data:",
      `connect-src 'self' ${appwriteOrigin} ${appwriteWsOrigin}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // camera/microphone use (self) so the room video calls can access the
    // user's own devices; geolocation stays fully blocked.
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-site",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: appwriteUrl.protocol === "https:" ? "https" : "http",
        hostname: appwriteUrl.hostname,
        port: appwriteUrl.port,
        pathname: `${appwritePathPrefix}/storage/buckets/**`,
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
