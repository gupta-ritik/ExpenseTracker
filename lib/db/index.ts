import { drizzle } from "drizzle-orm/node-postgres";
import { databasePool } from "./connection";
import * as authSchema from "./auth-schema";
import * as schema from "./schema";

function connect() {
  return drizzle(databasePool(), { schema: { ...authSchema, ...schema } });
}

let connection: ReturnType<typeof connect> | undefined;

export function db() {
  connection ??= connect();
  return connection;
}
