import React from "react";
import { BoardToolbar } from "./BoardToolbar";
import type { BoardMode } from "./BoardToolbar";

interface InvestigationBoardToolbarProps {
  mode: BoardMode;
  onNodeAddClick: () => void;
  onNodeDeleteClick: () => void;
  onNodeEditClick: () => void;
  onEdgeAddClick: () => void;
  onEdgeDeleteClick: () => void;
  onNewVersionClick: () => void;
  onDeleteVersionClick: () => void;
  canDeleteVersion: boolean;
}

export const InvestigationBoardToolbar: React.FC<InvestigationBoardToolbarProps> = (props) => {
  return <BoardToolbar {...props} />;
};

export type { BoardMode };
