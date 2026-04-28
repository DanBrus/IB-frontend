export const AUTH_TOKEN_STORAGE_KEY = "investigation_auth_token";

const AUTH_BASE_URL = (import.meta.env.VITE_AUTH_BASE_URL ?? "/auth").replace(/\/$/, "");

type LoginResponse = {
  token?: unknown;
};

type ConfirmResponse = {
  ok?: unknown;
  valid?: unknown;
  authenticated?: unknown;
};

export class AuthClientError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AuthClientError";
    this.status = status;
  }
}

export interface AuthClient {
  login(secret: string): Promise<string>;
  confirm(token?: string): Promise<boolean>;
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
  getAuthHeaders(token?: string): Record<string, string>;
}

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown; error?: unknown; detail?: unknown };
    const message = data.message ?? data.error ?? data.detail;
    return typeof message === "string" && message.trim() ? message : fallback;
  } catch {
    return fallback;
  }
}

function isPositiveConfirmResponse(data: ConfirmResponse): boolean {
  return data.ok === true || data.valid === true || data.authenticated === true;
}

function normalizeToken(token: string): string {
  return token.trim();
}

export const authClient: AuthClient = {
  async login(secret: string): Promise<string> {
    const res = await fetch(`${AUTH_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ secret }),
    });

    if (!res.ok) {
      const message = await readErrorMessage(res, "Не удалось выполнить аутентификацию.");
      throw new AuthClientError(message, res.status);
    }

    const data = (await res.json()) as LoginResponse;
    if (typeof data.token !== "string" || !data.token.trim()) {
      throw new AuthClientError("Сервер аутентификации не вернул токен безопасности.");
    }

    const token = normalizeToken(data.token);
    this.setToken(token);
    return token;
  },

  async confirm(token?: string): Promise<boolean> {
    const normalizedToken = normalizeToken(token ?? this.getToken() ?? "");
    if (!normalizedToken) return false;

    const res = await fetch(`${AUTH_BASE_URL}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(normalizedToken),
      },
      body: JSON.stringify({ token: normalizedToken }),
    });

    if (res.status === 401 || res.status === 403) return false;

    if (!res.ok) {
      const message = await readErrorMessage(res, "Не удалось проверить токен безопасности.");
      throw new AuthClientError(message, res.status);
    }

    const data = (await res.json()) as ConfirmResponse;
    return isPositiveConfirmResponse(data);
  },

  getToken(): string | null {
    const storage = getLocalStorage();
    const token = storage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
    return token && token.trim() ? token : null;
  },

  setToken(token: string): void {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
      this.clearToken();
      return;
    }

    getLocalStorage()?.setItem(AUTH_TOKEN_STORAGE_KEY, normalizedToken);
  },

  clearToken(): void {
    getLocalStorage()?.removeItem(AUTH_TOKEN_STORAGE_KEY);
  },

  getAuthHeaders(token?: string): Record<string, string> {
    const normalizedToken = normalizeToken(token ?? this.getToken() ?? "");
    return normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {};
  },
};
