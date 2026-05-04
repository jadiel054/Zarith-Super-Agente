type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, objOrMsg: unknown, msg?: string): void {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] ${level.toUpperCase()}`;
  const message = msg ?? (typeof objOrMsg === "string" ? objOrMsg : "");
  const data = msg ? objOrMsg : undefined;
  const extra = data !== undefined && data !== null && Object.keys(data as object).length > 0
    ? " " + JSON.stringify(data)
    : "";

  const line = `${prefix} ${message}${extra}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (objOrMsg: unknown, msg?: string) => log("debug", objOrMsg, msg),
  info: (objOrMsg: unknown, msg?: string) => log("info", objOrMsg, msg),
  warn: (objOrMsg: unknown, msg?: string) => log("warn", objOrMsg, msg),
  error: (objOrMsg: unknown, msg?: string) => log("error", objOrMsg, msg),
};
