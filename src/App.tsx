import { useState } from "react";
import { InvestigationBoard } from "./InvestigationBoard";
import type { BoardNode, BoardEdge } from "./boardTypes";

const initialNodes: BoardNode[] = [
  {
    id: "1",
    title: "Подозрительный пёс",
    x: 50,
    y: 50,
    description: "Шарился где не попадя, за что и поплатился.",
  },
  {
    id: "2",
    title: "Беззаботный крокрдил",
    x: 350,
    y: 120,
    description: "Жил, живёт и будет жить в озере. Ему-то что? Он - крокодил",
  },
  {
    id: "3",
    title: "Любвеобильный страус",
    x: 150,
    y: 250,
    description: "Братишке крупно не повезло с самками. Пожалуй, это единственный зверь, который точно не убежит от жены.",
  },
];

const sampleEdges: BoardEdge[] = [
  { id: "e1", from: "1", to: "2" },
  { id: "e2", from: "2", to: "3" },
];

export default function App() {
  const [nodes, setNodes] = useState<BoardNode[]>(initialNodes);

  const handleNodePositionChange = (id: string, x: number, y: number) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === id
          ? { ...node, x, y }
          : node
      )
    );
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <InvestigationBoard
        title="Доска расследований (демо)"
        nodes={nodes}
        edges={sampleEdges}
        onNodePositionChange={handleNodePositionChange}
      />
    </div>
  );
}
