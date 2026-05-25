import type {
  BoardChunk,
  BoardEdge,
  FreeIds,
  BoardNode,
  BoardVersion,
  CanonicalEntity,
} from "./boardTypes";
import {
  formatBoardVersion,
  normalizeNodeType,
  parseBoardVersion,
} from "./boardTypes";
import { authClient } from "./auth/authClient";
import { sortChunks } from "./boardDescription";
import type { EntitySizeMap } from "./nodeCardMetrics";
import { getPrimaryNodePicturePath } from "./canonicalEntities";

export type BoardGraph = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  version?: number | null;
  description?: string | null;
  board_name?: string | null;
  is_published?: boolean | null;
};

export type CanonicalEntitiesSyncResult = {
  persisted: boolean;
};

export type CanonicalEntityDeleteResult = {
  outcome: "deleted" | "blocked" | "placeholder";
};

export interface BoardDataSource {
  getCurrentBoard(boardId: string, version?: number | string): Promise<BoardGraph>;
  getCanonicalEntityAnalysis(
    boardId: string,
    payload: {
      ceId: number;
      entitySizes: EntitySizeMap;
    }
  ): Promise<BoardGraph>;
  getNodes(boardId: string, version?: number | string): Promise<BoardNode[]>;
  getVersions(boardId: string): Promise<BoardVersion[]>;
  getCanonicalEntities(boardId: string): Promise<CanonicalEntity[]>;
  getFreeIds(boardId: string): Promise<FreeIds>;
  createVersion(payload: {
    version: number;
    name: string;
    description: string;
    is_published?: boolean | null;
  }): Promise<void>;
  deleteVersion(payload: { version: number }): Promise<void>;
  updateBoard(payload: {
    version: number;
    nodes: BoardNode[];
    edges: BoardEdge[];
    description?: string | null;
    board_name?: string | null;
    is_published?: boolean | null;
  }): Promise<void>;
  updateCanonicalEntities(
    boardId: string,
    entities: CanonicalEntity[]
  ): Promise<CanonicalEntitiesSyncResult>;
  deleteCanonicalEntity(
    boardId: string,
    entityId: number,
    currentEntities: CanonicalEntity[]
  ): Promise<CanonicalEntityDeleteResult>;
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

function normalizeNodePicturePaths(rawValue: unknown): string[] {
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((item) => normalizePicturePath(item))
      .filter((item): item is string => item !== null);
  }

  const singlePicturePath = normalizePicturePath(rawValue);
  return singlePicturePath ? [singlePicturePath] : [];
}

function normalizePublishedFlag(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function normalizeNumericId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length === 0) return null;

  const normalizedValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(normalizedValue)) return null;

  return Math.trunc(normalizedValue);
}

function normalizeFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim().length === 0) return null;

  const normalizedValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalizedValue) ? normalizedValue : null;
}

