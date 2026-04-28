import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { InvestigationBoardScreen } from "./InvestigationBoardScreen";
import type { BoardNode, BoardEdge, BoardVersion, BoardAccessMode } from "./boardTypes";
import { boardDataSource } from "./boardDataSource";
import { authClient } from "./auth/authClient";

const AUTH_REJECTED_MESSAGE = "Токен безопасности истёк или был введён неверный код безопасности.";

export default function App() {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

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
        const [versionsList, activeVersion] = await Promise.all([
          boardDataSource.getVersions(boardId),
          boardDataSource.getActiveVersion(boardId),
        ]);

        if (cancelled) return;

        setVersions(versionsList);
        setCurrentVersion(activeVersion);

        const graph = await boardDataSource.getCurrentBoard(
          boardId,
          activeVersion
        );
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

  const handleChangeVersion = async (version: string) => {
    const boardId = "demo-board";
    setLoading(true);
    setError(null);

    try {
      const graph = await boardDataSource.getCurrentBoard(boardId, version);
      setNodes(graph.nodes);
      setEdges(graph.edges);
      setCurrentVersion(version);
      setLoading(false);
    } catch {
      setError("Не удалось загрузить выбранную версию доски");
      setLoading(false);
    }
  };

  const handleCreateVersion = async (payload: { version: string; name: string; description: string }) => {
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

  const handleDeleteVersion = async (version: string) => {
    if (accessMode !== "edit") {
      throw new Error("Режим редактирования недоступен.");
    }

    const boardId = "demo-board";
    try {
      const active = await boardDataSource.getActiveVersion(boardId);
      if (active === version) {
        throw new Error("Невозможно удалить активную версию доски");
      }

      await boardDataSource.deleteVersion({ version });

      const versionsList = await boardDataSource.getVersions(boardId);
      setVersions(versionsList);

      let nextVersion: string | null = currentVersion;
      if (!versionsList.some((v) => v.version === nextVersion)) {
        const activeAfter = await boardDataSource.getActiveVersion(boardId);
        nextVersion =
          versionsList.find((v) => v.version === activeAfter)?.version ??
          versionsList[0]?.version ??
          null;
      }

      if (nextVersion) {
        const graph = await boardDataSource.getCurrentBoard(boardId, nextVersion);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        setCurrentVersion(nextVersion);
      } else {
        setNodes([]);
        setEdges([]);
        setCurrentVersion(null);
      }
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "Не удалось удалить версию доски";
      console.error(msg);
      throw new Error(msg);
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

  if (loading) return <div>Загружаем доску…</div>;
  if (error) return <div>{error}</div>;
  if (!currentVersion) return <div>Не удалось определить активную версию</div>;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InvestigationBoardScreen
        key={currentVersion}
        title="Доска расследований"
        initialNodes={nodes}
        initialEdges={edges}
        versions={versions}
        currentVersion={currentVersion}
        accessMode={accessMode}
        onChangeVersion={handleChangeVersion}
        onCreateVersion={handleCreateVersion}
        onDeleteVersion={handleDeleteVersion}
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
