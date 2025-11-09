"use client";

import { Box, Typography, IconButton } from "@mui/material";
import { Undo, Redo } from "@mui/icons-material";

interface HeaderProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  selectedText: string;
}

export default function Header({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  selectedText,
}: HeaderProps) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderBottom: 1,
        borderColor: "divider",
        display: "flex",
        gap: 1,
        alignItems: "center",
        backgroundColor: "background.paper",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <IconButton
        onClick={onUndo}
        disabled={!canUndo}
        size="small"
        sx={{
          "&:hover": {
            backgroundColor: "primary.light",
            color: "white",
          },
        }}
      >
        <Undo />
      </IconButton>
      <IconButton
        onClick={onRedo}
        disabled={!canRedo}
        size="small"
        sx={{
          "&:hover": {
            backgroundColor: "primary.light",
            color: "white",
          },
        }}
      >
        <Redo />
      </IconButton>
      {selectedText && (
        <Typography
          variant="caption"
          sx={{ ml: 2, color: "text.secondary", fontStyle: "italic" }}
        >
          Selected: {selectedText.substring(0, 50)}
          {selectedText.length > 50 ? "..." : ""}
        </Typography>
      )}
    </Box>
  );
}

