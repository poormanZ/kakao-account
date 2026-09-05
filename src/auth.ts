export interface AuthUser {
  id: number;
  nickname: string | null;
  profile_image_url: string | null;
}

interface SessionUserRow extends AuthUser {
  expires_at: string;
}

export const getCookie = (request: Request, name: string): string | null => {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const hashSessionId = async (sessionId: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const getSessionUser = async (
  db: D1Database,
  sessionId: string,
): Promise<SessionUserRow | null> => {
  const sessionHash = await hashSessionId(sessionId);
  const session = await db.prepare(
    `SELECT u.id, u.nickname, u.profile_image_url, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? LIMIT 1`,
  ).bind(sessionHash).first<SessionUserRow>();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionHash).run();
    return null;
  }

  await db.prepare("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(sessionHash).run();
  return session;
};

export const getAuthenticatedUser = async (
  request: Request,
  db: D1Database,
  sessionCookieName: string,
): Promise<AuthUser | null> => {
  const sessionId = getCookie(request, sessionCookieName);
  if (!sessionId) return null;

  const sessionUser = await getSessionUser(db, sessionId);
  if (!sessionUser) return null;

  return {
    id: sessionUser.id,
    nickname: sessionUser.nickname,
    profile_image_url: sessionUser.profile_image_url,
  };
};
