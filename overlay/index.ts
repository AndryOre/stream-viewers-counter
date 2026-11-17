import { adapters } from "./adapters";
import { STALE_AFTER_MS, createViewerBoard, persistBoard, restoreBoard } from "./board";
import { render } from "./render";
import { connectStreamerbot } from "./streamerbot";

const REFRESH_INTERVAL_MS = 1000;

function readPort(raw: string | null): number {
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : 8080;
}

function start(): void {
  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root element");

  const params = new URLSearchParams(window.location.search);
  const board = createViewerBoard({ staleAfterMs: STALE_AFTER_MS, now: Date.now });

  for (const reading of restoreBoard(window.localStorage, Date.now())) board.apply(reading);

  const refresh = () => render(board.snapshot(), root);
  refresh();
  window.setInterval(refresh, REFRESH_INTERVAL_MS);

  connectStreamerbot(
    {
      host: params.get("host") ?? "127.0.0.1",
      port: readPort(params.get("port")),
      password: params.get("password") ?? undefined,
    },
    adapters,
    (reading) => {
      board.apply(reading);
      persistBoard(window.localStorage, board.readings());
      refresh();
    },
  );
}

start();
