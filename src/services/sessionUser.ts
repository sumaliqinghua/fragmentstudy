interface SessionUserResult {
  data: {
    session: {
      user: { id: string };
    } | null;
  };
  error: unknown | null;
}

export async function getSessionUserId(
  loadSession: () => Promise<SessionUserResult>
): Promise<string | null> {
  const { data, error } = await loadSession();
  if (error) throw error;

  const userId = data.session?.user.id.trim();
  return userId || null;
}
