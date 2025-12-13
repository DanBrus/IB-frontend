export type BoardNode = {
  node_id: number;
  name: string;
  pos_x: number;
  pos_y: number;
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
