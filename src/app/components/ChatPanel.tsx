"use client";

import { Box, Typography } from "@mui/material";
import { useEffect, useRef } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { EditProposal } from "../types";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  proposal?: EditProposal | null;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  streamingResponse: string;
  markdown: string;
  selectedText: string;
  onAcceptEdit: (proposal: EditProposal, messageIndex: number) => void;
  onDiscardEdit: (messageIndex: number) => void;
}

export default function ChatPanel({
  messages,
  input,
  onInputChange,
  onSubmit,
  isLoading,
  streamingResponse,
  markdown,
  selectedText,
  onAcceptEdit,
  onDiscardEdit,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingResponse]);

  const displayMessages = messages.filter((msg) => msg.role !== "system");

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#343541",
      }}
    >
      <Box
        sx={{
          p: 2,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          backgroundColor: "#202123",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: "#ffffff",
            fontSize: "1rem",
          }}
        >
          AI Editor
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "#343541",
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            backgroundColor: "#343541",
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#565869",
            borderRadius: "4px",
            "&:hover": {
              backgroundColor: "#6e6f7f",
            },
          },
        }}
      >
        {displayMessages.length === 0 && !isLoading && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#8e8ea0",
              p: 4,
              textAlign: "center",
            }}
          >
            <Typography
              variant="h6"
              sx={{ mb: 1, color: "#ffffff", fontWeight: 500 }}
            >
              How can I help you edit today?
            </Typography>
            <Typography variant="body2" sx={{ color: "#8e8ea0" }}>
              Select text and ask me to edit it, or describe what you'd like to
              change.
            </Typography>
          </Box>
        )}

        {displayMessages.map((msg, idx) => {
          if (msg.role === "system") return null;
          return (
            <ChatMessage
              key={idx}
              role={msg.role as "user" | "assistant"}
              content={msg.content}
              proposal={msg.proposal}
              markdown={markdown}
              onAcceptProposal={() => onAcceptEdit(msg.proposal!, idx)}
              onDiscardProposal={() => onDiscardEdit(idx)}
            />
          );
        })}

        {isLoading && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: "#444654",
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
                  backgroundColor: "#19c37d",
                  color: "#ffffff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  flexShrink: 0,
                  mt: 0.5,
                }}
              >
                AI
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {streamingResponse ? (
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
                    {streamingResponse}
                  </Typography>
                ) : (
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Box
                      sx={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: "#8e8ea0",
                        animation: "pulse 1.5s ease-in-out infinite",
                        "@keyframes pulse": {
                          "0%, 100%": { opacity: 1 },
                          "50%": { opacity: 0.3 },
                        },
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#8e8ea0",
                        fontStyle: "italic",
                      }}
                    >
                      AI is thinking...
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSubmit}
        disabled={isLoading}
        placeholder={
          selectedText
            ? "Edit selected section..."
            : "Message AI Editor..."
        }
      />
    </Box>
  );
}

