#!/usr/bin/env node

const APPWRITE_URL = "http://localhost:8080";
const ENDPOINT = `${APPWRITE_URL}/v1`;
const ENV_FILE = new URL("../web/.env.local", import.meta.url).pathname;
const SETUP_SCRIPT = new URL("./setup-appwrite.mjs", import.meta.url).pathname;

const ADMIN = {
  name: "Admin",
  email: "admin@changers.app",
  password: "changeme123",
};

const PROJECT_NAME = "Changers";

async function waitForReady() {
  console.log("Waiting for Appwrite to be ready...");
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${ENDPOINT}/health`);
      if (res.status !== 0) {
        console.log("Appwrite is ready!");
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Appwrite did not become ready within 2 minutes.");
}

async function checkOrDoSetup() {
  console.log("Checking admin login...");
  const loginRes = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Appwrite-Project": "console" },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password }),
  });
  if (loginRes.ok) {
    console.log("Admin user already exists.");
    return;
  }
  console.log("Creating admin user...");
  const setupRes = await fetch(`${ENDPOINT}/account`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Appwrite-Project": "console" },
    body: JSON.stringify({
      name: ADMIN.name,
      email: ADMIN.email,
      password: ADMIN.password,
      userId: "unique()",
      terms: true,
    }),
  });
  if (!setupRes.ok) {
    const err = await setupRes.json().catch(() => ({}));
    throw new Error(`Setup failed: ${err.message || setupRes.status}`);
  }
  console.log("Admin user created.");
}

async function getSessionCookie() {
  console.log("Logging in as admin...");
  const res = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Appwrite-Project": "console" },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Login failed: ${err.message} (${res.status})`);
  }
  const cookies = res.headers.getSetCookie();
  if (cookies.length === 0) {
    throw new Error("No session cookie received after login.");
  }
  const sessionCookie = cookies.join("; ");
  console.log("Logged in.");
  return sessionCookie;
}

