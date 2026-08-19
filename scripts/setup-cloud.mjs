#!/usr/bin/env node
/**
 * Reliable Appwrite Cloud schema setup using global fetch with timeouts.
 * Reuses the COLLECTIONS schema from setup-appwrite.mjs (which targets the
 * self-hosted Dell Appwrite). node-appwrite's client can hang against Cloud,
 * so this script talks to the REST API directly.
 */
import { COLLECTIONS } from "./setup-appwrite.mjs";

const ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!projectId || !apiKey) {
  console.error("Set NEXT_PUBLIC_APPWRITE_PROJECT_ID and APPWRITE_API_KEY");
  process.exit(1);
}

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "changers";
const BUCKET_ID = process.env.APPWRITE_MEDIA_BUCKET_ID || "changers-media";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, body, retries = 0) {
  const res = await fetch(`${ENDPOINT}${path}`, {
    method,
    headers: {
      "x-appwrite-project": projectId,
      "x-appwrite-key": apiKey,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (res.status >= 500 && retries < 3) {
    console.log(`  [retry ${retries + 1}] ${method} ${path} -> ${res.status}`);
    await sleep(2000);
    return api(method, path, body, retries + 1);
  }
  return { status: res.status, data };
}

async function waitForAttribute(collectionId, key) {
  for (let i = 0; i < 60; i++) {
    const { data } = await api("GET", `/databases/${DATABASE_ID}/collections/${collectionId}/attributes`);
    const attr = data?.attributes?.find((a) => a.key === key);
    if (!attr) {
      await sleep(1500);
      continue;
    }
    if (attr.status === "available") return;
    if (attr.status === "failed") throw new Error(`Attribute ${collectionId}.${key} failed`);
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for attribute ${collectionId}.${key}`);
}

async function createDatabase() {
  console.log(`\nDatabase "${DATABASE_ID}"...`);
  const { data: list } = await api("GET", "/databases");
  if (list?.databases?.some((db) => db.$id === DATABASE_ID)) {
    console.log("  already exists");
    return;
  }
  const { status, data } = await api("POST", "/databases", { databaseId: DATABASE_ID, name: DATABASE_ID });
  if (status === 201) {
    console.log("  created");
  } else if (data?.message?.includes("already exists")) {
    console.log("  already exists");
  } else {
    throw new Error(`createDatabase: ${status} ${JSON.stringify(data)}`);
  }
}

async function createBucket() {
  console.log(`\nBucket "${BUCKET_ID}"...`);
  const { data: list } = await api("GET", "/storage/buckets");
  if (list?.buckets?.some((b) => b.$id === BUCKET_ID)) {
    console.log("  already exists");
    return;
  }
  const { status, data } = await api("POST", "/storage/buckets", {
    bucketId: BUCKET_ID,
    name: BUCKET_ID,
    permissions: ['read("any")', 'create("users")', 'update("users")', 'delete("users")'],
    fileSecurity: false,
    maximumFileSize: 50_000_000,
    allowedFileExtensions: [],
  });
  if (status === 201) {
    console.log("  created (50MB max)");
  } else if (data?.message?.includes("already exists")) {
    console.log("  already exists");
  } else {
    throw new Error(`createBucket: ${status} ${JSON.stringify(data)}`);
  }
}

async function createCollection(collectionId, config) {
  console.log(`\nCollection "${collectionId}"...`);
  const { status, data } = await api("POST", `/databases/${DATABASE_ID}/collections`, {
    collectionId,
    name: collectionId,
    permissions: ['read("any")', 'create("users")', 'update("users")', 'delete("users")'],
    documentSecurity: false,
  });
  if (status !== 201 && !data?.message?.includes("already exists")) {
    throw new Error(`createCollection ${collectionId}: ${status} ${JSON.stringify(data)}`);
  }
  console.log(`  collection ready (${status === 201 ? "created" : "exists"})`);

  for (const attr of config.attributes) {
    const { data: existing } = await api(
      "GET",
      `/databases/${DATABASE_ID}/collections/${collectionId}/attributes`,
    );
    if (existing?.attributes?.some((a) => a.key === attr.key)) {
      console.log(`  attribute "${attr.key}" exists`);
      continue;
    }
    let body;
    let path;
    if (attr.type === "integer") {
      path = "/attributes/integer";
      body = { key: attr.key, required: attr.required };
    } else if (attr.type === "boolean") {
      path = "/attributes/boolean";
      body = { key: attr.key, required: attr.required };
    } else {
      path = "/attributes/string";
      body = {
        key: attr.key,
        size: attr.type === "string[]" ? 65536 : attr.size || 256,
        required: attr.required,
        array: attr.type === "string[]",
      };
    }
    const { status: attrStatus, data: attrData } = await api(
      "POST",
      `/databases/${DATABASE_ID}/collections/${collectionId}${path}`,
      body,
    );
    if (attrStatus !== 201 && attrStatus !== 202 && !attrData?.message?.includes("already exists")) {
      throw new Error(`attribute ${collectionId}.${attr.key}: ${attrStatus} ${JSON.stringify(attrData)}`);
    }
    await waitForAttribute(collectionId, attr.key);
    console.log(`  attribute "${attr.key}" (${attr.type}) available`);
  }

  for (const idx of config.indexes) {
    const { status: idxStatus, data: idxData } = await api(
      "POST",
      `/databases/${DATABASE_ID}/collections/${collectionId}/indexes`,
      {
        key: idx.key,
        type: idx.type,
        attributes: idx.attributes,
        orders: idx.orders,
      },
    );
    if (idxStatus === 201) {
      console.log(`  index "${idx.key}" created`);
    } else if (idxData?.message?.includes("already exists")) {
      console.log(`  index "${idx.key}" exists`);
    } else {
      console.error(`  index "${idx.key}" FAILED: ${idxStatus} ${idxData?.message || JSON.stringify(idxData)}`);
    }
  }
}

async function main() {
  console.log(`=== Changers Cloud schema setup ===`);
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Project: ${projectId}`);
  console.log(`Database: ${DATABASE_ID} | Bucket: ${BUCKET_ID}`);

  await createDatabase();
  await createBucket();

  for (const [collectionId, config] of Object.entries(COLLECTIONS)) {
    await createCollection(collectionId, config);
  }

  console.log("\n=== Setup complete ===");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});