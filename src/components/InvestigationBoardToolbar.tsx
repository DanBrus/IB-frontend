import React from "react";
import { BoardToolbar } from "./BoardToolbar";
import type { BoardMode } from "./BoardToolbar";
import type { BoardAccessMode } from "../boardTypes";

interface InvestigationBoardToolbarProps {
  accessMode: BoardAccessMode;
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
