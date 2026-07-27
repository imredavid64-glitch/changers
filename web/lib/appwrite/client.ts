"use client";

import { Account, Client, Databases, ID, Permission, Query, Role, Storage } from "appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";

const client = new Client();

if (appwriteConfig.endpoint && appwriteConfig.projectId) {
  client.setEndpoint(appwriteConfig.endpoint).setProject(appwriteConfig.projectId);
}

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

export { client, account, databases, storage, ID, Permission, Query, Role };
