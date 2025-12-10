import type { BoardNode, BoardEdge, BoardVersion } from "./boardTypes";

export type BoardGraph = {
  nodes: BoardNode[];
  edges: BoardEdge[];
};

export interface BoardDataSource {
  getCurrentBoard(boardId: string, version?: string): Promise<BoardGraph>;
  getVersions(boardId: string): Promise<BoardVersion[]>;
  getActiveVersion(boardId: string): Promise<string>;
  updateBoard(payload: {
    version: string;
    nodes: BoardNode[];
    edges: BoardEdge[];
    description?: string | null;
    board_name?: string | null;
  }): Promise<void>;
}

// Базовый URL API — потом можно перенастроить через .env
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

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

      return {
        nodes: data.nodes as BoardNode[],
        edges: data.edges as BoardEdge[],
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

      const data = (await res.json()) as BoardVersion[];

      console.log("[BoardDataSource] Список версий получен", data);
      return data;
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

  async updateBoard(payload: {
    version: string;
    nodes: BoardNode[];
    edges: BoardEdge[];
    description?: string | null;
    board_name?: string | null;
  }): Promise<void> {
    const url = `${API_BASE_URL}/graph/board`;

    console.log("[BoardDataSource] Публикуем доску на сервер", {
      url,
      payload,
    });

    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: payload.version,
          nodes: payload.nodes,
          edges: payload.edges,
          description:
            payload.description !== undefined ? payload.description : null,
          board_name:
            payload.board_name !== undefined ? payload.board_name : null,
        }),
      });

      if (!res.ok) {
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
