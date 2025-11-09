"use client";

import { useState, useEffect, useCallback } from "react";
import { Box } from "@mui/material";
import { MathpixLoader } from "mathpix-markdown-it";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useMarkdownStore } from "./store/useMarkdownStore";
import { EditProposal } from "./types";
import Header from "./components/Header";
import DocumentViewer from "./components/DocumentViewer";
import ChatPanel from "./components/ChatPanel";
import { useChat } from "./hooks/useChat";
import { useDocumentSelection } from "./hooks/useDocumentSelection";

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

  const [isLoadingFile, setIsLoadingFile] = useState(true);
  const { selectedText, setSelectedText, handleSelection, handleDoubleClick } =
    useDocumentSelection();
  const { messages, input, setInput, isLoading, streamingResponse, submitMessage, removeProposal } =
    useChat();

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

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    const message = input.trim();
    setInput("");
    submitMessage(message, markdown, selectedText);
  }, [input, markdown, selectedText, submitMessage, setInput]);

  const handleDoubleClickWithInput = useCallback(
    (e: React.MouseEvent) => {
      const preview = handleDoubleClick(e);
      if (preview) {
        setInput(`Please edit this section: "${preview}"`);
      }
    },
    [handleDoubleClick, setInput]
  );

  const acceptEdit = useCallback(
    (proposal: EditProposal, messageIndex: number) => {
      if (proposal?.newContent) {
        let newMarkdown = markdown;

        if (proposal.oldContent) {
          if (proposal.replaceAll) {
            const escapedOldContent = proposal.oldContent.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );
            const regex = new RegExp(escapedOldContent, "g");
            newMarkdown = markdown.replace(regex, proposal.newContent);
          } else {
            newMarkdown = markdown.replace(proposal.oldContent, proposal.newContent);
          }
        } else {
          newMarkdown = proposal.newContent;
        }

        setMarkdown(newMarkdown);
        removeProposal(messageIndex);
      }
    },
    [markdown, setMarkdown, removeProposal]
  );

  const discardEdit = useCallback(
    (messageIndex: number) => {
      removeProposal(messageIndex);
    },
    [removeProposal]
  );

  return (
    <MathpixLoader>
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <Header
          canUndo={canUndo()}
          canRedo={canRedo()}
          onUndo={undo}
          onRedo={redo}
          selectedText={selectedText}
        />
        <PanelGroup direction="horizontal" style={{ height: "calc(100vh - 48px)" }}>
          <Panel defaultSize={50} minSize={30}>
            <Box
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
              }}
            >
              <DocumentViewer
                markdown={markdown}
                isLoading={isLoadingFile}
                onDoubleClick={handleDoubleClickWithInput}
                onSelection={handleSelection}
              />
            </Box>
          </Panel>
          <PanelResizeHandle
            style={{ width: "5px", background: "transparent", cursor: "col-resize" }}
          />
          <Panel defaultSize={50} minSize={30}>
            <ChatPanel
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              streamingResponse={streamingResponse}
              markdown={markdown}
              selectedText={selectedText}
              onAcceptEdit={acceptEdit}
              onDiscardEdit={discardEdit}
            />
          </Panel>
        </PanelGroup>
      </Box>
    </MathpixLoader>
  );
}
