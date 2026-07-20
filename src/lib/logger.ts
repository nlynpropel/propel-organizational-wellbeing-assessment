// Development-safe error logging.
// Logs Supabase error code/message and the failing function/route in dev only.
// Never logs secure tokens, API keys, emails, or response content.

const isDev = import.meta.env.DEV;

type LoggableError = {
  code?: string;
  message?: string;
  details?: unknown;
  hint?: string;
};

export function logDbError(context: {
  fn: string;
  route?: string;
  error: LoggableError | unknown;
}) {
  if (!isDev) return;
  const { fn, route, error } = context;
  const e = error as LoggableError;
  console.error(`[DB] ${fn}${route ? ` @ ${route}` : ''}`, {
    code: e?.code,
    message: e?.message,
    hint: e?.hint,
  });
}

export function logServiceError(context: {
  fn: string;
  route?: string;
  error: unknown;
}) {
  if (!isDev) return;
  const { fn, route, error } = context;
  const e = error as LoggableError;
  console.error(`[Service] ${fn}${route ? ` @ ${route}` : ''}`, {
    code: e?.code,
    message: e?.message,
  });
}
