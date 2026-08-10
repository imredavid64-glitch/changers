import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

type RouteModule = { POST: (request: NextRequest) => Promise<Response> };

function postRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function post(route: RouteModule, body: Record<string, unknown>) {
  return route.POST(postRequest(body));
}

const validBody = {
  name: "Jane Doe",
  email: "jane@example.com",
  message: "Hello!",
  consent: true,
};

describe("contact route validation (no database needed)", () => {
  let route: RouteModule;

  beforeEach(async () => {
    vi.resetModules();
    route = (await import("./route")) as unknown as RouteModule;
  });

  it("rejects a missing message body", async () => {
    const request = new NextRequest("http://localhost:3000/api/contact", { method: "POST" });
    const response = await route.POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects submissions without a name", async () => {
    const response = await post(route, { ...validBody, name: "" });
    expect(response.status).toBe(400);
  });

  it("rejects invalid email addresses", async () => {
    const response = await post(route, { ...validBody, email: "not-an-email" });
    expect(response.status).toBe(400);
  });

  it("rejects submissions without a message", async () => {
    const response = await post(route, { ...validBody, message: "   " });
    expect(response.status).toBe(400);
  });

  it("requires consent for storing the message", async () => {
    const response = await post(route, { ...validBody, consent: false });
    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("privacy");
  });

  it("answers a fake success to bots that fill the honeypot", async () => {
    const response = await post(route, { ...validBody, company: "spam-bot" });
    expect(response.status).toBe(201);
    const payload = (await response.json()) as { ok: boolean };
    expect(payload.ok).toBe(true);
  });
});

describe("contact route rate limiting", () => {
  it("returns 429 after the per-IP hourly limit", async () => {
    vi.resetModules();
    const route = (await import("./route")) as unknown as RouteModule;
    // The rate-limit bucket is module-level; a fresh module starts empty.
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const response = await post(route, { ...validBody, name: `User ${i}` });
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
  });
});
