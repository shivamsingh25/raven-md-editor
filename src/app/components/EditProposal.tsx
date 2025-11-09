"use client";

import { Box, Typography, Button } from "@mui/material";
import DiffViewer from "react-diff-viewer";
import { EditProposal as EditProposalType } from "../types";

interface EditProposalProps {
  proposal: EditProposalType;
  markdown: string;
  onAccept: () => void;
  onDiscard: () => void;
}

export default function EditProposal({
  proposal,
  markdown,
  onAccept,
  onDiscard,
}: EditProposalProps) {
  return (
    <Box sx={{ mt: 3, width: "100%" }}>
      <Box
        sx={{
          p: 2.5,
          backgroundColor: "rgba(16, 163, 127, 0.1)",
          borderRadius: "8px",
          border: "1px solid rgba(16, 163, 127, 0.2)",
          mb: 2,
          width: "100%",
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: "#10a37f",
            mb: 2,
            fontWeight: 500,
            fontSize: "0.875rem",
          }}
        >
          {proposal.description}
        </Typography>

        <Box
          sx={{
            mb: 2,
            borderRadius: "6px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            backgroundColor: "rgba(0,0,0,0.3)",
            maxHeight: "400px",
            overflowY: "auto",
            "& .diff-viewer": {
              fontSize: "0.8125rem",
            },
            "& pre": {
              margin: 0,
              padding: "8px",
              fontFamily: "monospace",
              fontSize: "0.8125rem",
            },
          }}
        >
          <DiffViewer
            oldValue={proposal.oldContent || markdown.substring(0, 500)}
            newValue={proposal.newContent}
            splitView={false}
            hideLineNumbers={true}
            showDiffOnly={false}
            styles={{
              variables: {
                light: {
                  addedBackground: "#1e3a1e",
                  addedColor: "#4ade80",
                  removedBackground: "#3a1e1e",
                  removedColor: "#f87171",
                  wordAddedBackground: "#2d5a2d",
                  wordRemovedBackground: "#5a2d2d",
                  codeFoldGutterBackground: "rgba(255,255,255,0.05)",
                  codeFoldBackground: "rgba(255,255,255,0.02)",
                },
              },
              contentText: {
                backgroundColor: "transparent",
                color: "#ececf1",
                fontSize: "0.8125rem",
              },
              gutter: {
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "#8e8ea0",
              },
              diffContainer: {
                backgroundColor: "transparent",
              },
              line: {
                color: "#ececf1",
              },
              wordAdded: {
                backgroundColor: "rgba(16, 163, 127, 0.3)",
              },
              wordRemoved: {
                backgroundColor: "rgba(239, 68, 68, 0.3)",
              },
            }}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            size="small"
            onClick={onAccept}
            sx={{
              backgroundColor: "#10a37f",
              color: "#ffffff",
              textTransform: "none",
              borderRadius: "6px",
              px: 2.5,
              py: 0.875,
              fontSize: "0.875rem",
              fontWeight: 500,
              "&:hover": {
                backgroundColor: "#0d8f6e",
              },
            }}
          >
            Accept Changes
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={onDiscard}
            sx={{
              borderColor: "rgba(255,255,255,0.2)",
              color: "#ececf1",
              textTransform: "none",
              borderRadius: "6px",
              px: 2.5,
              py: 0.875,
              fontSize: "0.875rem",
              fontWeight: 500,
              "&:hover": {
                borderColor: "rgba(255,255,255,0.3)",
                backgroundColor: "rgba(255,255,255,0.05)",
              },
            }}
          >
            Discard
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

