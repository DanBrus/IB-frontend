import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BoardMode } from "./BoardToolbar";
import type { BoardNode, BoardEdge, BoardNodeType, BoardAccessMode } from "../boardTypes";
import { CARD_HEIGHT, CARD_WIDTH } from "../cardLayout";
import { NodeCard } from "./NodeCard";
import { EdgeLine } from "./EdgeLine";
import { NodeInspector } from "./NodeInspector";
import { NodeReadPanel } from "./NodeReadPanel";
import { useIsMobile } from "../useIsMobile";

type DragState = {
  nodeId: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  hasMoved: boolean;
} | null;

type PendingScroll = {
  left: number;
  top: number;
} | null;

const CANVAS_PADDING = 120;
const DESKTOP_DEFAULT_SCALE = 1;
const MOBILE_DEFAULT_SCALE = 1 / 1.75;
const DESKTOP_MIN_SCALE = 0.5;
const MOBILE_MIN_SCALE = DESKTOP_MIN_SCALE / 2;
const MAX_SCALE = 2.5;
const ZOOM_SENSITIVITY = 0.0015;
const DRAG_ACTIVATION_DISTANCE = 8;

interface InvestigationBoardWorkspaceProps {
  nodes: BoardNode[];
  edges: BoardEdge[];
  mode: BoardMode;
  selectedNode: BoardNode | null;
  accessMode: BoardAccessMode;
  onBoardClick: (x: number, y: number) => void;
  onNodeClick: (node: BoardNode) => void;
  onNodePositionChange?: (id: number, x: number, y: number) => void;
  onSelectedNodeSave: (
    id: number,
    patch: { name: string; description: string; node_type: BoardNodeType; picture_path?: string | null }
  ) => Promise<void>;
  onUploadImage: (blob: Blob) => Promise<{ id: string; url: string }>;
}

