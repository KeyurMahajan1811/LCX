const KEY = "lcx-desk-credentials";

export type StoredCredentials = {
  apiKey: string;
  secret: string;
};

export function readCredentials(): StoredCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCredentials;
    if (!parsed.apiKey || !parsed.secret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCredentials(value: StoredCredentials | null) {
  if (value) window.localStorage.setItem(KEY, JSON.stringify(value));
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("lcx-credentials"));
}
