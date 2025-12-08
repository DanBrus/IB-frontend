// boardDataSource.ts
import type { BoardNode, BoardEdge } from "./boardTypes";

export type BoardGraph = {
  nodes: BoardNode[];
  edges: BoardEdge[];
};

export interface BoardDataSource {
  getCurrentBoard(boardId: string): Promise<BoardGraph>;
}

// Базовый URL API — потом можно перенастроить через .env
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001";

class HttpBoardDataSource implements BoardDataSource {
  async getCurrentBoard(boardId: string): Promise<BoardGraph> {
    const url = `${API_BASE_URL}/graph/board`;

    console.log(
      "[BoardDataSource] Попытка загрузить доску с сервера",
      { boardId, url }
    );

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Здесь позже появится Authorization, когда добавим токены
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

      console.log("[BoardDataSource] Успешно получили данные от сервера", data);

      // Здесь адаптируешь структуру data под свой формат
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
}

export const boardDataSource: BoardDataSource = new HttpBoardDataSource();
