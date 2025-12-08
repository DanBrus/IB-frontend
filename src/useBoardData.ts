import { useEffect, useState } from "react";
import type { BoardNode, BoardEdge } from "./boardTypes";
import { boardDataSource } from "./boardDataSource";

type UseBoardDataResult = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  loading: boolean;
  error: string | null;
};

export function useBoardData(boardId: string): UseBoardDataResult {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const graph = await boardDataSource.getCurrentBoard(boardId);
        if (cancelled) return;
        setNodes(graph.nodes);
        setEdges(graph.edges);
      } catch (e) {
        if (cancelled) return;
        setError("Не удалось загрузить доску");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  return { nodes, edges, loading, error };
}
