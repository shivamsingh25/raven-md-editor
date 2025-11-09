"use client";

import { useState, useCallback } from "react";

export function useDocumentSelection() {
  const [selectedText, setSelectedText] = useState("");

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const textContainer = target.closest(
      "p, div, section, h1, h2, h3, h4, h5, h6, li, blockquote, pre"
    );

    if (textContainer) {
      let text = textContainer.textContent?.trim() || "";

      if (text.length > 1000) {
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

        while ((node = walker.nextNode())) {
          const nodeText = node.textContent || "";
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
          text = text.substring(0, 500);
        }
      }

      if (text.length > 0 && text.length < 2000) {
        setSelectedText(text);
        const preview = text.length > 150 ? text.substring(0, 150) + "..." : text;
        return preview;
      }
    }

    return null;
  }, []);

  return {
    selectedText,
    setSelectedText,
    handleSelection,
    handleDoubleClick,
  };
}

