"use client";

import { useRef, useCallback, useMemo, useEffect } from "react";
import { List, type ListImperativeAPI, type RowComponentProps } from "react-window";
import { Box, Typography } from "@mui/material";
import { MathpixMarkdown } from "mathpix-markdown-it";

interface MarkdownBlockProps {
  markdown: string;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

const MarkdownBlock = ({ markdown, onDoubleClick }: MarkdownBlockProps) => {
  return (
    <Box
      onDoubleClick={onDoubleClick}
      sx={{
        p: 1.5,
        mb: 0.5,
        width: "100%",
        position: "relative",
        cursor: "text",
        "&:hover": {
          backgroundColor: "action.hover",
        },
        "& > *": {
          maxWidth: "100%",
          wordWrap: "break-word",
          overflowWrap: "break-word",
        },
        "& .mathpix-markdown": {
          "& h1, & h2, & h3, & h4, & h5, & h6": {
            marginTop: "0.75em",
            marginBottom: "0.5em",
          },
          "& p": {
            marginTop: "0.5em",
            marginBottom: "0.5em",
          },
          "& section": {
            marginTop: "0.75em",
            marginBottom: "0.75em",
          },
        },
      }}
    >
      <MathpixMarkdown text={markdown} />
    </Box>
  );
};

interface DocumentViewerProps {
  markdown: string;
  isLoading: boolean;
  onDoubleClick: (e: React.MouseEvent) => void;
  onSelection: () => void;
}

export default function DocumentViewer({
  markdown,
  isLoading,
  onDoubleClick,
  onSelection,
}: DocumentViewerProps) {
  const listRef = useRef<ListImperativeAPI | null>(null);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());

  const blocks = useMemo(() => {
    if (!markdown) return [];

    const rawBlocks = markdown.split(/\n\n+/);
    const processedBlocks: string[] = [];

    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (trimmed.length === 0) continue;

      if (trimmed.length > 5000) {
        const subBlocks = trimmed.split(/\n/);
        let currentSubBlock = "";
        for (const line of subBlocks) {
          if (currentSubBlock.length + line.length > 5000 && currentSubBlock) {
            processedBlocks.push(currentSubBlock.trim());
            currentSubBlock = line;
          } else {
            currentSubBlock += (currentSubBlock ? "\n" : "") + line;
          }
        }
        if (currentSubBlock.trim()) {
          processedBlocks.push(currentSubBlock.trim());
        }
      } else {
        processedBlocks.push(trimmed);
      }
    }

    return processedBlocks;
  }, [markdown]);

  useEffect(() => {
    itemHeightsRef.current.clear();
  }, [markdown]);

  const getItemSize = useCallback(
    (index: number) => {
      const cached = itemHeightsRef.current.get(index);
      if (cached) return cached;

      const block = blocks[index];
      if (!block) return 100;

      const lines = block.split("\n").length;
      const charCount = block.length;
      const estimatedLines = Math.max(lines, Math.ceil(charCount / 80));
      const estimatedHeight = Math.max(100, estimatedLines * 28 + 32);

      itemHeightsRef.current.set(index, estimatedHeight);
      return estimatedHeight;
    },
    [blocks]
  );

  const Row = useCallback(
    ({ index, style }: RowComponentProps<Record<string, never>>) => {
      return (
        <div
          style={{
            ...style,
            width: "100%",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <MarkdownBlock
            markdown={blocks[index] || ""}
            onDoubleClick={onDoubleClick}
          />
        </div>
      );
    },
    [blocks, onDoubleClick]
  );

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <Typography sx={{ p: 2, color: "text.secondary" }}>
          Loading document...
          {markdown ? ` (${Math.round(markdown.length / 1024)}KB)` : ""}
        </Typography>
      </Box>
    );
  }

  if (blocks.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <Typography sx={{ p: 2, color: "text.secondary" }}>
          No content to display
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      onMouseUp={onSelection}
      sx={{
        height: "100%",
        width: "100%",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
        userSelect: "text",
      }}
    >
      <Box sx={{ height: "100%", width: "100%", overflow: "hidden" }}>
        <List<Record<string, never>>
          listRef={listRef}
          rowCount={blocks.length}
          rowHeight={getItemSize}
          rowComponent={Row}
          rowProps={{}}
          style={{ height: "100%", width: "100%" }}
        />
      </Box>
    </Box>
  );
}

