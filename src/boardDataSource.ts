import type { BoardNode, BoardEdge, BoardVersion } from "./boardTypes";
import { normalizeNodeType } from "./boardTypes";
import { authClient } from "./auth/authClient";

export type BoardGraph = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  version?: string | null;
  description?: string | null;
  board_name?: string | null;
  is_published?: boolean | null;
};

export interface BoardDataSource {
  getCurrentBoard(boardId: string, version?: string): Promise<BoardGraph>;
  getVersions(boardId: string): Promise<BoardVersion[]>;
  getActiveVersion(boardId: string): Promise<string>;
  createVersion(payload: {
    version: string;
    name: string;
    description: string;
    is_published?: boolean | null;
  }): Promise<void>;
  deleteVersion(payload: { version: string }): Promise<void>;
  updateBoard(payload: {
    version: string;
    nodes: BoardNode[];
    edges: BoardEdge[];
    description?: string | null;
    board_name?: string | null;
    is_published?: boolean | null;
  }): Promise<void>;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

function getMutationHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...authClient.getAuthHeaders(),
  };
}

function handleAuthFailure(res: Response): void {
  if (res.status === 401 || res.status === 403) {
    authClient.clearToken();
  }
}

function getRawNodeType(node: unknown): unknown {
  const record = node as Record<string, unknown>;
  return record.node_type ?? record.nodeType ?? record.type ?? record.kind ?? record.category;
}

function normalizePicturePath(picturePath: unknown): string | null {
  if (typeof picturePath !== "string") return null;

  const value = picturePath.trim();
  if (!value || value.toLowerCase() === "none" || value.toLowerCase() === "null") return null;

  return value;
}

function normalizePublishedFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

class HttpBoardDataSource implements BoardDataSource {
  async getCurrentBoard(boardId: string, version?: string): Promise<BoardGraph> {
    let url = `${API_BASE_URL}/graph/board`;
    if (version) {
      const qp = new URLSearchParams({ version });
      url += `?${qp.toString()}`;
    }

    console.log("[BoardDataSource] Попытка загрузить доску с сервера", {
      boardId,
      url,
      version,
    });

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error(
          "[BoardDataSource] Сервер ответил ошибкой",
          res.status,
          res.statusText
        );
        throw new Error(
          `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      const data = await res.json();

      console.log(
        "[BoardDataSource] Успешно получили данные от сервера",
        data
      );

      const nodes = (data.nodes as BoardNode[]).map((n) => ({
        ...n,
        node_type: normalizeNodeType(getRawNodeType(n)),
        picture_path: normalizePicturePath((n as any).picture_path),
      }));

      return {
        nodes,
        edges: data.edges as BoardEdge[],
        version: typeof data.version === "string" ? data.version : version ?? null,
        description: typeof data.description === "string" ? data.description : null,
        board_name: typeof data.board_name === "string" ? data.board_name : null,
        is_published: normalizePublishedFlag((data as Record<string, unknown>).is_published),
      };
    } catch (error) {
      console.error(
        "[BoardDataSource] Ошибка при подключении к серверу",
        error
      );
      throw error;
    }
  }

  async getVersions(boardId: string): Promise<BoardVersion[]> {
    const url = `${API_BASE_URL}/graph/versions`;

    console.log("[BoardDataSource] Запрашиваем список версий", {
      boardId,
      url,
    });

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error(
          "[BoardDataSource] Ошибка при запросе версий",
          res.status,
          res.statusText
        );
        throw new Error(
          `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      const data = (await res.json()) as Array<Record<string, unknown>>;

      console.log("[BoardDataSource] Список версий получен", data);
      return data.map((version) => ({
        version: typeof version.version === "string" ? version.version : "",
        name: typeof version.name === "string" ? version.name : "",
        description: typeof version.description === "string" ? version.description : "",
        is_published: normalizePublishedFlag(version.is_published),
      }));
    } catch (error) {
      console.error(
        "[BoardDataSource] Ошибка при запросе версий доски",
        error
      );
      throw error;
    }
  }

  async getActiveVersion(boardId: string): Promise<string> {
    const url = `${API_BASE_URL}/graph/active_version`;

    console.log("[BoardDataSource] Запрашиваем активную версию", {
      boardId,
      url,
    });

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        console.error(
          "[BoardDataSource] Ошибка при запросе активной версии",
          res.status,
          res.statusText
        );
        throw new Error(
          `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      const data = (await res.json()) as { version: string };

      console.log("[BoardDataSource] Активная версия получена", data);
      return data.version;
    } catch (error) {
      console.error(
        "[BoardDataSource] Ошибка при запросе активной версии",
        error
      );
      throw error;
    }
  }

  async createVersion(payload: {
    version: string;
    name: string;
    description: string;
    is_published?: boolean | null;
  }): Promise<void> {
    const url = `${API_BASE_URL}/graph/versions`;

    console.log("[BoardDataSource] Создаем новую версию", {
      url,
      payload,
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: getMutationHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        handleAuthFailure(res);
        console.error(
          "[BoardDataSource] Ошибка при создании версии",
          res.status,
          res.statusText
        );
        throw new Error(
          `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      await res.json();
      console.log("[BoardDataSource] Версия успешно создана");
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при создании версии", error);
      throw error;
    }
  }

  async deleteVersion(payload: { version: string }): Promise<void> {
    const url = `${API_BASE_URL}/graph/versions`;

    console.log("[BoardDataSource] Удаляем версию", {
      url,
      payload,
    });

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: getMutationHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        handleAuthFailure(res);
        console.error(
          "[BoardDataSource] Ошибка при удалении версии",
          res.status,
          res.statusText
        );
        throw new Error(
          `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      await res.json();
      console.log("[BoardDataSource] Версия успешно удалена");
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при удалении версии", error);
      throw error;
    }
  }

  async updateBoard(payload: {
    version: string;
    nodes: BoardNode[];
    edges: BoardEdge[];
    description?: string | null;
    board_name?: string | null;
    is_published?: boolean | null;
  }): Promise<void> {
    const url = `${API_BASE_URL}/graph/board`;

    console.log("[BoardDataSource] Публикуем доску на сервер", {
      url,
      payload,
    });

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: getMutationHeaders(),
        body: JSON.stringify({
          version: payload.version,
          nodes: payload.nodes,
          edges: payload.edges,
          description:
            payload.description !== undefined ? payload.description : null,
          board_name:
            payload.board_name !== undefined ? payload.board_name : null,
          is_published:
            payload.is_published !== undefined ? payload.is_published : null,
        }),
      });

      if (!res.ok) {
        handleAuthFailure(res);
        console.error(
          "[BoardDataSource] Сервер ответил ошибкой при публикации",
          res.status,
          res.statusText
        );
        throw new Error(
          `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      const data = await res.json();
      console.log("[BoardDataSource] Публикация прошла успешно", data);
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при публикации доски", error);
      throw error;
    }
  }
}

export const boardDataSource: BoardDataSource = new HttpBoardDataSource();
