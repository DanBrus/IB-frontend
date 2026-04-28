import type { BoardNode, BoardNodeType } from "./boardTypes";

export const CARD_WIDTH = 160;
export const CARD_HEIGHT = 200;
export const CARD_PADDING = 8;
export const CARD_BORDER = 2;

export type NodeCardLayout = {
  cardWidth: number;
  photoHeight: number;
  hasImage: boolean;
  className: string;
};

const PERSON_PHOTO_HEIGHT = 160;
const LOCATION_PHOTO_WIDTH = Math.round(PERSON_PHOTO_HEIGHT * (9.9 / 6.2));
const LOCATION_CARD_WIDTH = LOCATION_PHOTO_WIDTH + (CARD_PADDING + CARD_BORDER) * 2;

const NODE_LAYOUTS: Record<BoardNodeType, NodeCardLayout> = {
  person_node: {
    cardWidth: CARD_WIDTH,
    photoHeight: PERSON_PHOTO_HEIGHT,
    hasImage: true,
    className: "node-card--person",
  },
  location_node: {
    cardWidth: LOCATION_CARD_WIDTH,
    photoHeight: PERSON_PHOTO_HEIGHT,
    hasImage: true,
    className: "node-card--location",
  },
  artifact_node: {
    cardWidth: CARD_WIDTH,
    photoHeight: PERSON_PHOTO_HEIGHT,
    hasImage: true,
    className: "node-card--artifact",
  },
  note: {
    cardWidth: CARD_WIDTH,
    photoHeight: 0,
    hasImage: false,
    className: "node-card--note",
  },
};

export function getNodeCardLayout(nodeType: BoardNodeType): NodeCardLayout {
  return NODE_LAYOUTS[nodeType] ?? NODE_LAYOUTS.person_node;
}

export function getNodeAnchor(node: BoardNode): { x: number; y: number } {
  const layout = getNodeCardLayout(node.node_type);
  return {
    x: node.pos_x + layout.cardWidth / 2,
    y: node.pos_y + CARD_BORDER + CARD_PADDING / 2,
  };
}
