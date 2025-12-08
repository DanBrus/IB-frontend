import { useEffect, useState } from "react";
import { InvestigationBoard } from "./InvestigationBoard";
import type { BoardNode, BoardEdge } from "./boardTypes";
import { boardDataSource } from "./boardDataSource";

export default function App() {
  const [nodes, setNodes] = useState<BoardNode[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const boardId = "demo-board";
    setLoading(true);
    setError(null);

    let cancelled = false;

    (async () => {
      try {
        const graph = await boardDataSource.getCurrentBoard(boardId);
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

  const handleNodePositionChange = (id: number, pos_x: number, pos_y: number) => {
    setNodes(prev =>
      prev.map(node => (node.node_id === id ? { ...node, pos_x, pos_y } : node))
    );
  };

  if (loading) return <div>Загружаем доску…</div>;
  if (error) return <div>{error}</div>;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InvestigationBoard
        title="Доска расследований"
        nodes={nodes}
        edges={edges}
        onNodePositionChange={handleNodePositionChange}
      />
    </div>
  );
}
