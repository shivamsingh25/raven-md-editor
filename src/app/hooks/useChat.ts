"use client";

import { useState, useCallback } from "react";
import { EditProposal } from "../types";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  proposal?: EditProposal | null;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");

  const extractProposal = (text: string): EditProposal | null => {
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
          if (
            proposalData.oldContent !== undefined &&
            proposalData.newContent !== undefined
          ) {
            return {
              oldContent: proposalData.oldContent || "",
              newContent: proposalData.newContent || "",
              description: proposalData.description || "",
              isSafe: proposalData.isSafe !== false,
              replaceAll: proposalData.replaceAll === true,
            };
          }
        } catch (e) {
          continue;
        }
      }
    }

    return null;
  };

  const submitMessage = useCallback(
    async (message: string, markdown: string, selectedText: string) => {
      if (!message.trim()) return;

      setIsLoading(true);
      setStreamingResponse("");
      setMessages((prev) => [...prev, { role: "user", content: message.trim() }]);

      try {
        const response = await fetch("/api/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown,
            selectedText,
            request: message.trim(),
          }),
        });

        if (!response.ok) {
          let errorMessage = "Failed to get response";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
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
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }

        const finalProposal = extractProposal(fullResponse);
        const newMessage: ChatMessage = {
          role: "assistant",
          content: fullResponse,
          proposal:
            finalProposal && finalProposal.isSafe && finalProposal.newContent
              ? finalProposal
              : null,
        };

        setMessages((prev) => [...prev, newMessage]);
        setStreamingResponse("");
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Sorry, I encountered an error. Please try again.";

        setMessages((prev) => [
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
      }
    },
    []
  );

  const removeProposal = useCallback((messageIndex: number) => {
    setMessages((prev) => {
      const updated = [...prev];
      if (updated[messageIndex]) {
        updated[messageIndex] = { ...updated[messageIndex], proposal: null };
      }
      return updated;
    });
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    streamingResponse,
    submitMessage,
    removeProposal,
  };
}

