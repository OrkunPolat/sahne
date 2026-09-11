// Ufak rota eşleyici: `/api/x/:id` deseni → RegExp + param adları.
import type { IncomingMessage, ServerResponse } from "node:http";

export type Handler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => Promise<void>;
export interface Route { method: string; pattern: RegExp; keys: string[]; handler: Handler }

export function route(method: string, path: string, handler: Handler): Route {
  const keys: string[] = [];
  const pattern = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) + "/?$");
  return { method, pattern, keys, handler };
}