async function getOrCreateProject(cookie) {
  const listRes = await fetch(`${ENDPOINT}/projects`, {
    headers: { Cookie: cookie, "X-Appwrite-Project": "console" },
  });
  const listData = await listRes.json();
  const existing = listData.projects?.find((p) => p.name === PROJECT_NAME);
  if (existing) {
    console.log(`Project "${PROJECT_NAME}" already exists with ID: ${existing.$id}`);
    return existing.$id;
  }

  const teamsRes = await fetch(`${ENDPOINT}/teams`, {
    headers: { Cookie: cookie, "X-Appwrite-Project": "console" },
  });
  const teamsData = await teamsRes.json();
  let teamId = teamsData.teams?.[0]?.$id;
  if (!teamId) {
    console.log("No team found — creating one...");
    const teamRes = await fetch(`${ENDPOINT}/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, "X-Appwrite-Project": "console" },
      body: JSON.stringify({ teamId: "unique()", name: "Changers Team" }),
    });
    if (!teamRes.ok) {
      const err = await teamRes.json();
      throw new Error(`Team creation failed: ${err.message} (${teamRes.status})`);
    }
    const team = await teamRes.json();
    teamId = team.$id;
  }
  console.log(`Using team ID: ${teamId}`);

  console.log(`Creating project "${PROJECT_NAME}"...`);
  const createRes = await fetch(`${ENDPOINT}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-Appwrite-Project": "console" },
    body: JSON.stringify({
      name: PROJECT_NAME,
      projectId: "unique()",
      teamId,
      description: "Changemaker social platform",
      region: "default",
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`Project creation failed: ${err.message} (${createRes.status})`);
  }
  const project = await createRes.json();
  console.log(`Project created with ID: ${project.$id}`);
  return project.$id;
}

async function getOrCreateApiKey(projectId, cookie) {
  const listRes = await fetch(`${ENDPOINT}/projects/${projectId}/keys`, {
    headers: { Cookie: cookie, "X-Appwrite-Project": "console" },
  });
  const listData = await listRes.json();
  const existing = listData.keys?.find((k) => k.name === "Changers Dev Key");
  if (existing) {
    console.log(`API key already exists with ID: ${existing.$id}`);
    return existing.$id;
  }

  console.log("Creating API key...");
  const scopes = [
    "project.read", "project.write",
    "keys.read", "keys.write",
    "platforms.read", "platforms.write",
    "mocks.read", "mocks.write",
    "policies.read", "policies.write",
    "project.policies.read", "project.policies.write",
    "templates.read", "templates.write",
    "oauth2.read", "oauth2.write",
    "users.read", "users.write",
    "sessions.read", "sessions.write",
    "teams.read", "teams.write",
    "databases.read", "databases.write",
    "tables.read", "tables.write",
    "columns.read", "columns.write",
    "indexes.read", "indexes.write",
    "rows.read", "rows.write",
    "collections.read", "collections.write",
    "attributes.read", "attributes.write",
    "documents.read", "documents.write",
    "buckets.read", "buckets.write",
    "files.read", "files.write",
    "tokens.read", "tokens.write",
    "functions.read", "functions.write",
    "executions.read", "executions.write",
    "execution.read", "execution.write",
    "sites.read", "sites.write",
    "log.read", "log.write",
    "providers.read", "providers.write",
    "topics.read", "topics.write",
    "subscribers.read", "subscribers.write",
    "targets.read", "targets.write",
    "messages.read", "messages.write",
    "rules.read", "rules.write",
    "webhooks.read", "webhooks.write",
    "locale.read", "avatars.read",
    "health.read",
    "assistant.read",
    "migrations.read", "migrations.write",
    "schedules.read", "schedules.write",
    "vcs.read", "vcs.write",
    "insights.read", "insights.write",
    "reports.read", "reports.write",
    "presences.read", "presences.write",
  ];
  const createRes = await fetch(`${ENDPOINT}/projects/${projectId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, "X-Appwrite-Project": "console" },
    body: JSON.stringify({
      name: "Changers Dev Key",
      keyId: "unique()",
      scopes,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`API key creation failed: ${err.message} (${createRes.status})`);
  }
  const key = await createRes.json();
  console.log(`API key created with ID: ${key.$id}`);
  return key;
}

async function updateEnvFile(projectId, apiKey) {
  const fs = await import("node:fs");
  let content = fs.readFileSync(ENV_FILE, "utf-8");
  content = content.replace(
    /NEXT_PUBLIC_APPWRITE_PROJECT_ID=.*/,
    `NEXT_PUBLIC_APPWRITE_PROJECT_ID=${projectId}`
  );
  fs.writeFileSync(ENV_FILE, content);
  console.log(`Updated ${ENV_FILE} with project ID.`);
  console.log(`\nAdmin credentials:`);
  console.log(`  Email:    ${ADMIN.email}`);
  console.log(`  Password: ${ADMIN.password}`);
  console.log(`  Appwrite Console: ${APPWRITE_URL}/console`);
  console.log(`\nAPI Key: ${apiKey}`);
  console.log("\nNow running collection setup...");
}

async function runCollectionSetup(projectId, apiKey) {
  const { spawn } = await import("node:child_process");
  await new Promise((resolve, reject) => {
    const proc = spawn("node", [SETUP_SCRIPT], {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_APPWRITE_PROJECT_ID: projectId,
        APPWRITE_API_KEY: apiKey,
        APPWRITE_ENDPOINT: ENDPOINT,
        APPWRITE_DATABASE_ID: "changers",
        APPWRITE_MEDIA_BUCKET_ID: "changers-media",
      },
    });
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Setup script exited with code ${code}`));
    });
  });
}

async function main() {
  console.log("=== Changers Local Setup ===\n");
  await waitForReady();
  await checkOrDoSetup();
  const cookie = await getSessionCookie();
  const projectId = await getOrCreateProject(cookie);
  const apiKeyObj = await getOrCreateApiKey(projectId, cookie);
  const apiKeyPlain = apiKeyObj.secret || apiKeyObj.$id;
  await updateEnvFile(projectId, apiKeyPlain);
  await runCollectionSetup(projectId, apiKeyPlain);
  console.log("\n=== Setup complete! ===");
  console.log(`Start the dev server with: cd web && npm run dev`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
