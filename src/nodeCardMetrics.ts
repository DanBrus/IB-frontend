import { getNodeCardLayout } from "./cardLayout";
import {
  BOARD_NODE_TYPES,
  type BoardNodeType,
} from "./boardTypes";
import "./components/NodeCard.css";

export type EntitySizeMap = Record<
  BoardNodeType,
  {
    width: number;
    height: number;
  }
>;

const FALLBACK_ENTITY_SIZES: EntitySizeMap = {
  person_node: { width: 160, height: 216 },
  location_node: { width: 275, height: 216 },
  artifact_node: { width: 160, height: 216 },
  note: { width: 160, height: 160 },
};

const TITLE_LINES_BY_TYPE: Record<BoardNodeType, [string, string]> = {
  person_node: ["Аналитическая", "сущность"],
  location_node: ["Аналитическая", "локация"],
  artifact_node: ["Аналитический", "артефакт"],
  note: ["Аналитическая", "заметка"],
};

let entitySizeMapPromise: Promise<EntitySizeMap> | null = null;

function createMeasurementCard(nodeType: BoardNodeType): HTMLDivElement {
  const layout = getNodeCardLayout(nodeType);
  const [titleLineOne, titleLineTwo] = TITLE_LINES_BY_TYPE[nodeType];

  const root = document.createElement("div");
  root.className = `node-card ${layout.className}`;
  root.style.position = "relative";
  root.style.left = "0";
  root.style.top = "0";
  root.style.setProperty("--node-card-width", `${layout.cardWidth}px`);
  root.style.setProperty("--node-photo-height", `${layout.photoHeight}px`);

  const polaroid = document.createElement("div");
  polaroid.className = "node-card__polaroid";

  if (layout.hasImage) {
    const photo = document.createElement("div");
    photo.className = "node-card__photo";
    polaroid.appendChild(photo);
  }

  const title = document.createElement("div");
  title.className = "node-card__title";
  title.innerHTML = `${titleLineOne}<br>${titleLineTwo}`;
  polaroid.appendChild(title);

  root.appendChild(polaroid);
  return root;
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export async function getNodeCardEntitySizes(): Promise<EntitySizeMap> {
  if (entitySizeMapPromise) return entitySizeMapPromise;

  entitySizeMapPromise = (async () => {
    if (typeof document === "undefined" || !document.body) {
      return FALLBACK_ENTITY_SIZES;
    }

    const measurementHost = document.createElement("div");
    measurementHost.style.position = "fixed";
    measurementHost.style.left = "-10000px";
    measurementHost.style.top = "0";
    measurementHost.style.visibility = "hidden";
    measurementHost.style.pointerEvents = "none";
    measurementHost.style.display = "flex";
    measurementHost.style.gap = "24px";
    measurementHost.style.alignItems = "flex-start";

    const cardsByType = new Map<BoardNodeType, HTMLDivElement>();
    BOARD_NODE_TYPES.forEach((nodeType) => {
      const card = createMeasurementCard(nodeType);
      cardsByType.set(nodeType, card);
      measurementHost.appendChild(card);
    });

    document.body.appendChild(measurementHost);

    try {
      if ("fonts" in document && typeof document.fonts?.ready?.then === "function") {
        await document.fonts.ready.catch(() => undefined);
      }
      await waitForNextFrame();

      const measuredSizes = {} as EntitySizeMap;
      BOARD_NODE_TYPES.forEach((nodeType) => {
        const card = cardsByType.get(nodeType);
        if (!card) {
          measuredSizes[nodeType] = FALLBACK_ENTITY_SIZES[nodeType];
          return;
        }

        const rect = card.getBoundingClientRect();
        measuredSizes[nodeType] = {
          width: Math.ceil(rect.width) || FALLBACK_ENTITY_SIZES[nodeType].width,
          height: Math.ceil(rect.height) || FALLBACK_ENTITY_SIZES[nodeType].height,
        };
      });

      return measuredSizes;
    } finally {
      measurementHost.remove();
    }
  })();

  return entitySizeMapPromise;
}
