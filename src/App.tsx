import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { InvestigationBoardScreen } from "./InvestigationBoardScreen";
import type {
  BoardAccessMode,
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

const AUTH_REJECTED_MESSAGE = "Токен безопасности истёк или был введён неверный код безопасности.";

function isVersionVisible(version: BoardVersion, accessMode: BoardAccessMode): boolean {
  return accessMode === "edit" || version.is_published !== false;
}

function getVisibleVersions(versions: BoardVersion[], accessMode: BoardAccessMode): BoardVersion[] {
  return versions.filter((version) => isVersionVisible(version, accessMode));
}

function resolveCurrentVersion(
  versions: BoardVersion[],
  requestedVersion: number | null | undefined,
  accessMode: BoardAccessMode
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

  return visibleVersions[visibleVersions.length - 1]?.version ?? null;
}

export default function App() {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [canonicalEntities, setCanonicalEntities] = useState<CanonicalEntity[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);

  const [accessMode, setAccessMode] = useState<BoardAccessMode>("read");
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const boardId = "demo-board";
    setLoading(true);
    setError(null);

    let cancelled = false;

    (async () => {
      try {
        const [versionsList, entitiesList] = await Promise.all([
          boardDataSource.getVersions(boardId),
          boardDataSource.getCanonicalEntities(boardId),
        ]);
        if (cancelled) return;

        const initialVersion = resolveCurrentVersion(versionsList, null, "read");
        setVersions(versionsList);
        setCanonicalEntities(entitiesList);
        setCurrentVersion(initialVersion);

        if (initialVersion === null) {
          setNodes([]);
          setEdges([]);
          setLoading(false);
          return;
        }

        const graph = await boardDataSource.getCurrentBoard(boardId, initialVersion);
        if (cancelled) return;

        setNodes(graph.nodes);
        setEdges(graph.edges);
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
    const boardId = "demo-board";
    const nextVersion = resolveCurrentVersion(versions, version, accessMode);
    if (nextVersion === null || nextVersion !== version) return;

    setLoading(true);
    setError(null);

    try {
      const graph = await boardDataSource.getCurrentBoard(boardId, nextVersion);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setCurrentVersion(nextVersion);
      setLoading(false);
    } catch {
      setError("Не удалось загрузить выбранную версию доски");
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

    const boardId = "demo-board";
    setLoading(true);
    setError(null);

    try {
      await boardDataSource.createVersion(payload);
      const [versionsList, graph] = await Promise.all([
        boardDataSource.getVersions(boardId),
        boardDataSource.getCurrentBoard(boardId, payload.version),
      ]);
      setVersions(versionsList);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setCurrentVersion(payload.version);
      setLoading(false);
    } catch {
      setError("Не удалось создать новую версию доски");
      setLoading(false);
    }
  };

  const handleCurrentVersionPublicationChange = (version: number, isPublished: boolean) => {
    setVersions((prev) =>
      prev.map((item) =>
        item.version === version
          ? {
              ...item,
              is_published: isPublished,
            }
          : item
      )
    );
  };

  const handleCanonicalEntitiesChange = async (
    nextEntities: CanonicalEntity[]
  ): Promise<CanonicalEntitiesSyncResult> => {
    const boardId = "demo-board";
    const syncResult = await boardDataSource.updateCanonicalEntities(boardId, nextEntities);
    setCanonicalEntities(nextEntities);
    return syncResult;
  };

  const handleCanonicalEntityDelete = async (
    entityId: string
  ): Promise<CanonicalEntityDeleteResult> => {
    const boardId = "demo-board";
    const deleteResult = await boardDataSource.deleteCanonicalEntity(boardId, entityId);

    if (deleteResult.outcome === "deleted") {
      setCanonicalEntities((prev) => prev.filter((entity) => entity.en_id !== entityId));
    }

    return deleteResult;
  };

  const handleDeleteVersion = async (version: number) => {
    if (accessMode !== "edit") {
      throw new Error("Режим редактирования недоступен.");
    }

    const boardId = "demo-board";
    try {
      await boardDataSource.deleteVersion({ version });

      const versionsList = await boardDataSource.getVersions(boardId);
      setVersions(versionsList);

      const nextVersion = resolveCurrentVersion(
        versionsList,
        currentVersion === version ? null : currentVersion,
        accessMode
      );

      if (nextVersion !== null) {
        const graph = await boardDataSource.getCurrentBoard(boardId, nextVersion);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setCurrentVersion(nextVersion);
      } else {
        setNodes([]);
        setEdges([]);
        setCurrentVersion(null);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Не удалось удалить версию доски";
      console.error(message);
      throw new Error(message);
    }
  };

  const enterEditMode = () => {
    setAccessMode("edit");
    setAuthDialogOpen(false);
    setSecretCode("");
    setAuthError(null);
  };

  const handleRequestEditMode = async () => {
    if (accessMode === "edit" || authChecking) return;

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

  const visibleVersions = getVisibleVersions(versions, accessMode);

  if (loading) return <div>Загружаем доску…</div>;
  if (error) return <div>{error}</div>;
  if (currentVersion === null) return <div>Нет опубликованных досок для режима просмотра.</div>;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InvestigationBoardScreen
        key={currentVersion}
        title="Доска расследований"
        initialNodes={nodes}
        initialEdges={edges}
        initialCanonicalEntities={canonicalEntities}
        versions={visibleVersions}
        currentVersion={currentVersion}
        accessMode={accessMode}
        onChangeVersion={handleChangeVersion}
        onCreateVersion={handleCreateVersion}
        onDeleteVersion={handleDeleteVersion}
        onCurrentVersionPublicationChange={handleCurrentVersionPublicationChange}
        onCanonicalEntitiesChange={handleCanonicalEntitiesChange}
        onCanonicalEntityDelete={handleCanonicalEntityDelete}
        onRequestEditMode={handleRequestEditMode}
      />

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
