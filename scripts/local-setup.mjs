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
      if (res.ok) {
        console.log("Appwrite is ready!");
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Appwrite did not become ready within 2 minutes.");
}

async function checkOrDoSetup() {
  const res = await fetch(`${ENDPOINT}/console/setup`);
  const data = await res.json();
  if (data.completed) {
    console.log("Console setup already completed.");
    return;
  }
  console.log("Running initial console setup (creating admin user)...");
  const setupRes = await fetch(`${ENDPOINT}/console/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: ADMIN.name,
      email: ADMIN.email,
      password: ADMIN.password,
      terms: true,
    }),
  });
  if (!setupRes.ok) {
    const err = await setupRes.json();
    throw new Error(`Setup failed: ${err.message} (${setupRes.status})`);
  }
  console.log("Admin user created.");
}

async function getSessionCookie() {
  console.log("Logging in as admin...");
  const res = await fetch(`${ENDPOINT}/account/sessions/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { Cookie: cookie },
  });
  const listData = await listRes.json();
  const existing = listData.projects?.find((p) => p.name === PROJECT_NAME);
  if (existing) {
    console.log(`Project "${PROJECT_NAME}" already exists with ID: ${existing.$id}`);
    return existing.$id;
  }

  const teamsRes = await fetch(`${ENDPOINT}/teams`, {
    headers: { Cookie: cookie },
  });
  const teamsData = await teamsRes.json();
  const teamId = teamsData.teams?.[0]?.$id;
  if (!teamId) {
    throw new Error("No team found. Console setup may not have created a personal team.");
  }
  console.log(`Using team ID: ${teamId}`);

  console.log(`Creating project "${PROJECT_NAME}"...`);
  const createRes = await fetch(`${ENDPOINT}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: PROJECT_NAME,
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
    headers: { Cookie: cookie },
  });
  const listData = await listRes.json();
  const existing = listData.keys?.find((k) => k.name === "Changers Dev Key");
  if (existing) {
    console.log(`API key already exists with ID: ${existing.$id}`);
    return existing.$id;
  }

  console.log("Creating API key...");
  const scopes = [
    "users.read", "users.write",
    "teams.read", "teams.write",
    "databases.read", "databases.write",
    "collections.read", "collections.write",
    "attributes.read", "attributes.write",
    "indexes.read", "indexes.write",
    "documents.read", "documents.write",
    "buckets.read", "buckets.write",
    "files.read", "files.write",
    "projects.read", "projects.write",
    "platforms.read", "platforms.write",
    "keys.read", "keys.write",
    "webhooks.read", "webhooks.write",
    "smtp.read", "smtp.write",
    "migrations.read", "migrations.write",
    "functions.read", "functions.write",
    "stats.read",
    "health.read",
    "locale.read",
    "avatars.read",
    "security.read", "security.write",
  ];
  const createRes = await fetch(`${ENDPOINT}/projects/${projectId}/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "Changers Dev Key",
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
