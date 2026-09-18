export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  mediaBucketId: string;
  collections: Record<string, string>;
}

export interface HealthCheck {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export interface PlatformHealthReport {
  ok: boolean;
  endpoint: string;
  projectId: string;
  databaseId: string;
  checkedAt: string;
  checks: HealthCheck[];
}

export interface CollectionInfo {
  $id: string;
  name: string;
  $permissions: string[];
  documentSecurity: boolean;
  enabled: boolean;
  attributes: AttributeInfo[];
  indexes: IndexInfo[];
  total: number;
}

export interface AttributeInfo {
  key: string;
  type: string;
  size?: number;
  required: boolean;
  default?: unknown;
  array: boolean;
  status: "available" | "processing" | "failed";
  enum?: string[];
}

export interface IndexInfo {
  key: string;
  type: "key" | "fulltext";
  attributes: string[];
  status: "available" | "processing" | "failed";
}

export interface BucketInfo {
  $id: string;
  $name: string;
  $permissions: string[];
  fileSecurity: boolean;
  enabled: boolean;
  maximumFileSize: number;
  allowedFileExtensions: string[];
  compression: string;
  encryption: boolean;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface AttributeLimitStatus {
  collectionId: string;
  currentCount: number;
  maxCount: number;
  remaining: number;
  atLimit: boolean;
}

export interface EmailReportOptions {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
}

export type ModelProvider = "openrouter" | "ollama" | "anthropic";

export interface AgentConfig {
  name: string;
  model: string;
  provider: ModelProvider;
  permissions: {
    edit: "allow" | "ask" | "deny";
    bash: "allow" | "ask" | "deny";
    external_directory: "allow" | "ask" | "deny";
  };
}