import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MarkdownState {
  markdown: string;
  setMarkdown: (md: string) => void;
  history: string[];
  setHistory: (h: string[]) => void;
  historyIndex: number;
  setHistoryIndex: (i: number) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  loadMarkdown: () => Promise<void>;
}

export const useMarkdownStore = create<MarkdownState>()(
  persist(
    (set, get) => ({
      markdown: "",
      history: [],
      historyIndex: -1,
      setMarkdown: (newMd) => {
        const { history, historyIndex } = get();
        const newHistory = [...history.slice(0, historyIndex + 1), newMd];
        set({
          markdown: newMd,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      },
      setHistory: (h) => set({ history: h }),
      setHistoryIndex: (i) => set({ historyIndex: i }),
      canUndo: () => {
        const { historyIndex } = get();
        return historyIndex > 0;
      },
      canRedo: () => {
        const { history, historyIndex } = get();
        return historyIndex < history.length - 1;
      },
      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          set({
            markdown: history[newIndex],
            historyIndex: newIndex,
          });
        }
      },
      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          set({
            markdown: history[newIndex],
            historyIndex: newIndex,
          });
        }
      },
      loadMarkdown: async () => {
        try {
          const res = await fetch("/manual.mmd");
          if (!res.ok) {
            throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
          }
          const text = await res.text();
          
          // For very large files, don't store full history to avoid localStorage issues
          // Only store the current state, not full history
          set({
            markdown: text,
            history: text.length > 100000 ? [text] : [text], // Only store one entry for very large files
            historyIndex: 0,
          });
        } catch (e) {
          console.error("Failed to load markdown", e);
          set({
            markdown: "# Welcome\n\nPaste your markdown here.",
            history: ["# Welcome\n\nPaste your markdown here."],
            historyIndex: 0,
          });
        }
      },
    }),
    {
      name: "markdown-storage",
      partialize: (state) => {
        // For very large files (>200KB), don't persist to avoid localStorage quota issues
        // Users will need to reload the file, but editing state is preserved in memory
        if (state.markdown.length > 200000) {
          return {
            markdown: "", // Don't persist very large files
            history: [],
            historyIndex: -1,
          };
        }
        return {
          markdown: state.markdown,
          history: state.history,
          historyIndex: state.historyIndex,
        };
      },
    }
  )
);
