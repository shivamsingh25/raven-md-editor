"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { List, type ListImperativeAPI, type RowComponentProps } from "react-window";
import { MathpixMarkdown, MathpixLoader } from "mathpix-markdown-it";
import {
  Button,
  TextField,
  Box,
  Paper,
  Typography,
  IconButton,
} from "@mui/material";
import { Send, Undo, Redo } from "@mui/icons-material";
import DiffViewer from "react-diff-viewer";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useMarkdownStore } from "./store/useMarkdownStore";
import { EditProposal } from "./types";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  proposal?: EditProposal | null; // Store proposal with each message
}

const MemoizedMarkdownBlock = React.memo(
  ({ markdown, onDoubleClick }: { markdown: string; onDoubleClick?: (e: React.MouseEvent) => void }) => (
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
  ),
  (prevProps, nextProps) => prevProps.markdown === nextProps.markdown
);
MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export default function Home() {
  const {
    markdown,
    setMarkdown,
    canUndo,
    canRedo,
    undo,
    redo,
    loadMarkdown,
  } = useMarkdownStore();

  const [selectedText, setSelectedText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(true);
  const [activeProposalIndex, setActiveProposalIndex] = useState<number | null>(null);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [streamingProposal, setStreamingProposal] = useState<EditProposal | null>(null);
  const listRef = useRef<ListImperativeAPI | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemHeightsRef = useRef<Map<number, number>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper function to extract proposal from text
  const extractProposalFromText = useCallback((text: string): EditProposal | null => {
    // Try multiple patterns to find JSON
    const patterns = [
      /```json\s*([\s\S]*?)\s*```/,
      /```\s*([\s\S]*?)\s*```/,
      /\{[\s\S]*"oldContent"[\s\S]*"newContent"[\s\S]*\}/,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const jsonStr = match[1] || match[0];
          const proposalData = JSON.parse(jsonStr);
          if (proposalData.oldContent !== undefined && proposalData.newContent !== undefined) {
            return {
              oldContent: proposalData.oldContent || "",
              newContent: proposalData.newContent || "",
              description: proposalData.description || "",
              isSafe: proposalData.isSafe !== false,
              replaceAll: proposalData.replaceAll === true,
            };
          }
        } catch (e) {
          // Try next pattern
          continue;
        }
      }
    }
    
    return null;
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, streamingResponse]);

  // Load markdown on mount
  useEffect(() => {
    const load = async () => {
      setIsLoadingFile(true);
      try {
        await loadMarkdown();
      } finally {
        setIsLoadingFile(false);
      }
    };
    load();
  }, [loadMarkdown]);

  // Split markdown into blocks for virtualization - optimized for large files
  const blocks = useMemo(() => {
    if (!markdown) return [];
    // For very large files, use more aggressive splitting
    // Split by double newlines, but ensure blocks aren't too large
    const rawBlocks = markdown.split(/\n\n+/);
    const processedBlocks: string[] = [];
    
    for (const block of rawBlocks) {
      const trimmed = block.trim();
      if (trimmed.length === 0) continue;
      
      // If block is too large (>5000 chars), split it further by single newlines
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

  // Reset heights when markdown changes
  useEffect(() => {
    itemHeightsRef.current.clear();
  }, [markdown]);

  // Get item size for virtualized list - better estimation for large content
  const getItemSize = useCallback(
    (index: number) => {
      const cached = itemHeightsRef.current.get(index);
      if (cached) return cached;
      
      // Estimate height based on content
      const block = blocks[index];
      if (!block) return 100;
      
      // More accurate estimation: account for text length and line breaks
      const lines = block.split("\n").length;
      const charCount = block.length;
      // Estimate: ~80 chars per line, ~24px per line, plus padding
      const estimatedLines = Math.max(lines, Math.ceil(charCount / 80));
      const estimatedHeight = Math.max(100, estimatedLines * 28 + 32);
      
      itemHeightsRef.current.set(index, estimatedHeight);
      return estimatedHeight;
    },
    [blocks]
  );

  // Handle text selection
  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const selected = selection.toString().trim();
      setSelectedText(selected);
    }
  }, []);

  // Handle double-click to select section and suggest in chat
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get the clicked element
    const target = e.target as HTMLElement;
    
    // Try to find the best text container
    const textContainer = target.closest('p, div, section, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
    
    if (textContainer) {
      // Get text content, removing extra whitespace
      let text = textContainer.textContent?.trim() || '';
      
      // If text is too long, try to get a more focused selection
      if (text.length > 1000) {
        // Try to find the closest meaningful block
        const range = document.createRange();
        const walker = document.createTreeWalker(
          textContainer,
          NodeFilter.SHOW_TEXT,
          null
        );
        
        let node;
        let startNode = null;
        let startOffset = 0;
        let endNode = null;
        let endOffset = 0;
        let charCount = 0;
        
        // Find text around the click point (up to 500 chars)
        while (node = walker.nextNode()) {
          const nodeText = node.textContent || '';
          const nodeLength = nodeText.length;
          
          if (!startNode && charCount + nodeLength >= 0) {
            startNode = node;
            startOffset = 0;
          }
          
          charCount += nodeLength;
          
          if (charCount <= 500) {
            endNode = node;
            endOffset = nodeLength;
          } else {
            break;
          }
        }
        
        if (startNode && endNode) {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          text = range.toString().trim();
        } else {
          // Fallback: take first 500 chars
          text = text.substring(0, 500);
        }
      }
      
      if (text.length > 0 && text.length < 2000) {
        // Set selected text
        setSelectedText(text);
        
        // Auto-populate chat input with a smart suggestion
        const preview = text.length > 150 ? text.substring(0, 150) + '...' : text;
        setInput(`Please edit this section: "${preview}"`);
        
        // Optionally highlight the selection visually
        const selection = window.getSelection();
        if (selection && textContainer) {
          try {
            const range = document.createRange();
            range.selectNodeContents(textContainer);
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (err) {
            // Selection might fail in some cases, that's okay
            console.log('Selection highlight skipped');
          }
        }
      }
    }
  }, []);

  // Row component for virtualized list
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
          <MemoizedMarkdownBlock 
            markdown={blocks[index] || ""} 
            onDoubleClick={handleDoubleClick}
          />
        </div>
      );
    },
    [blocks, handleDoubleClick]
  );

  // Handle form submission
  const handleSubmit = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setStreamingResponse("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          selectedText,
          request: userMessage,
        }),
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = "Failed to get response";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.details) {
            console.error("API Error Details:", errorData.details);
          }
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      let buffer = "";

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                setStreamingResponse(fullResponse);
                
                // Try to extract proposal during streaming (for faster feedback)
                const proposal = extractProposalFromText(fullResponse);
                if (proposal && proposal.isSafe && proposal.newContent) {
                  setStreamingProposal(proposal);
                }
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Final parse of the complete response
      const finalProposal = extractProposalFromText(fullResponse);
      
      // Add message with proposal if available
      const newMessageIndex = chatMessages.length;
      const newMessage: ChatMessage = {
        role: "assistant",
        content: fullResponse,
        proposal: finalProposal && finalProposal.isSafe && finalProposal.newContent ? finalProposal : null,
      };
      
      setChatMessages((prev) => [...prev, newMessage]);
      
      // Clear streaming state
      setStreamingResponse("");
      setStreamingProposal(null);
    } catch (error) {
      console.error("Error submitting request:", error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Sorry, I encountered an error. Please try again.";
      
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${errorMessage}\n\nTips:\n- If the document is very large, try selecting a specific section to edit\n- Check that your OpenAI API key is configured correctly\n- The request may be too large - try a more focused edit request`,
          proposal: null,
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingResponse("");
      setStreamingProposal(null);
    }
  };

  const acceptEdit = useCallback((proposal: EditProposal, messageIndex?: number) => {
    if (proposal?.newContent) {
      let newMarkdown = markdown;
      
      if (proposal.oldContent) {
        // If replaceAll is true, replace all occurrences, otherwise just the first
        if (proposal.replaceAll) {
          // Escape special regex characters in oldContent for literal replacement
          const escapedOldContent = proposal.oldContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedOldContent, 'g');
          newMarkdown = markdown.replace(regex, proposal.newContent);
        } else {
          // Replace only the first occurrence
          newMarkdown = markdown.replace(proposal.oldContent, proposal.newContent);
        }
      } else {
        newMarkdown = proposal.newContent;
      }
      
      setMarkdown(newMarkdown);
      setActiveProposalIndex(null);
      setStreamingProposal(null);
      
      // Update the message to remove proposal
      if (messageIndex !== undefined) {
        setChatMessages((prev) => {
          const updated = [...prev];
          if (updated[messageIndex]) {
            updated[messageIndex] = { ...updated[messageIndex], proposal: null };
          }
          return updated;
        });
      }
    }
  }, [markdown]);

  const discardEdit = useCallback((messageIndex?: number) => {
    setActiveProposalIndex(null);
    setStreamingProposal(null);
    
    // Update the message to remove proposal
    if (messageIndex !== undefined) {
      setChatMessages((prev) => {
        const updated = [...prev];
        if (updated[messageIndex]) {
          updated[messageIndex] = { ...updated[messageIndex], proposal: null };
        }
        return updated;
      });
    }
  }, []);

  return (
    <MathpixLoader>
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
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
            onClick={undo} 
            disabled={!canUndo()} 
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
            onClick={redo} 
            disabled={!canRedo()} 
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
            <Typography variant="caption" sx={{ ml: 2, color: "text.secondary", fontStyle: "italic" }}>
              Selected: {selectedText.substring(0, 50)}{selectedText.length > 50 ? "..." : ""}
            </Typography>
          )}
        </Box>
        <PanelGroup direction="horizontal" style={{ height: "calc(100vh - 48px)" }}>
          <Panel defaultSize={50} minSize={30}>
            <Box
          ref={containerRef}
          onMouseUp={handleSelection}
              onDoubleClick={handleDoubleClick}
          sx={{
                height: "100%",
                width: "100%",
            overflow: "hidden",
            borderRight: 1,
            borderColor: "divider",
            position: "relative",
            display: "flex",
            flexDirection: "column",
                backgroundColor: "background.paper",
                userSelect: "text",
              }}
            >
              {isLoadingFile ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <Typography sx={{ p: 2, color: "text.secondary" }}>
                    Loading document... ({markdown ? `${Math.round(markdown.length / 1024)}KB` : ""})
                  </Typography>
                </Box>
              ) : blocks.length > 0 ? (
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
          ) : (
            <Typography sx={{ p: 2, color: "text.secondary" }}>
                  No content to display
            </Typography>
          )}
        </Box>
          </Panel>
          <PanelResizeHandle style={{ width: "5px", background: "transparent", cursor: "col-resize" }} />
          <Panel defaultSize={50} minSize={30}>
            <Box sx={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#343541" }}>
              {/* ChatGPT-style Header */}
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

              {/* Messages Container - Dark Theme */}
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
                {chatMessages.length === 0 && !isLoading && (
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
                    <Typography variant="h6" sx={{ mb: 1, color: "#ffffff", fontWeight: 500 }}>
                      How can I help you edit today?
                    </Typography>
                    <Typography variant="body2" sx={{ color: "#8e8ea0" }}>
                      Select text and ask me to edit it, or describe what you'd like to change.
                    </Typography>
                  </Box>
                )}
                
                {chatMessages
                  .filter((msg) => msg.role !== "system")
                  .map((msg, idx) => {
                    const isUser = msg.role === "user";
                    const hasProposal = msg.proposal && msg.proposal.isSafe && msg.proposal.newContent;
                    
                    return (
                      <Box
                        key={idx}
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
                          {/* Avatar */}
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

                          {/* Message Content */}
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
                              {msg.content}
                            </Typography>

                            {/* Proposal Actions with Diff Viewer */}
                            {hasProposal && msg.proposal && (
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
                                    {msg.proposal.description}
                                  </Typography>
                                  
                                  {/* Inline Diff Viewer */}
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
                                      oldValue={msg.proposal.oldContent || markdown.substring(0, 500)}
                                      newValue={msg.proposal.newContent}
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
                                      onClick={() => acceptEdit(msg.proposal!, idx)}
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
                                      onClick={() => discardEdit(idx)}
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
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}

                {/* Streaming Response */}
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
                          <>
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
                          </>
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
              {/* Input Area - ChatGPT Style */}
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
                    placeholder={selectedText ? "Edit selected section..." : "Message AI Editor..."}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    disabled={isLoading}
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
                    onClick={handleSubmit}
                    disabled={isLoading || !input.trim()}
                    sx={{
                      backgroundColor: input.trim() && !isLoading ? "#10a37f" : "rgba(255,255,255,0.1)",
                      color: "#ffffff",
                      width: "40px",
                      height: "40px",
                      "&:hover": {
                        backgroundColor: input.trim() && !isLoading ? "#0d8f6e" : "rgba(255,255,255,0.15)",
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
            </Box>
          </Panel>
        </PanelGroup>
      </Box>
    </MathpixLoader>
  );
}
