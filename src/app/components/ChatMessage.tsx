"use client";

import { Box, Typography } from "@mui/material";
import { EditProposal as EditProposalType } from "../types";
import EditProposal from "./EditProposal";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  proposal?: EditProposalType | null;
  markdown: string;
  onAcceptProposal: () => void;
  onDiscardProposal: () => void;
}

export default function ChatMessage({
  role,
  content,
  proposal,
  markdown,
  onAcceptProposal,
  onDiscardProposal,
}: ChatMessageProps) {
  const isUser = role === "user";
  const hasProposal = proposal && proposal.isSafe && proposal.newContent;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: isUser ? "#343541" : "#444654",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <Box
        sx={{
          maxWidth: "768px",
          mx: "auto",
          width: "100%",
          px: 4,
          py: 4,
          display: "flex",
          gap: 4,
          flexDirection: isUser ? "row-reverse" : "row",
        }}
      >
        <Box
          sx={{
            width: "30px",
            height: "30px",
            borderRadius: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isUser ? "#10a37f" : "#19c37d",
            color: "#ffffff",
            fontSize: "0.875rem",
            fontWeight: 600,
            flexShrink: 0,
            mt: 0.5,
          }}
        >
          {isUser ? "U" : "AI"}
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="body1"
            sx={{
              color: "#ececf1",
              whiteSpace: "pre-wrap",
              lineHeight: 1.75,
              fontSize: "0.9375rem",
              wordBreak: "break-word",
            }}
          >
            {content}
          </Typography>

          {hasProposal && proposal && (
            <EditProposal
              proposal={proposal}
              markdown={markdown}
              onAccept={onAcceptProposal}
              onDiscard={onDiscardProposal}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

