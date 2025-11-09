// Utility to index and search MMD lines data for better context

export interface MMDLine {
  text: string;
  line: number;
  column: number;
  page: number;
  region?: {
    top_left_x: number;
    top_left_y: number;
    width: number;
    height: number;
  };
}

export interface MMDPage {
  image_id: string;
  page: number;
  lines: Array<{
    text: string;
    line: number;
    column: number;
    region?: {
      top_left_x: number;
      top_left_y: number;
      width: number;
      height: number;
    };
  }>;
}

export interface MMDLinesData {
  pages: MMDPage[];
}

class MMDIndex {
  private linesData: MMDLinesData | null = null;
  private textToLinesMap: Map<string, number[]> = new Map();
  private lineTexts: string[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const response = await fetch("/mmd_lines_data.json");
      if (!response.ok) {
        console.warn("Failed to load mmd_lines_data.json, continuing without it");
        return;
      }
      this.linesData = await response.json();
      this.buildIndex();
      this.loaded = true;
      console.log("MMD lines data loaded successfully");
    } catch (error) {
      console.warn("Error loading mmd_lines_data.json:", error);
      // Continue without the index - it's optional
    }
  }

  private buildIndex(): void {
    if (!this.linesData) return;

    this.lineTexts = [];
    this.textToLinesMap.clear();

    for (const page of this.linesData.pages) {
      for (const line of page.lines) {
        const lineNum = this.lineTexts.length;
        this.lineTexts.push(line.text);

        // Index by text content for quick lookup
        const normalizedText = line.text.trim().toLowerCase();
        if (normalizedText) {
          if (!this.textToLinesMap.has(normalizedText)) {
            this.textToLinesMap.set(normalizedText, []);
          }
          this.textToLinesMap.get(normalizedText)!.push(lineNum);
        }

        // Also index by partial matches for better search
        const words = normalizedText.split(/\s+/).filter((w) => w.length > 3);
        for (const word of words) {
          if (!this.textToLinesMap.has(word)) {
            this.textToLinesMap.set(word, []);
          }
          this.textToLinesMap.get(word)!.push(lineNum);
        }
      }
    }
  }

  // Find line numbers where text appears
  findTextLines(text: string): number[] {
    if (!this.loaded || !this.linesData) return [];

    const normalized = text.trim().toLowerCase();
    const results = new Set<number>();

    // Exact match
    const exactMatch = this.textToLinesMap.get(normalized);
    if (exactMatch) {
      exactMatch.forEach((line) => results.add(line));
    }

    // Partial match - check if text contains indexed phrases
    for (const [key, lines] of this.textToLinesMap.entries()) {
      if (normalized.includes(key) || key.includes(normalized)) {
        lines.forEach((line) => results.add(line));
      }
    }

    // Sequential search for better accuracy
    for (let i = 0; i < this.lineTexts.length; i++) {
      if (this.lineTexts[i].toLowerCase().includes(normalized)) {
        results.add(i);
      }
    }

    return Array.from(results).sort((a, b) => a - b);
  }

  // Get context around a line number
  getContextAroundLine(lineNum: number, contextLines: number = 10): string {
    if (!this.loaded || !this.linesData) return "";

    const start = Math.max(0, lineNum - contextLines);
    const end = Math.min(this.lineTexts.length, lineNum + contextLines + 1);

    return this.lineTexts.slice(start, end).join("");
  }

  // Find chapter/section locations
  findChapters(): Array<{ title: string; lineNum: number; page: number }> {
    if (!this.loaded || !this.linesData) return [];

    const chapters: Array<{ title: string; lineNum: number; page: number }> = [];
    let currentPage = 1;

    for (const page of this.linesData.pages) {
      currentPage = page.page;
      for (const line of page.lines) {
        const text = line.text.trim();
        // Look for chapter patterns
        if (
          /\\section\*?\{/.test(text) ||
          /Chapter\s+\d+/i.test(text) ||
          /^#+\s+/.test(text)
        ) {
          chapters.push({
            title: text,
            lineNum: line.line - 1, // Convert to 0-based
            page: currentPage,
          });
        }
      }
    }

    return chapters;
  }

  // Get structured document outline
  getDocumentStructure(): {
    chapters: Array<{ title: string; lineNum: number; page: number }>;
    totalPages: number;
    totalLines: number;
  } {
    if (!this.loaded || !this.linesData) {
      return { chapters: [], totalPages: 0, totalLines: 0 };
    }

    return {
      chapters: this.findChapters(),
      totalPages: this.linesData.pages.length,
      totalLines: this.lineTexts.length,
    };
  }

  // Find all occurrences of a pattern in the document
  findAllOccurrences(pattern: string): Array<{ lineNum: number; text: string; page: number }> {
    if (!this.loaded || !this.linesData) return [];

    const results: Array<{ lineNum: number; text: string; page: number }> = [];
    const regex = new RegExp(pattern, "i");
    let lineNum = 0;
    let currentPage = 1;

    for (const page of this.linesData.pages) {
      currentPage = page.page;
      for (const line of page.lines) {
        if (regex.test(line.text)) {
          results.push({
            lineNum,
            text: line.text,
            page: currentPage,
          });
        }
        lineNum++;
      }
    }

    return results;
  }

  // Get page number for a given line
  getPageForLine(lineNum: number): number {
    if (!this.loaded || !this.linesData) return 1;

    let currentLine = 0;
    for (const page of this.linesData.pages) {
      currentLine += page.lines.length;
      if (lineNum < currentLine) {
        return page.page;
      }
    }
    return this.linesData.pages[this.linesData.pages.length - 1]?.page || 1;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton instance
export const mmdIndex = new MMDIndex();

