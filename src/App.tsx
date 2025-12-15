import { useEffect, useState } from "react";
import { InvestigationBoardScreen } from "./InvestigationBoardScreen";
import type { BoardNode, BoardEdge, BoardVersion } from "./boardTypes";
import { boardDataSource } from "./boardDataSource";

export default function App() {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

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
        onChangeVersion={handleChangeVersion}
        onCreateVersion={handleCreateVersion}
        onDeleteVersion={handleDeleteVersion}
      />
    </div>
  );
}
