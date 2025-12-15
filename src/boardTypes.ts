export const BOARD_NODE_TYPES = ["person", "artifact", "location", "note"] as const;
export type BoardNodeType = (typeof BOARD_NODE_TYPES)[number];

export type BoardNode = {
  node_id: number;
  name: string;
  pos_x: number;
  pos_y: number;
  node_type: BoardNodeType;
  description: string;
  picture_path?: string | null; 
};

export type BoardEdge = {
  edge_id: number;
  node1: number;
  node2: number;
};

export type BoardVersion = {
  version: string;
  name: string;
  description: string;
};