async function readErrorMessage(res: Response): Promise<string | null> {
  try {
    const payload = (await res.clone().json()) as unknown;
    if (typeof payload === "string" && payload.trim()) {
      return payload.trim();
    }

    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      const candidate =
        record.detail ?? record.message ?? record.error ?? record.status;
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch {
    // ignore JSON parse errors and fall back to text
  }

  try {
    const text = await res.text();
    const normalizedText = text.trim();
    return normalizedText.length > 0 ? normalizedText : null;
  } catch {
    return null;
  }
}

function normalizeChunk(rawChunk: unknown): BoardChunk | null {
  if (!rawChunk || typeof rawChunk !== "object") return null;

  const chunk = rawChunk as Record<string, unknown>;
  const description = typeof chunk.description === "string" ? chunk.description.trim() : "";
  if (!description) return null;

  const rawChunkId = typeof chunk.c_id === "number" ? chunk.c_id : Number(chunk.c_id ?? 0);
  const rawPriority =
    typeof chunk.chunk_priority === "number"
      ? chunk.chunk_priority
      : Number(chunk.chunk_priority ?? 0);

  return {
    c_id: Number.isFinite(rawChunkId) ? rawChunkId : 0,
    description,
    chunk_priority: Number.isFinite(rawPriority) ? rawPriority : 0,
    timecode: typeof chunk.timecode === "string" ? chunk.timecode : "",
    board_source: normalizeFiniteNumber(chunk.board_source),
  };
}

function normalizeChunks(rawChunks: unknown): BoardChunk[] {
  if (!Array.isArray(rawChunks)) return [];

  return sortChunks(
    rawChunks
      .map((rawChunk) => normalizeChunk(rawChunk))
      .filter((chunk): chunk is BoardChunk => chunk !== null)
  );
}

function normalizeNode(rawNode: unknown): BoardNode | null {
  if (!rawNode || typeof rawNode !== "object") return null;

  const node = rawNode as Record<string, unknown>;
  const rawNodeId = typeof node.node_id === "number" ? node.node_id : Number(node.node_id ?? 0);
  const rawPosX = typeof node.pos_x === "number" ? node.pos_x : Number(node.pos_x ?? 0);
  const rawPosY = typeof node.pos_y === "number" ? node.pos_y : Number(node.pos_y ?? 0);
  const ceId = normalizeNumericId(node.ce_id ?? node.CE_id);

  if (
    !Number.isFinite(rawNodeId) ||
    !Number.isFinite(rawPosX) ||
    !Number.isFinite(rawPosY) ||
    ceId === null
  ) {
    return null;
  }

  return {
    node_id: rawNodeId,
    ce_id: ceId,
    name: typeof node.name === "string" ? node.name : "",
    pos_x: rawPosX,
    pos_y: rawPosY,
    node_type: normalizeNodeType(getRawNodeType(node)),
    picture_path: normalizeNodePicturePaths(node.picture_path),
    description: normalizeChunks(node.description),
  };
}

function normalizeEdge(rawEdge: unknown): BoardEdge | null {
  if (!rawEdge || typeof rawEdge !== "object") return null;

  const edge = rawEdge as Record<string, unknown>;
  const rawEdgeId = typeof edge.edge_id === "number" ? edge.edge_id : Number(edge.edge_id ?? 0);
  const rawNode1 = typeof edge.node1 === "number" ? edge.node1 : Number(edge.node1 ?? 0);
  const rawNode2 = typeof edge.node2 === "number" ? edge.node2 : Number(edge.node2 ?? 0);

  if (!Number.isFinite(rawEdgeId) || !Number.isFinite(rawNode1) || !Number.isFinite(rawNode2)) {
    return null;
  }

  return {
    edge_id: rawEdgeId,
    node1: rawNode1,
    node2: rawNode2,
    description: normalizeChunks(edge.description),
  };
}

function serializeRequestedVersion(version: number | string): string {
  if (typeof version === "number") return formatBoardVersion(version);

  const parsedVersion = parseBoardVersion(version);
  return parsedVersion === null ? version.trim() : formatBoardVersion(parsedVersion);
}

function normalizePicturePaths(rawValue: unknown): string[] {
  if (!Array.isArray(rawValue)) return [];

  return rawValue
    .map((item) => normalizePicturePath(item))
    .filter((item): item is string => item !== null);
}

function normalizeCanonicalEntity(rawEntity: unknown): CanonicalEntity | null {
  if (!rawEntity || typeof rawEntity !== "object") return null;

  const entity = rawEntity as Record<string, unknown>;
  const entityId = normalizeNumericId(entity.en_id);
  if (entityId === null) return null;

  return {
    en_id: entityId,
    name: typeof entity.name === "string" ? entity.name.trim() : "",
    entity_type: normalizeNodeType(entity.entity_type),
    picture_paths: normalizePicturePaths(entity.picture_paths),
    merged_to: normalizeNumericId(entity.merged_to),
  };
}

function normalizeFreeIds(rawValue: unknown): FreeIds | null {
  if (!rawValue || typeof rawValue !== "object") return null;

  const record = rawValue as Record<string, unknown>;
  const ceId = normalizeNumericId(record.ce_id);
  const nodeId = normalizeNumericId(record.node_id);
  const edgeId = normalizeNumericId(record.edge_id);
  const chunkId = normalizeNumericId(record.chunk_id);

  if (ceId === null || nodeId === null || edgeId === null || chunkId === null) {
    return null;
  }

  return {
    ce_id: ceId,
    node_id: nodeId,
    edge_id: edgeId,
    chunk_id: chunkId,
  };
}

function normalizeBoardGraph(
  rawValue: unknown,
  fallbackVersion?: number | string
): BoardGraph {
  const data = rawValue && typeof rawValue === "object"
    ? (rawValue as Record<string, unknown>)
    : {};

  const nodes = Array.isArray(data.nodes)
    ? data.nodes
        .map((rawNode) => normalizeNode(rawNode))
        .filter((node): node is BoardNode => node !== null)
        .sort((left, right) => left.node_id - right.node_id)
    : [];
  const edges = Array.isArray(data.edges)
    ? data.edges
        .map((rawEdge) => normalizeEdge(rawEdge))
        .filter((edge): edge is BoardEdge => edge !== null)
        .sort((left, right) => left.edge_id - right.edge_id)
    : [];

  return {
    nodes,
    edges,
    version:
      parseBoardVersion(data.version) ??
      (typeof fallbackVersion === "number" ? fallbackVersion : parseBoardVersion(fallbackVersion)) ??
      null,
    description: typeof data.description === "string" ? data.description : null,
    board_name: typeof data.board_name === "string" ? data.board_name : null,
    is_published: normalizePublishedFlag(data.is_published),
  };
}

function serializeCanonicalEntity(entity: CanonicalEntity): Record<string, unknown> {
  return {
    en_id: entity.en_id,
    name: entity.name,
    entity_type: entity.entity_type,
    picture_paths: entity.picture_paths,
    merged_to: entity.merged_to ?? null,
  };
}

class HttpBoardDataSource implements BoardDataSource {
  private async syncCanonicalEntitiesRequest(
    boardId: string,
    entities: CanonicalEntity[]
  ): Promise<Response> {
    const url = `${API_BASE_URL}/graph/canonical-entities`;

    console.log("[BoardDataSource] Синхронизируем canonical-entities", {
      boardId,
      url,
      entities,
    });

    return fetch(url, {
      method: "PUT",
      headers: getMutationHeaders(),
      body: JSON.stringify(entities.map((entity) => serializeCanonicalEntity(entity))),
    });
  }

  async getCurrentBoard(boardId: string, version?: number | string): Promise<BoardGraph> {
    let url = `${API_BASE_URL}/graph/board`;
    if (version !== undefined) {
      const qp = new URLSearchParams({ version: serializeRequestedVersion(version) });
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
        console.error("[BoardDataSource] Сервер ответил ошибкой", res.status, res.statusText);
        throw new Error(`HTTP error ${res.status}: ${res.statusText || "Unknown error"}`);
      }

      const data = (await res.json()) as Record<string, unknown>;

      console.log("[BoardDataSource] Успешно получили данные от сервера", data);
      return normalizeBoardGraph(data, version);
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при подключении к серверу", error);
      throw error;
    }
  }

  async getCanonicalEntityAnalysis(
    boardId: string,
    payload: {
      ceId: number;
      entitySizes: EntitySizeMap;
    }
  ): Promise<BoardGraph> {
    const query = new URLSearchParams({
      ce_id: String(payload.ceId),
      entitySizes: JSON.stringify(payload.entitySizes),
    });
    const url = `${API_BASE_URL}/analyze/canonical-entity?${query.toString()}`;

    console.log("[BoardDataSource] Загружаем аналитическую доску по canonical-entity", {
      boardId,
      url,
      payload,
    });

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorMessage = await readErrorMessage(res);
        console.error(
          "[BoardDataSource] Ошибка при загрузке аналитической доски",
          res.status,
          res.statusText,
          errorMessage
        );
        throw new Error(
          errorMessage ?? `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      const data = (await res.json()) as Record<string, unknown>;
      console.log("[BoardDataSource] Аналитическая доска получена", data);
      return normalizeBoardGraph(data, 0);
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при загрузке аналитической доски", error);
      throw error;
    }
  }

  async getNodes(boardId: string, version?: number | string): Promise<BoardNode[]> {
    let url = `${API_BASE_URL}/graph/nodes`;
    if (version !== undefined) {
      const qp = new URLSearchParams({ version: serializeRequestedVersion(version) });
      url += `?${qp.toString()}`;
    }

    console.log("[BoardDataSource] Запрашиваем ноды доски", {
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
        console.error("[BoardDataSource] Ошибка при запросе нод", res.status, res.statusText);
        throw new Error(`HTTP error ${res.status}: ${res.statusText || "Unknown error"}`);
      }

      const data = (await res.json()) as Array<Record<string, unknown>>;

      console.log("[BoardDataSource] Ноды получены", data);
      return data
        .map((rawNode) => normalizeNode(rawNode))
        .filter((node): node is BoardNode => node !== null)
        .sort((left, right) => left.node_id - right.node_id);
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при запросе нод доски", error);
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
        console.error("[BoardDataSource] Ошибка при запросе версий", res.status, res.statusText);
        throw new Error(`HTTP error ${res.status}: ${res.statusText || "Unknown error"}`);
      }

      const data = (await res.json()) as Array<Record<string, unknown>>;

      console.log("[BoardDataSource] Список версий получен", data);
      return data
        .map((version) => ({
          version: parseBoardVersion(version.version) ?? 0,
          name: typeof version.name === "string" ? version.name : "",
          description: typeof version.description === "string" ? version.description : "",
          is_published: normalizePublishedFlag(version.is_published),
        }))
        .sort((left, right) => left.version - right.version);
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при запросе версий доски", error);
      throw error;
    }
  }

  async getCanonicalEntities(boardId: string): Promise<CanonicalEntity[]> {
    const url = `${API_BASE_URL}/graph/canonical-entities`;

    console.log("[BoardDataSource] Запрашиваем canonical-entities", {
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
          "[BoardDataSource] Ошибка при запросе canonical-entities",
          res.status,
          res.statusText
        );
        throw new Error(`HTTP error ${res.status}: ${res.statusText || "Unknown error"}`);
      }

      const data = (await res.json()) as Array<Record<string, unknown>>;

      console.log("[BoardDataSource] Canonical-entities получены", data);
      return data
        .map((rawEntity) => normalizeCanonicalEntity(rawEntity))
        .filter((entity): entity is CanonicalEntity => entity !== null)
        .sort(
          (left, right) =>
            left.entity_type.localeCompare(right.entity_type, "ru") ||
            left.name.localeCompare(right.name, "ru") ||
            left.en_id - right.en_id
        );
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при запросе canonical-entities", error);
      throw error;
    }
  }

  async getFreeIds(boardId: string): Promise<FreeIds> {
    const url = `${API_BASE_URL}/graph/free-ids`;

    console.log("[BoardDataSource] Запрашиваем free-ids", {
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
        console.error("[BoardDataSource] Ошибка при запросе free-ids", res.status, res.statusText);
        throw new Error(`HTTP error ${res.status}: ${res.statusText || "Unknown error"}`);
      }

      const data = (await res.json()) as Record<string, unknown>;
      const freeIds = normalizeFreeIds(data);

      if (!freeIds) {
        throw new Error("Некорректный ответ сервера при запросе free-ids.");
      }

      console.log("[BoardDataSource] Free-ids получены", freeIds);
      return freeIds;
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при запросе free-ids", error);
      throw error;
    }
  }

  async createVersion(payload: {
    version: number;
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
        console.error("[BoardDataSource] Ошибка при создании версии", res.status, res.statusText);
        throw new Error(`HTTP error ${res.status}: ${res.statusText || "Unknown error"}`);
      }

      await res.json();
      console.log("[BoardDataSource] Версия успешно создана");
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при создании версии", error);
      throw error;
    }
  }

  async deleteVersion(payload: { version: number }): Promise<void> {
    const query = new URLSearchParams({ version: formatBoardVersion(payload.version) });
    const url = `${API_BASE_URL}/graph/versions?${query.toString()}`;

    console.log("[BoardDataSource] Удаляем версию", {
      url,
      payload,
    });

    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: getMutationHeaders(),
      });

      if (!res.ok) {
        handleAuthFailure(res);
        console.error("[BoardDataSource] Ошибка при удалении версии", res.status, res.statusText);
        throw new Error(`HTTP error ${res.status}: ${res.statusText || "Unknown error"}`);
      }

      await res.json();
      console.log("[BoardDataSource] Версия успешно удалена");
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при удалении версии", error);
      throw error;
    }
  }

  async updateBoard(payload: {
    version: number;
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
          nodes: payload.nodes.map((node) => ({
            node_id: node.node_id,
            ce_id: node.ce_id,
            name: node.name,
            pos_x: node.pos_x,
            pos_y: node.pos_y,
            node_type: node.node_type,
            picture_path: getPrimaryNodePicturePath(node.picture_path),
            description: node.description,
          })),
          edges: payload.edges.map((edge) => ({
            edge_id: edge.edge_id,
            node1: edge.node1,
            node2: edge.node2,
            description: edge.description,
          })),
          description: payload.description !== undefined ? payload.description : null,
          board_name: payload.board_name !== undefined ? payload.board_name : null,
          is_published: payload.is_published !== undefined ? payload.is_published : null,
        }),
      });

      if (!res.ok) {
        handleAuthFailure(res);
        const errorMessage = await readErrorMessage(res);
        console.error(
          "[BoardDataSource] Сервер ответил ошибкой при публикации",
          res.status,
          res.statusText,
          errorMessage
        );
        throw new Error(
          errorMessage ?? `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      const data = await res.json();
      console.log("[BoardDataSource] Публикация прошла успешно", data);
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при публикации доски", error);
      throw error;
    }
  }

  async updateCanonicalEntities(
    boardId: string,
    entities: CanonicalEntity[]
  ): Promise<CanonicalEntitiesSyncResult> {
    try {
      const res = await this.syncCanonicalEntitiesRequest(boardId, entities);

      if (!res.ok) {
        handleAuthFailure(res);
        const errorMessage = await readErrorMessage(res);
        console.error(
          "[BoardDataSource] Ошибка при синхронизации canonical-entities",
          res.status,
          res.statusText,
          errorMessage
        );
        throw new Error(
          errorMessage ?? `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      await res.json().catch(() => null);
      console.log("[BoardDataSource] Canonical-entities успешно синхронизированы");
      return { persisted: true };
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при синхронизации canonical-entities", error);
      throw error;
    }
  }

  async deleteCanonicalEntity(
    boardId: string,
    entityId: number,
    currentEntities: CanonicalEntity[]
  ): Promise<CanonicalEntityDeleteResult> {
    console.log("[BoardDataSource] Удаляем canonical-entity", {
      boardId,
      entityId,
    });

    try {
      const nextEntities = currentEntities.filter((entity) => entity.en_id !== entityId);

      if (nextEntities.length === currentEntities.length) {
        return { outcome: "deleted" };
      }

      const res = await this.syncCanonicalEntitiesRequest(boardId, nextEntities);

      if (res.status === 406) {
        handleAuthFailure(res);
        console.warn(
          "[BoardDataSource] Удаление canonical-entity заблокировано бизнес-правилами",
          entityId
        );
        return { outcome: "blocked" };
      }

      if (!res.ok) {
        handleAuthFailure(res);
        const errorMessage = await readErrorMessage(res);
        console.error(
          "[BoardDataSource] Ошибка при удалении canonical-entity",
          res.status,
          res.statusText,
          errorMessage
        );
        throw new Error(
          errorMessage ?? `HTTP error ${res.status}: ${res.statusText || "Unknown error"}`
        );
      }

      await res.json().catch(() => null);
      console.log("[BoardDataSource] Canonical-entity успешно удалена", entityId);
      return { outcome: "deleted" };
    } catch (error) {
      console.error("[BoardDataSource] Ошибка при удалении canonical-entity", error);
      throw error;
    }
  }
}

export const boardDataSource: BoardDataSource = new HttpBoardDataSource();
