export type LogContext = Record<string, string | number | boolean | null | undefined>;

const serializeError = (error: unknown): string => {
  if (error instanceof Error) return error.name;
  return "UnknownError";
};

const writeLog = (level: "info" | "warn" | "error", event: string, context: LogContext = {}): void => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
};

export const logInfo = (event: string, context?: LogContext): void => writeLog("info", event, context);
export const logWarn = (event: string, context?: LogContext): void => writeLog("warn", event, context);
export const logError = (event: string, error: unknown, context: LogContext = {}): void =>
  writeLog("error", event, { ...context, error_type: serializeError(error) });
