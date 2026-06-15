import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { InvestigationBoardScreen } from "./InvestigationBoardScreen";
import type {
  BoardAccessMode,
  BoardViewMode,
  BoardEdge,
  BoardNode,
  BoardVersion,
  CanonicalEntity,
} from "./boardTypes";
import type {
  CanonicalEntitiesSyncResult,
  CanonicalEntityDeleteResult,
} from "./boardDataSource";
import { boardDataSource } from "./boardDataSource";
import { authClient } from "./auth/authClient";
import {
  applyCanonicalEntityPicturesToNodes,
  resolveCanonicalEntityRootId,
} from "./canonicalEntities";
import { getNodeCardEntitySizes } from "./nodeCardMetrics";

const AUTH_REJECTED_MESSAGE = "Токен безопасности истёк или был введён неверный код безопасности.";
const BOARD_ID = "demo-board";

type BoardSnapshot = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  versions: BoardVersion[];
  canonicalEntities: CanonicalEntity[];
  currentVersion: number | null;
  boardName?: string | null;
};

type AnalysisBoardInfo = {
  version: number;
  name: string | null;
  description: string | null;
};

type VersionFallbackStrategy = "min" | "max";
type LoadBoardSnapshotOptions = {
  fallbackStrategy?: VersionFallbackStrategy;
  canonicalEntities?: CanonicalEntity[];
};

function getRegularBoardTitle(boardName?: string | null): string {
  const normalizedBoardName = typeof boardName === "string" ? boardName.trim() : "";
  return normalizedBoardName || "Доска расследований";
}

function getAnalysisBoardTitle(boardName?: string | null): string {
  const normalizedBoardName = typeof boardName === "string" ? boardName.trim() : "";
  return normalizedBoardName
    ? `Аналитическая доска: ${normalizedBoardName}`
    : "Аналитическая доска";
}

function isVersionVisible(version: BoardVersion, accessMode: BoardAccessMode): boolean {
  return accessMode === "edit" || version.is_published !== false;
}

function getVisibleVersions(versions: BoardVersion[], accessMode: BoardAccessMode): BoardVersion[] {
  return versions.filter((version) => isVersionVisible(version, accessMode));
}

function resolveCurrentVersion(
  versions: BoardVersion[],
  requestedVersion: number | null | undefined,
  accessMode: BoardAccessMode,
  fallbackStrategy: VersionFallbackStrategy = "max"
): number | null {
  const visibleVersions = getVisibleVersions(versions, accessMode);

  if (visibleVersions.length === 0) return null;
  if (
    requestedVersion !== null &&
    requestedVersion !== undefined &&
    visibleVersions.some((version) => version.version === requestedVersion)
  ) {
    return requestedVersion;
  }

  return fallbackStrategy === "min"
    ? visibleVersions[0]?.version ?? null
    : visibleVersions[visibleVersions.length - 1]?.version ?? null;
}

async function loadBoardSnapshot(
  boardId: string,
  accessMode: BoardAccessMode,
  requestedVersion: number | null | undefined,
  options: LoadBoardSnapshotOptions = {}
): Promise<BoardSnapshot> {
  const fallbackStrategy = options.fallbackStrategy ?? "max";
  const hasCachedCanonicalEntities = options.canonicalEntities !== undefined;
  const [versionsList, canonicalEntitiesList] = await Promise.all([
    boardDataSource.getVersions(boardId),
    hasCachedCanonicalEntities
      ? Promise.resolve(options.canonicalEntities ?? [])
      : boardDataSource.getCanonicalEntities(boardId),
  ]);

  const resolvedVersion = resolveCurrentVersion(
    versionsList,
    requestedVersion,
    accessMode,
    fallbackStrategy
  );

  if (resolvedVersion === null) {
    return {
      nodes: [],
      edges: [],
      versions: versionsList,
      canonicalEntities: canonicalEntitiesList,
      currentVersion: null,
      boardName: null,
    };
  }

  const graph = await boardDataSource.getCurrentBoard(boardId, resolvedVersion);

  return {
    nodes: applyCanonicalEntityPicturesToNodes(graph.nodes, canonicalEntitiesList),
    edges: graph.edges,
    versions: versionsList,
    canonicalEntities: canonicalEntitiesList,
    currentVersion: resolvedVersion,
    boardName: graph.board_name ?? null,
  };
}

