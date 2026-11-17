import { StreamerbotClient } from "@streamerbot/client";
import type { EventAdapter, Reading } from "./types";

interface ConnectionConfig {
  host: string;
  port: number;
  password?: string;
}

interface Envelope {
  event?: { source?: unknown; type?: unknown };
  data?: unknown;
}

function buildSubscription(adapters: Record<string, EventAdapter>): Record<string, string[]> {
  const subscription: Record<string, string[]> = {};
  for (const name of Object.keys(adapters)) {
    const [source, type] = name.split(".");
    if (!source || !type) continue;
    (subscription[source] ??= []).push(type);
  }
  return subscription;
}

export function connectStreamerbot(
  config: ConnectionConfig,
  adapters: Record<string, EventAdapter>,
  onReading: (reading: Reading) => void,
): void {
  new StreamerbotClient({
    host: config.host,
    port: config.port,
    password: config.password,
    autoReconnect: true,
    retries: -1,
    subscribe: buildSubscription(adapters) as never,
    onData: (payload: Envelope) => {
      const source = payload?.event?.source;
      const type = payload?.event?.type;
      if (typeof source !== "string" || typeof type !== "string") return;
      const adapter = adapters[`${source}.${type}`];
      if (!adapter) return;
      const parsed = adapter(payload.data, Date.now());
      if (parsed) onReading(parsed);
    },
    onError: (error) => console.warn("Streamer.bot connection error", error),
  });
}
