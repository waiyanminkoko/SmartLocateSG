const APP_USER_KEY = "smartlocate:userId";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getAppUserId(): string {
  if (typeof window === "undefined") {
    return "server-side-user";
  }

  const existing = window.localStorage.getItem(APP_USER_KEY);
  if (existing) {
    return existing;
  }

  const next = generateId();
  window.localStorage.setItem(APP_USER_KEY, next);
  return next;
}
