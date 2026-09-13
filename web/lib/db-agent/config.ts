import { appwriteConfig, appwriteEnabled } from "@/lib/appwrite/config";

export const dbAgentConfig = {
  appwrite: {
    endpoint: appwriteConfig.endpoint,
    projectId: appwriteConfig.projectId,
    databaseId: appwriteConfig.databaseId,
    mediaBucketId: appwriteConfig.mediaBucketId,
    collections: appwriteConfig.collections,
    enabled: appwriteEnabled,
  },
  apiKey: () => process.env.APPWRITE_API_KEY?.trim() || "",
  postgres: {
    url: process.env.DATABASE_URL?.trim() || "",
  },
  email: {
    to: process.env.DB_AGENT_EMAIL_TO || "admin@changers.app",
    from: process.env.DB_AGENT_EMAIL_FROM || "db-agent@changers.app",
  },
  cron: {
    schedule: process.env.DB_AGENT_CRON_SCHEDULE || "0 */6 * * *",
  },
  models: {
    read: {
      provider: "openrouter" as const,
      model: "qwen/qwen-2.5-72b-instruct:free",
      baseUrl: "https://openrouter.ai/api/v1",
    },
    write: {
      provider: "ollama" as const,
      model: "qwen2.5:72b",
      baseUrl: process.env.DB_AGENT_OLLAMA_HOST || "http://localhost:11434",
    },
  },
  limits: {
    maxAttributesPerCollection: 100,
    attributeLimitWarningThreshold: 85,
  },
};

export function getAppwriteHeaders() {
  const key = dbAgentConfig.apiKey();
  return {
    "X-Appwrite-Project": dbAgentConfig.appwrite.projectId,
    "X-Appwrite-Key": key,
    "Content-Type": "application/json",
  };
}

export function getAppwriteUrl(path: string): string {
  return `${dbAgentConfig.appwrite.endpoint}${path}`;
}