export default function App() {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [canonicalEntities, setCanonicalEntities] = useState<CanonicalEntity[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [boardViewMode, setBoardViewMode] = useState<BoardViewMode>("standard");
  const [analysisCeId, setAnalysisCeId] = useState<number | null>(null);
  const [analysisBoardInfo, setAnalysisBoardInfo] = useState<AnalysisBoardInfo | null>(null);
  const [boardTitle, setBoardTitle] = useState("Доска расследований");

  const [accessMode, setAccessMode] = useState<BoardAccessMode>("read");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveBannerVisible, setSaveBannerVisible] = useState(false);

  const applyBoardSnapshot = (snapshot: BoardSnapshot) => {
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    setVersions(snapshot.versions);
    setCanonicalEntities(snapshot.canonicalEntities);
    setCurrentVersion(snapshot.currentVersion);
    setBoardViewMode("standard");
    setAnalysisCeId(null);
    setAnalysisBoardInfo(null);
    setBoardTitle(getRegularBoardTitle(snapshot.boardName));
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    let cancelled = false;

    (async () => {
      try {
        const snapshot = await loadBoardSnapshot(BOARD_ID, "read", null, {
          fallbackStrategy: "min",
        });
        if (cancelled) return;
        applyBoardSnapshot(snapshot);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setError("Не удалось загрузить доску");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChangeVersion = async (version: number) => {
    const effectiveAccessMode = boardViewMode === "analysis" ? "read" : accessMode;
    const nextVersion = resolveCurrentVersion(versions, version, effectiveAccessMode);
    if (nextVersion === null || nextVersion !== version) return;

    setLoading(true);
    setError(null);

    try {
      const graph = await boardDataSource.getCurrentBoard(BOARD_ID, nextVersion);
      setNodes(applyCanonicalEntityPicturesToNodes(graph.nodes, canonicalEntities));
      setEdges(graph.edges);
      setCurrentVersion(nextVersion);
      setBoardViewMode("standard");
      setAnalysisCeId(null);
      setAnalysisBoardInfo(null);
      setBoardTitle(getRegularBoardTitle(graph.board_name));
      setLoading(false);
    } catch {
      setError("Не удалось загрузить выбранную версию доски");
      setLoading(false);
    }
  };

  const handleOpenCanonicalEntityAnalysis = async (ceId: number) => {
    const rootCeId = resolveCanonicalEntityRootId(ceId, canonicalEntities) ?? ceId;
    if (boardViewMode === "analysis" && analysisCeId === rootCeId) return;

    setLoading(true);

    try {
      const entitySizes = await getNodeCardEntitySizes();
      const graph = await boardDataSource.getCanonicalEntityAnalysis(BOARD_ID, {
        ceId: rootCeId,
        entitySizes,
      });

      setNodes(applyCanonicalEntityPicturesToNodes(graph.nodes, canonicalEntities));
      setEdges(graph.edges);
      setBoardViewMode("analysis");
      setAnalysisCeId(rootCeId);
      setAnalysisBoardInfo({
        version: graph.version ?? 0,
        name: graph.board_name ?? null,
        description: graph.description ?? null,
      });
      setBoardTitle(getAnalysisBoardTitle(graph.board_name));
    } catch (analysisError: unknown) {
      const message =
        analysisError instanceof Error
          ? analysisError.message
          : "Не удалось загрузить аналитическую доску по сущности.";
      window.alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = async (payload: {
    version: number;
    name: string;
    description: string;
    is_published?: boolean | null;
  }) => {
    if (accessMode !== "edit") {
      throw new Error("Режим редактирования недоступен.");
    }

    setLoading(true);
    setError(null);

    try {
      await boardDataSource.createVersion(payload);
      const snapshot = await loadBoardSnapshot(BOARD_ID, accessMode, payload.version, {
        canonicalEntities,
      });
      applyBoardSnapshot(snapshot);
      setLoading(false);
    } catch {
      setError("Не удалось создать новую версию доски");
      setLoading(false);
    }
  };

  const handleCanonicalEntitiesChange = async (
    nextEntities: CanonicalEntity[]
  ): Promise<CanonicalEntitiesSyncResult> => {
    const syncResult = await boardDataSource.updateCanonicalEntities(BOARD_ID, nextEntities);
    if (syncResult.persisted) {
      const refreshedCanonicalEntities = await boardDataSource.getCanonicalEntities(BOARD_ID);
      setCanonicalEntities(refreshedCanonicalEntities);
    } else {
      setCanonicalEntities(nextEntities);
    }
    return syncResult;
  };

  const handleCanonicalEntityDelete = async (
    entityId: number
  ): Promise<CanonicalEntityDeleteResult> => {
    const deleteResult = await boardDataSource.deleteCanonicalEntity(
      BOARD_ID,
      entityId,
      canonicalEntities
    );

    if (deleteResult.outcome === "deleted") {
      const refreshedCanonicalEntities = await boardDataSource.getCanonicalEntities(BOARD_ID);
      setCanonicalEntities(refreshedCanonicalEntities);
    }

    return deleteResult;
  };

  const handleCanonicalEntitiesManagerClose = async (shouldRefreshNodes: boolean) => {
    if (!shouldRefreshNodes) return;

    setSaveBannerVisible(true);
    try {
      const snapshot = await loadBoardSnapshot(BOARD_ID, accessMode, currentVersion);
      applyBoardSnapshot(snapshot);
    } catch (closeError: unknown) {
      window.alert(
        closeError instanceof Error
          ? closeError.message
          : "Не удалось обновить доску после изменения списка сущностей."
      );
    } finally {
      setSaveBannerVisible(false);
    }
  };

  const handleDeleteVersion = async (version: number) => {
    if (accessMode !== "edit") {
      throw new Error("Режим редактирования недоступен.");
    }

    try {
      await boardDataSource.deleteVersion({ version });
      const snapshot = await loadBoardSnapshot(
        BOARD_ID,
        accessMode,
        currentVersion === version ? null : currentVersion,
        { canonicalEntities }
      );
      applyBoardSnapshot(snapshot);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Не удалось удалить версию доски";
      console.error(message);
      throw new Error(message);
    }
  };

  const handlePersistBoard = async (payload: {
    version: number;
    nodes: BoardNode[];
    edges: BoardEdge[];
    is_published: boolean;
  }) => {
    if (accessMode !== "edit") {
      throw new Error("Режим редактирования недоступен.");
    }

    setSaveBannerVisible(true);
    try {
      await boardDataSource.updateBoard({
        version: payload.version,
        nodes: payload.nodes,
        edges: payload.edges,
        description: null,
        board_name: null,
        is_published: payload.is_published,
      });

      const snapshot = await loadBoardSnapshot(BOARD_ID, accessMode, payload.version, {
        canonicalEntities,
      });
      applyBoardSnapshot(snapshot);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Не удалось сохранить текущую версию.";
      console.error(message);
      throw new Error(message);
    } finally {
      setSaveBannerVisible(false);
    }
  };

  const enterEditMode = () => {
    if (boardViewMode === "analysis") return;
    setAccessMode("edit");
    setAuthDialogOpen(false);
    setSecretCode("");
    setAuthError(null);
  };

  const handleRequestEditMode = async () => {
    if (boardViewMode === "analysis" || accessMode === "edit" || authChecking) return;

    setAuthError(null);

    const token = authClient.getToken();
    if (!token) {
      setAuthDialogOpen(true);
      return;
    }

    setAuthChecking(true);
    try {
      const confirmed = await authClient.confirm(token);
      if (confirmed) {
        enterEditMode();
        return;
      }

      authClient.clearToken();
      setAuthError(AUTH_REJECTED_MESSAGE);
      setAuthDialogOpen(true);
    } catch {
      setAuthError("Не удалось проверить токен безопасности.");
      setAuthDialogOpen(true);
    } finally {
      setAuthChecking(false);
    }
  };

  const handleAuthDialogClose = () => {
    if (authChecking) return;
    setAuthDialogOpen(false);
    setSecretCode("");
    setAuthError(null);
  };

  const handleAuthSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimmedSecretCode = secretCode.trim();
    if (!trimmedSecretCode) {
      setAuthError("Введите секретный код.");
      return;
    }

    setAuthChecking(true);
    setAuthError(null);

    try {
      const token = await authClient.login(trimmedSecretCode);
      const confirmed = await authClient.confirm(token);
      if (confirmed) {
        enterEditMode();
        return;
      }

      authClient.clearToken();
      setAuthError(AUTH_REJECTED_MESSAGE);
    } catch {
      authClient.clearToken();
      setAuthError(AUTH_REJECTED_MESSAGE);
    } finally {
      setAuthChecking(false);
    }
  };

  const effectiveAccessMode = boardViewMode === "analysis" ? "read" : accessMode;
  const visibleVersions = getVisibleVersions(versions, effectiveAccessMode);

  if (loading) return <div>Загружаем доску…</div>;
  if (error) return <div>{error}</div>;
  if (currentVersion === null) return <div>Нет опубликованных досок для режима просмотра.</div>;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InvestigationBoardScreen
        key={
          boardViewMode === "analysis"
            ? `analysis:${analysisCeId ?? "none"}:${currentVersion}`
            : `board:${currentVersion}`
        }
        title={boardTitle}
        initialNodes={nodes}
        initialEdges={edges}
        initialCanonicalEntities={canonicalEntities}
        versions={visibleVersions}
        currentVersion={currentVersion}
        accessMode={effectiveAccessMode}
        boardViewMode={boardViewMode}
        currentAnalysisCeId={analysisCeId}
        analysisBoardInfo={analysisBoardInfo}
        onChangeVersion={handleChangeVersion}
        onCreateVersion={handleCreateVersion}
        onDeleteVersion={handleDeleteVersion}
        onPersistBoard={handlePersistBoard}
        onCanonicalEntitiesChange={handleCanonicalEntitiesChange}
        onCanonicalEntityDelete={handleCanonicalEntityDelete}
        onCanonicalEntitiesManagerClose={handleCanonicalEntitiesManagerClose}
        onRequestEditMode={handleRequestEditMode}
        onOpenCanonicalEntityAnalysis={handleOpenCanonicalEntityAnalysis}
      />

      {saveBannerVisible && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1500,
            padding: "10px 16px",
            borderRadius: 10,
            background: "rgba(33, 33, 33, 0.92)",
            color: "#f5f5f5",
            boxShadow: "0 10px 30px rgba(0,0,0,0.24)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            userSelect: "none",
          }}
        >
          Сохранение
        </div>
      )}

      {authDialogOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={handleAuthDialogClose}
        >
          <form
            onSubmit={handleAuthSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>Режим редактирования</div>

            {authError && (
              <div style={{ fontSize: 12, color: "#b00020", whiteSpace: "pre-wrap" }}>{authError}</div>
            )}

            <label style={{ fontSize: 12, fontWeight: 600 }}>
              Секретный код
              <input
                type="password"
                value={secretCode}
                disabled={authChecking}
                autoFocus
                onChange={(e) => setSecretCode(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "6px 8px",
                  fontSize: 13,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  boxSizing: "border-box",
                }}
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={handleAuthDialogClose}
                disabled={authChecking}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #bbb",
                  backgroundColor: "#f2f2f2",
                  cursor: authChecking ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={authChecking}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #444",
                  backgroundColor: authChecking ? "#ddd" : "#333",
                  color: authChecking ? "#777" : "#f5f5f5",
                  cursor: authChecking ? "default" : "pointer",
                  fontSize: 13,
                }}
              >
                {authChecking ? "Проверяем…" : "Войти"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
