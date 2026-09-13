import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runExtendedHealthChecks } from "./health/extended";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ensureAllCollections } from "./migrations/create-collections";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { runFixAttributes } from "./migrations/fix-attributes";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { runCreateBucket } from "./migrations/create-bucket";
import { runMigrateMedia, checkMigrationStatus } from "./migrations/migrate-media";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ensureAllCollectionAttributes, fixEnumAttributes, fixJsonAttributes, addSearchIndexAttributes } from "./schema/attributes";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ensureRequiredIndexes } from "./schema/indexes";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ensureMediaBucket } from "./storage/buckets";
import { listCollections, getCollection, listAttributes, listIndexes, getBucket, createCollection, createIndex, deleteIndex, getAttributeLimitStatus } from "./client";
import { getAllCollectionDefinitions } from "./schema/collections";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { PlatformHealthReport } from "./types";

const server = new Server(
  {
    name: "changers-db-admin",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "health_check",
        description: "Run comprehensive database health check",
        inputSchema: {
          type: "object",
          properties: {
            quick: { type: "boolean", description: "Run quick health check only", default: false },
          },
        },
      },
      {
        name: "list_collections",
        description: "List all Appwrite collections",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_collection",
        description: "Get detailed info about a specific collection",
        inputSchema: {
          type: "object",
          properties: {
            collectionId: { type: "string", description: "Collection ID" },
          },
          required: ["collectionId"],
        },
      },
      {
        name: "create_collection",
        description: "Create a new collection",
        inputSchema: {
          type: "object",
          properties: {
            collectionId: { type: "string" },
            name: { type: "string" },
            permissions: { type: "array", items: { type: "string" }, default: [] },
          },
          required: ["collectionId", "name"],
        },
      },
      {
        name: "list_attributes",
        description: "List attributes for a collection",
        inputSchema: {
          type: "object",
          properties: {
            collectionId: { type: "string" },
          },
          required: ["collectionId"],
        },
      },
      {
        name: "create_attribute",
        description: "Create an attribute on a collection",
        inputSchema: {
          type: "object",
          properties: {
            collectionId: { type: "string" },
            key: { type: "string" },
            type: { type: "string", enum: ["string", "integer", "boolean", "json", "float", "email", "url", "datetime"] },
            size: { type: "number", default: 255 },
            required: { type: "boolean", default: false },
            default: { type: ["string", "number", "boolean", "null"] },
            array: { type: "boolean", default: false },
            enum: { type: "array", items: { type: "string" } },
          },
          required: ["collectionId", "key", "type"],
        },
      },
      {
        name: "list_indexes",
        description: "List indexes for a collection",
        inputSchema: {
          type: "object",
          properties: {
            collectionId: { type: "string" },
          },
          required: ["collectionId"],
        },
      },
      {
        name: "create_index",
        description: "Create an index on a collection",
        inputSchema: {
          type: "object",
          properties: {
            collectionId: { type: "string" },
            key: { type: "string" },
            type: { type: "string", enum: ["key", "fulltext"] },
            attributes: { type: "array", items: { type: "string" } },
          },
          required: ["collectionId", "key", "type", "attributes"],
        },
      },
      {
        name: "delete_index",
        description: "Delete an index from a collection",
        inputSchema: {
          type: "object",
          properties: {
            collectionId: { type: "string" },
            key: { type: "string" },
          },
          required: ["collectionId", "key"],
        },
      },
      {
        name: "get_bucket",
        description: "Get storage bucket info",
        inputSchema: {
          type: "object",
          properties: {
            bucketId: { type: "string" },
          },
        },
      },
      {
        name: "create_bucket",
        description: "Create storage bucket",
        inputSchema: {
          type: "object",
          properties: {
            bucketId: { type: "string" },
            name: { type: "string" },
            permissions: { type: "array", items: { type: "string" }, default: [] },
            maximumFileSize: { type: "number", default: 104857600 },
            allowedFileExtensions: { type: "array", items: { type: "string" }, default: [] },
          },
          required: ["bucketId", "name"],
        },
      },
      {
        name: "check_attribute_limits",
        description: "Check attribute limits for all collections",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "run_full_setup",
        description: "Run complete database setup (collections, attributes, indexes, bucket)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "run_auto_fix",
        description: "Run auto-fix for health check issues",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "run_media_migration",
        description: "Run or check media migration status",
        inputSchema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["run", "status"], default: "status" },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "health_check": {
        const { quick = false } = args as { quick?: boolean };
        const report = quick 
          ? await (await import("./health/extended")).runQuickHealthCheck()
          : await runExtendedHealthChecks();
        return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
      }

      case "list_collections": {
        const collections = await listCollections();
        return { content: [{ type: "text", text: JSON.stringify(collections, null, 2) }] };
      }

      case "get_collection": {
        const { collectionId } = args as { collectionId: string };
        const collection = await getCollection(collectionId);
        return { content: [{ type: "text", text: JSON.stringify(collection, null, 2) }] };
      }

      case "create_collection": {
        const { collectionId, name, permissions = [] } = args as { collectionId: string; name: string; permissions?: string[] };
        const result = await createCollection(collectionId, name, permissions);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "list_attributes": {
        const { collectionId } = args as { collectionId: string };
        const attrs = await listAttributes(collectionId);
        return { content: [{ type: "text", text: JSON.stringify(attrs, null, 2) }] };
      }

      case "create_attribute": {
        const { collectionId, key, type, size = 255, required = false, default: defaultValue, array = false, enum: enumValues } = args as { 
          collectionId: string; 
          key: string; 
          type: string; 
          size?: number; 
          required?: boolean; 
          default?: unknown; 
          array?: boolean; 
          enum?: string[] 
        };
        
        const { createStringAttribute, createIntegerAttribute, createBooleanAttribute, createJsonAttribute, createFloatAttribute, createEmailAttribute, createUrlAttribute, createDatetimeAttribute } = await import("./client");
        
        switch (type) {
          case "string":
            await createStringAttribute(collectionId, key, size, required, defaultValue as string, array, enumValues);
            break;
          case "integer":
            await createIntegerAttribute(collectionId, key, required, defaultValue as number, undefined, undefined, array);
            break;
          case "boolean":
            await createBooleanAttribute(collectionId, key, required, defaultValue as boolean, array);
            break;
          case "json":
            await createJsonAttribute(collectionId, key, required, array);
            break;
          case "float":
            await createFloatAttribute(collectionId, key, required, defaultValue as number, undefined, undefined, array);
            break;
          case "email":
            await createEmailAttribute(collectionId, key, required, defaultValue as string, array);
            break;
          case "url":
            await createUrlAttribute(collectionId, key, required, defaultValue as string, array);
            break;
          case "datetime":
            await createDatetimeAttribute(collectionId, key, required, defaultValue as string, array);
            break;
        }
        
        return { content: [{ type: "text", text: `Attribute "${key}" created on ${collectionId}` }] };
      }

      case "list_indexes": {
        const { collectionId } = args as { collectionId: string };
        const indexes = await listIndexes(collectionId);
        return { content: [{ type: "text", text: JSON.stringify(indexes, null, 2) }] };
      }

      case "create_index": {
        const { collectionId, key, type, attributes } = args as { collectionId: string; key: string; type: "key" | "fulltext"; attributes: string[] };
        await createIndex(collectionId, key, type, attributes);
        return { content: [{ type: "text", text: `Index "${key}" created on ${collectionId}` }] };
      }

      case "delete_index": {
        const { collectionId, key } = args as { collectionId: string; key: string };
        await deleteIndex(collectionId, key);
        return { content: [{ type: "text", text: `Index "${key}" deleted from ${collectionId}` }] };
      }

      case "get_bucket": {
        const { bucketId } = args as { bucketId?: string };
        const bucket = await getBucket(bucketId || "changers-media");
        return { content: [{ type: "text", text: JSON.stringify(bucket, null, 2) }] };
      }

      case "create_bucket": {
        const { bucketId, name, permissions = [], maximumFileSize = 104857600, allowedFileExtensions = [] } = args as { 
          bucketId: string; 
          name: string; 
          permissions?: string[]; 
          maximumFileSize?: number; 
          allowedFileExtensions?: string[] 
        };
        const { createBucket } = await import("./client");
        const bucket = await createBucket(bucketId, name, permissions, false, true, maximumFileSize, allowedFileExtensions);
        return { content: [{ type: "text", text: JSON.stringify(bucket, null, 2) }] };
      }

      case "check_attribute_limits": {
        const limits = await Promise.all(
          getAllCollectionDefinitions().map(async (def) => {
            const status = await getAttributeLimitStatus(def.id);
            return { collection: def.name, ...status };
          })
        );
        return { content: [{ type: "text", text: JSON.stringify(limits, null, 2) }] };
      }

      case "run_full_setup": {
        const results = await (await import("./migrations/runner")).runFullSetup();
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      case "run_auto_fix": {
        const results = await (await import("./migrations/runner")).runAutoFixMigrations();
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      }

      case "run_media_migration": {
        const { action = "status" } = args as { action?: "run" | "status" };
        const result = action === "run" 
          ? await runMigrateMedia() 
          : await checkMigrationStatus();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "health://report",
        name: "Health Report",
        description: "Current database health report",
        mimeType: "application/json",
      },
      {
        uri: "schema://collections",
        name: "Collection Definitions",
        description: "All collection schema definitions",
        mimeType: "application/json",
      },
      {
        uri: "schema://indexes",
        name: "Required Indexes",
        description: "All required indexes",
        mimeType: "application/json",
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case "health://report": {
      const report = await runExtendedHealthChecks();
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(report, null, 2) }] };
    }
    case "schema://collections": {
      const defs = getAllCollectionDefinitions();
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(defs, null, 2) }] };
    }
    case "schema://indexes": {
      const { REQUIRED_INDEXES } = await import("./schema/indexes");
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(REQUIRED_INDEXES, null, 2) }] };
    }
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Changers DB Admin MCP server running on stdio");
}

main().catch((error) => {
  console.error("MCP server error:", error);
  process.exit(1);
});