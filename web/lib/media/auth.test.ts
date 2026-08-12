import { beforeEach, describe, expect, it, vi } from "vitest";

// The regression under test: when Appwrite is not configured (or the session
// check fails), getAuthenticatedAppwriteUser must return null so gated routes
// respond 401 — it must never throw, which used to surface as a 500 for every
// admin/user-data/media route. The appwrite module is mocked so the SDK never
// touches the network.
const state = vi.hoisted(() => ({ enabled: true, getResult: null as unknown }));

vi.mock("@/lib/appwrite/config", () => ({
  get appwriteEnabled() {
    return state.enabled;
  },
  appwriteConfig: { endpoint: "https://cloud.appwrite.io/v1", projectId: "p1" },
}));

vi.mock("appwrite", () => ({
  Client: vi.fn(() => {
    const client = {
      setEndpoint: vi.fn((_endpoint: string) => client),
      setProject: vi.fn((_project: string) => client),
      setJWT: vi.fn((_jwt: string) => client),
    };
    return client;
  }),
  Account: vi.fn(() => ({
    get: vi.fn(async () => {
      if (state.getResult instanceof Error) throw state.getResult;
      return state.getResult;
    }),
  })),
}));

import { getAuthenticatedAppwriteUser } from "@/lib/media/server";

const USER = { $id: "user-1", name: "QA Tester", email: "qa@test.hu" };

describe("getAuthenticatedAppwriteUser", () => {
  beforeEach(() => {
    state.enabled = true;
    state.getResult = USER;
  });

  it("returns null instead of throwing when Appwrite is not configured", async () => {
    state.enabled = false;
    const request = new Request("https://example.com/api/x", {
      headers: { Authorization: "Bearer some-jwt" },
    });

    // Must not throw (the old behavior crashed gated routes with a 500).
    const user = await getAuthenticatedAppwriteUser(request);
    expect(user).toBeNull();
  });

  it("returns null when no bearer token is present", async () => {
    const request = new Request("https://example.com/api/x");
    const user = await getAuthenticatedAppwriteUser(request);
    expect(user).toBeNull();
  });

  it("returns the account when the Appwrite session check succeeds", async () => {
    const request = new Request("https://example.com/api/x", {
      headers: { Authorization: "Bearer valid-jwt" },
    });

    const user = await getAuthenticatedAppwriteUser(request);
    expect(user).not.toBeNull();
    expect(user?.$id).toBe("user-1");
  });

  it("returns null when the session check fails (e.g. paused project)", async () => {
    state.getResult = Object.assign(new Error("Project is paused due to inactivity."), {
      code: 403,
      type: "project_paused",
    });
    const request = new Request("https://example.com/api/x", {
      headers: { Authorization: "Bearer stale-jwt" },
    });

    const user = await getAuthenticatedAppwriteUser(request);
    expect(user).toBeNull();
  });
});