export const InvestigationBoardWorkspace: React.FC<InvestigationBoardWorkspaceProps> = ({
  nodes,
  edges,
  mode,
  selectedNode,
  accessMode,
  onBoardClick,
  onNodeClick,
  onNodePositionChange,
  onSelectedNodeSave,
  onUploadImage,
}) => {
  const isMobile = useIsMobile();
  const minScale = isMobile ? MOBILE_MIN_SCALE : DESKTOP_MIN_SCALE;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [readPanelNodeId, setReadPanelNodeId] = useState<number | null>(null);
  const [scale, setScale] = useState(() => (isMobile ? MOBILE_DEFAULT_SCALE : DESKTOP_DEFAULT_SCALE));
  const pendingScrollRef = useRef<PendingScroll>(null);

  const nodesById = useMemo(() => {
    const map = new Map<number, BoardNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  const boardBounds = useMemo(() => {
    if (nodes.length === 0) {
      return {
        minX: 0,
        minY: 0,
        width: CARD_WIDTH + CANVAS_PADDING * 2,
        height: CARD_HEIGHT + CANVAS_PADDING * 2,
        canvasLeft: CANVAS_PADDING,
        canvasTop: CANVAS_PADDING,
      };
    }

    const minX = nodes.reduce((value, node) => Math.min(value, node.pos_x), nodes[0].pos_x);
    const minY = nodes.reduce((value, node) => Math.min(value, node.pos_y), nodes[0].pos_y);
    const maxX = nodes.reduce((value, node) => Math.max(value, node.pos_x + CARD_WIDTH), nodes[0].pos_x + CARD_WIDTH);
    const maxY = nodes.reduce((value, node) => Math.max(value, node.pos_y + CARD_HEIGHT), nodes[0].pos_y + CARD_HEIGHT);

    return {
      minX,
      minY,
      width: maxX - minX + CANVAS_PADDING * 2,
      height: maxY - minY + CANVAS_PADDING * 2,
      canvasLeft: CANVAS_PADDING - minX,
      canvasTop: CANVAS_PADDING - minY,
    };
  }, [nodes]);

  const scaledCanvasWidth = boardBounds.width * scale;
  const scaledCanvasHeight = boardBounds.height * scale;

  const readPanelNode =
    accessMode === "read" && readPanelNodeId !== null ? nodesById.get(readPanelNodeId) ?? null : null;

  useEffect(() => {
    const nextDefaultScale = isMobile ? MOBILE_DEFAULT_SCALE : DESKTOP_DEFAULT_SCALE;

    setScale((prevScale) => {
      const isUsingDefaultScale =
        Math.abs(prevScale - DESKTOP_DEFAULT_SCALE) < 0.0001 ||
        Math.abs(prevScale - MOBILE_DEFAULT_SCALE) < 0.0001;

      const nextScale = isUsingDefaultScale ? nextDefaultScale : prevScale;
      return Math.min(MAX_SCALE, Math.max(minScale, nextScale));
    });
  }, [isMobile, minScale]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const pendingScroll = pendingScrollRef.current;

    if (!viewport || !pendingScroll) return;

    const maxScrollLeft = Math.max(0, scaledCanvasWidth - viewport.clientWidth);
    const maxScrollTop = Math.max(0, scaledCanvasHeight - viewport.clientHeight);

    viewport.scrollTo({
      left: Math.min(Math.max(0, pendingScroll.left), maxScrollLeft),
      top: Math.min(Math.max(0, pendingScroll.top), maxScrollTop),
    });

    pendingScrollRef.current = null;
  }, [scaledCanvasHeight, scaledCanvasWidth]);

  const getPointerPosition = (clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return null;

    const rect = viewport.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const contentX = (viewport.scrollLeft + screenX) / scale;
    const contentY = (viewport.scrollTop + screenY) / scale;

    return {
      screenX,
      screenY,
      contentX,
      contentY,
      worldX: contentX - boardBounds.canvasLeft,
      worldY: contentY - boardBounds.canvasTop,
    };
  };

  const getVisibleWorldRect = (nextScale: number, nextScrollLeft: number, nextScrollTop: number, viewport: HTMLDivElement) => {
    return {
      left: nextScrollLeft / nextScale - boardBounds.canvasLeft,
      top: nextScrollTop / nextScale - boardBounds.canvasTop,
      right: (nextScrollLeft + viewport.clientWidth) / nextScale - boardBounds.canvasLeft,
      bottom: (nextScrollTop + viewport.clientHeight) / nextScale - boardBounds.canvasTop,
    };
  };

  const hasFullyVisibleNode = (nextScale: number, nextScrollLeft: number, nextScrollTop: number, viewport: HTMLDivElement) => {
    const visibleRect = getVisibleWorldRect(nextScale, nextScrollLeft, nextScrollTop, viewport);

    return nodes.some(
      (node) =>
        node.pos_x >= visibleRect.left &&
        node.pos_y >= visibleRect.top &&
        node.pos_x + CARD_WIDTH <= visibleRect.right &&
        node.pos_y + CARD_HEIGHT <= visibleRect.bottom
    );
  };

  const getClosestNode = (worldX: number, worldY: number) => {
    if (nodes.length === 0) return null;

    return nodes.reduce((closest, node) => {
      const centerX = node.pos_x + CARD_WIDTH / 2;
      const centerY = node.pos_y + CARD_HEIGHT / 2;
      const distance = (centerX - worldX) ** 2 + (centerY - worldY) ** 2;

      if (!closest || distance < closest.distance) {
        return { node, distance };
      }

      return closest;
    }, null as { node: BoardNode; distance: number } | null)?.node ?? null;
  };

  const getNodeCenteredScroll = (node: BoardNode, nextScale: number, viewport: HTMLDivElement) => {
    const nodeCenterContentX = node.pos_x + boardBounds.canvasLeft + CARD_WIDTH / 2;
    const nodeCenterContentY = node.pos_y + boardBounds.canvasTop + CARD_HEIGHT / 2;

    return {
      left: nodeCenterContentX * nextScale - viewport.clientWidth / 2,
      top: nodeCenterContentY * nextScale - viewport.clientHeight / 2,
    };
  };

  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (accessMode === "read") return;
    const pointer = getPointerPosition(e.clientX, e.clientY);
    if (!pointer) return;

    onBoardClick(pointer.worldX, pointer.worldY);
  };

  useEffect(() => {
    if (!drag || !onNodePositionChange) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;

      const pointer = getPointerPosition(event.clientX, event.clientY);
      if (!pointer) return;

      const hasMovedEnough =
        drag.hasMoved ||
        Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) >= DRAG_ACTIVATION_DISTANCE;

      if (!hasMovedEnough) return;

      event.preventDefault();

      if (!drag.hasMoved) {
        setDrag((currentDrag) =>
          currentDrag && currentDrag.pointerId === event.pointerId ? { ...currentDrag, hasMoved: true } : currentDrag
        );
      }

      onNodePositionChange(drag.nodeId, pointer.worldX - drag.offsetX, pointer.worldY - drag.offsetY);
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;

      const movedDistance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
      const shouldOpenReadPanel =
        accessMode === "read" && isMobile && movedDistance < DRAG_ACTIVATION_DISTANCE;
      const nodeId = drag.nodeId;

      setDrag(null);

      if (shouldOpenReadPanel) {
        setReadPanelNodeId(nodeId);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [accessMode, drag, getPointerPosition, isMobile, onNodePositionChange]);

  const handleNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, node: BoardNode) => {
    if (!e.isPrimary) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    const actualNode = nodesById.get(node.node_id) ?? node;
    const pointer = getPointerPosition(e.clientX, e.clientY);

    if (!pointer) return;

    if (mode !== "idle") {
      if (accessMode !== "read") {
        onNodeClick(actualNode);
      }
      return;
    }

    setDrag({
      nodeId: actualNode.node_id,
      offsetX: pointer.worldX - actualNode.pos_x,
      offsetY: pointer.worldY - actualNode.pos_y,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      hasMoved: false,
    });
  };

  const handleNodeDoubleClick = (node: BoardNode) => {
    if (accessMode !== "read") return;
    setReadPanelNodeId(node.node_id);
  };

  const handleReadPanelClose = () => {
    setReadPanelNodeId(null);
  };

  const handleViewportWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.shiftKey) return;

    const viewport = viewportRef.current;
    const pointer = getPointerPosition(e.clientX, e.clientY);

    if (!viewport || !pointer) return;

    e.preventDefault();

    const zoomFactor = Math.exp(-e.deltaY * ZOOM_SENSITIVITY);
    const unclampedScale = scale * zoomFactor;
    const nextScale = Math.min(MAX_SCALE, Math.max(minScale, unclampedScale));

    if (Math.abs(nextScale - scale) < 0.0001) return;

    let nextScrollLeft = pointer.contentX * nextScale - pointer.screenX;
    let nextScrollTop = pointer.contentY * nextScale - pointer.screenY;

    const canFitWholeNode =
      viewport.clientWidth >= CARD_WIDTH * nextScale && viewport.clientHeight >= CARD_HEIGHT * nextScale;

    if (canFitWholeNode && nodes.length > 0 && !hasFullyVisibleNode(nextScale, nextScrollLeft, nextScrollTop, viewport)) {
      const anchorNode = getClosestNode(pointer.worldX, pointer.worldY);

      if (anchorNode) {
        const centeredScroll = getNodeCenteredScroll(anchorNode, nextScale, viewport);
        nextScrollLeft = centeredScroll.left;
        nextScrollTop = centeredScroll.top;
      }
    }

    pendingScrollRef.current = { left: nextScrollLeft, top: nextScrollTop };
    setScale(nextScale);
  };

  return (
    <div
      data-access-mode={accessMode}
      style={{ position: "relative", flexGrow: 1, display: "flex", backgroundColor: "#fdfdfd", overflow: "hidden" }}
    >
      <div
        ref={viewportRef}
        style={{
          position: "relative",
          flexGrow: 1,
          overflow: "auto",
          cursor: drag != null ? "grabbing" : accessMode === "edit" && mode === "add-node" ? "crosshair" : "default",
        }}
        onWheel={handleViewportWheel}
        onClick={handleBoardClick}
      >
        <div
          style={{
            position: "relative",
            width: scaledCanvasWidth,
            height: scaledCanvasHeight,
            minWidth: "100%",
            minHeight: "100%",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: boardBounds.width,
              height: boardBounds.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {nodes.map((node) => (
              <NodeCard
                key={node.node_id}
                node={{
                  ...node,
                  pos_x: node.pos_x + boardBounds.canvasLeft,
                  pos_y: node.pos_y + boardBounds.canvasTop,
                }}
                onPointerDown={handleNodePointerDown}
                onDoubleClick={handleNodeDoubleClick}
                showInlineDescription={accessMode === "edit"}
              />
            ))}

            <svg
              width={boardBounds.width}
              height={boardBounds.height}
              style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", zIndex: 5 }}
            >
              {edges.map((edge) => {
                const from = nodesById.get(edge.node1);
                const to = nodesById.get(edge.node2);
                if (!from || !to) return null;
                return (
                  <EdgeLine
                    key={edge.edge_id}
                    edge={edge}
                    from={{ ...from, pos_x: from.pos_x + boardBounds.canvasLeft, pos_y: from.pos_y + boardBounds.canvasTop }}
                    to={{ ...to, pos_x: to.pos_x + boardBounds.canvasLeft, pos_y: to.pos_y + boardBounds.canvasTop }}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {accessMode === "edit" && mode === "edit-node" && (
        <NodeInspector node={selectedNode} onSaveNode={onSelectedNodeSave} onUploadImage={onUploadImage} />
      )}

      {accessMode === "read" && readPanelNodeId !== null && (
        <NodeReadPanel node={readPanelNode} onClose={handleReadPanelClose} mobile={isMobile} />
      )}
    </div>
  );
};
