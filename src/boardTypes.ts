export type BoardNode = {
  id: string;
  title: string;
  x: number;
  y: number;
  description: string; // обязательное поле, можно пустую строку
};
export type BoardEdge = {
  id: string;
  from: string;
  to: string;
};
