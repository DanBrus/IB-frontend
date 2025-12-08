export type BoardNode = {
  node_id: number;
  name: string;
  pos_x: number;
  pos_y: number;
  description: string; // обязательное поле, можно пустую строку
};
export type BoardEdge = {
  edge_id: number;
  node1: number;
  node2: number;
};
