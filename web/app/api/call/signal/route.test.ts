import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/media/server", () => ({
  getAuthenticatedAppwriteUser: vi.fn(),
}));

vi.mock("@/lib/call/server", () => ({
  createCallSignal: vi.fn(),
}));

import { getAuthenticatedAppwriteUser } from "@/lib/media/server";
import { createCallSignal } from "@/lib/call/server";
import { POST } from "./route";

const mockGetUser = vi.mocked(getAuthenticatedAppwriteUser);
const mockCreateSignal = vi.mocked(createCallSignal);

function request(body: unknown, jwt = "jwt-token") {
  return new NextRequest("http://localhost/api/call/signal", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/call/signal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ $id: "user-1" } as never);
    mockCreateSignal.mockResolvedValue({} as never);
  });

  it("rejects unauthenticated requests", async () => {
    mockGetUser.mockResolvedValue(null);
    const response = await POST(
      request({ roomId: "r", kind: "chat", payload: "{}" }),
    );
    expect(response.status).toBe(401);
    expect(mockCreateSignal).not.toHaveBeenCalled();
  });

  it("treats a thrown auth lookup as signed out", async () => {
    mockGetUser.mockRejectedValue(new Error("Appwrite not configured"));
    const response = await POST(
      request({ roomId: "r", kind: "chat", payload: "{}" }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects a malformed JSON body", async () => {
    const malformed = new NextRequest("http://localhost/api/call/signal", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
      body: "not-json",
    });
    const response = await POST(malformed);
    expect(response.status).toBe(400);
  });

  it("validates required fields", async () => {
    expect((await POST(request({ kind: "chat", payload: "{}" }))).status).toBe(400);
    expect((await POST(request({ roomId: "r", payload: "{}" }))).status).toBe(400);
    expect((await POST(request({ roomId: "r", kind: "chat" }))).status).toBe(400);
    expect(
      (await POST(request({ roomId: "r", kind: "telepathy", payload: "{}" }))).status,
    ).toBe(400);
  });

  it("publishes a valid signal under the authenticated user id", async () => {
    const response = await POST(
      request({ roomId: "room-1", kind: "chat", payload: '{"text":"hi"}' }),
    );
    expect(response.status).toBe(200);
    expect(mockCreateSignal).toHaveBeenCalledWith({
      roomId: "room-1",
      senderId: "user-1",
      kind: "chat",
      payload: '{"text":"hi"}',
    });
  });

  it("surfaces publish errors as 500 with the message", async () => {
    mockCreateSignal.mockRejectedValue(new Error("collection missing"));
    const response = await POST(
      request({ roomId: "r", kind: "rtc", payload: "{}" }),
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("collection missing");
  });
});
