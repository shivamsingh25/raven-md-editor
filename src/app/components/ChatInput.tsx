"use client";

import { Box, TextField, IconButton } from "@mui/material";
import { Send } from "@mui/icons-material";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = "Message AI Editor...",
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: "#40414f",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <Box
        sx={{
          maxWidth: "768px",
          mx: "auto",
          display: "flex",
          gap: 2,
          alignItems: "flex-end",
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={6}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          sx={{
            "& .MuiOutlinedInput-root": {
              backgroundColor: "#40414f",
              color: "#ececf1",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.2)",
              "& fieldset": {
                border: "none",
              },
              "&:hover fieldset": {
                border: "none",
              },
              "&.Mui-focused fieldset": {
                border: "1px solid rgba(16, 163, 127, 0.5)",
              },
              "& .MuiInputBase-input": {
                color: "#ececf1",
                "&::placeholder": {
                  color: "#8e8ea0",
                  opacity: 1,
                },
              },
            },
          }}
        />
        <IconButton
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          sx={{
            backgroundColor:
              value.trim() && !disabled ? "#10a37f" : "rgba(255,255,255,0.1)",
            color: "#ffffff",
            width: "40px",
            height: "40px",
            "&:hover": {
              backgroundColor:
                value.trim() && !disabled
                  ? "#0d8f6e"
                  : "rgba(255,255,255,0.15)",
            },
            "&:disabled": {
              backgroundColor: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.3)",
            },
          }}
        >
          <Send fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

