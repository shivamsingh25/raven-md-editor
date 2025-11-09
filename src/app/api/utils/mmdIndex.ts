// Server-side utility to index and search MMD lines data for better AI context
import fs from "fs";
import path from "path";

export interface MMDLine {
  text: string;
  line: number;
  column: number;
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

class MMDIndexServer {
  private linesData: MMDLinesData | null = null;
  private textToLinesMap: Map<string, number[]> = new Map();
  private lineTexts: string[] = [];
  private chapters: Array<{ title: string; lineNum: number; page: number }> = [];
  private loaded = false;

  load(): void {
    if (this.loaded) return;

    try {
      // Try multiple possible paths
      const possiblePaths = [
        path.join(process.cwd(), "public", "mmd_lines_data.json"),
        path.join(process.cwd(), "mmd_lines_data.json"),
        path.join(__dirname, "../../../../public/mmd_lines_data.json"),
      ];

      let filePath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          filePath = possiblePath;
          break;
        }
      }

      if (!filePath) {
        console.warn("mmd_lines_data.json not found in any expected location, continuing without enhanced indexing");
        return;
      }

      const fileContent = fs.readFileSync(filePath, "utf-8");
      this.linesData = JSON.parse(fileContent);
      this.buildIndex();
      this.loaded = true;
      if (this.linesData) {
        console.log(`MMD index loaded successfully: ${this.lineTexts.length} lines, ${this.chapters.length} chapters, ${this.linesData.pages.length} pages`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("Error loading mmd_lines_data.json (will continue without enhanced indexing):", errorMessage);
      // Continue without the index - it's optional and shouldn't break functionality
      this.loaded = false;
    }
  }

  private buildIndex(): void {
    if (!this.linesData) return;

    this.lineTexts = [];
    this.textToLinesMap.clear();
    this.chapters = [];

    // Build index with optimizations for large files
    for (const page of this.linesData.pages) {
      for (const line of page.lines) {
        const lineNum = this.lineTexts.length;
        const lineText = line.text;
        this.lineTexts.push(lineText);

        // Index by normalized text for quick lookup (only for non-empty lines)
        const normalizedText = lineText.trim().toLowerCase();
        if (normalizedText && normalizedText.length > 2) {
          // Index full text (limit to avoid memory issues)
          if (normalizedText.length < 200) {
            if (!this.textToLinesMap.has(normalizedText)) {
              this.textToLinesMap.set(normalizedText, []);
            }
            const existing = this.textToLinesMap.get(normalizedText)!;
            if (existing.length < 50) { // Limit occurrences per text
              existing.push(lineNum);
            }
          }

          // Index by significant words for partial matching (only meaningful words)
          const words = normalizedText
            .split(/\s+/)
            .filter((w) => w.length > 3 && !/^[\\{}[\](),.;:!?'"]+$/.test(w))
            .slice(0, 10); // Limit words per line
          
          for (const word of words) {
            if (!this.textToLinesMap.has(word)) {
              this.textToLinesMap.set(word, []);
            }
            const wordOccurrences = this.textToLinesMap.get(word)!;
            if (!wordOccurrences.includes(lineNum) && wordOccurrences.length < 100) {
              wordOccurrences.push(lineNum);
            }
          }
        }

        // Detect chapters and sections (optimized regex for MMD format)
        const text = lineText.trim();
        if (text.length > 5) {
          // Check for various chapter/section patterns
          const isChapter = 
            /\\section\*?\{[^}]*Chapter/i.test(text) ||
            /\\chapter\*?\{/i.test(text) ||
            /^\\section\*?\{/i.test(text) ||
            /Chapter\s+\d+[^}]*\}/i.test(text) ||
            /^#{1,6}\s+Chapter/i.test(text) ||
            /\\section\*\{Chapter\s+\d+/.test(text);
          
          if (isChapter) {
            // Extract clean title
            let title = text;
            // Remove LaTeX commands but keep content
            title = title.replace(/\\section\*?\{/g, '').replace(/\}/g, '');
            title = title.replace(/\\chapter\*?\{/g, '').replace(/\\title\{/g, '');
            title = title.trim().substring(0, 150).replace(/\n/g, " ");
            
            this.chapters.push({
              title: title || text.substring(0, 150),
              lineNum,
              page: page.page,
            });
          }
        }
      }
    }

    // Sort chapters by line number
    this.chapters.sort((a, b) => a.lineNum - b.lineNum);
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

    // Word-based matching
    const words = normalized.split(/\s+/).filter((w) => w.length > 2);
    for (const word of words) {
      const wordMatches = this.textToLinesMap.get(word);
      if (wordMatches) {
        wordMatches.forEach((line) => results.add(line));
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

  // Get context around line numbers
  getContextAroundLines(lineNums: number[], contextLines: number = 15): string {
    if (!this.loaded || !this.linesData || lineNums.length === 0) return "";

    const allContextLines = new Set<number>();
    
    // Add context around each found line
    for (const lineNum of lineNums.slice(0, 10)) { // Limit to first 10 matches
      const start = Math.max(0, lineNum - contextLines);
      const end = Math.min(this.lineTexts.length, lineNum + contextLines + 1);
      for (let i = start; i < end; i++) {
        allContextLines.add(i);
      }
    }

    const sortedLines = Array.from(allContextLines).sort((a, b) => a - b);
    return sortedLines.map((lineNum) => this.lineTexts[lineNum]).join("");
  }

  // Find chapter by number or title
  findChapter(query: string): Array<{ title: string; lineNum: number; page: number; context: string }> {
    if (!this.loaded || !this.linesData) return [];

    const results: Array<{ title: string; lineNum: number; page: number; context: string }> = [];
    const normalizedQuery = query.toLowerCase();

    for (const chapter of this.chapters) {
      if (
        chapter.title.toLowerCase().includes(normalizedQuery) ||
        normalizedQuery.includes(chapter.title.toLowerCase().substring(0, 20))
      ) {
        const context = this.getContextAroundLines([chapter.lineNum], 20);
        results.push({
          ...chapter,
          context,
        });
      }
    }

    // Also search by chapter number
    const chapterNumMatch = query.match(/(\d+)/);
    if (chapterNumMatch) {
      const num = chapterNumMatch[1];
      for (const chapter of this.chapters) {
        if (chapter.title.includes(`Chapter ${num}`) || chapter.title.includes(`chapter ${num}`)) {
          const context = this.getContextAroundLines([chapter.lineNum], 20);
          if (!results.find((r) => r.lineNum === chapter.lineNum)) {
            results.push({
              ...chapter,
              context,
            });
          }
        }
      }
    }

    return results;
  }

  // Get document structure summary
  getDocumentStructure(): {
    chapters: Array<{ title: string; lineNum: number; page: number }>;
    totalPages: number;
    totalLines: number;
  } {
    if (!this.loaded || !this.linesData) {
      return { chapters: [], totalPages: 0, totalLines: 0 };
    }

    return {
      chapters: this.chapters,
      totalPages: this.linesData.pages.length,
      totalLines: this.lineTexts.length,
    };
  }

  // Find all occurrences of text with context (optimized)
  findAllOccurrencesWithContext(text: string, maxResults: number = 5): Array<{
    lineNum: number;
    text: string;
    page: number;
    context: string;
  }> {
    if (!this.loaded || !this.linesData || !text.trim()) return [];

    // Limit search text length for performance
    const searchText = text.trim().substring(0, 200).toLowerCase();
    const lineNums = this.findTextLines(searchText);
    
    // Deduplicate and limit results
    const uniqueLineNums = Array.from(new Set(lineNums)).slice(0, maxResults);
    const results: Array<{ lineNum: number; text: string; page: number; context: string }> = [];

    for (const lineNum of uniqueLineNums) {
      if (lineNum >= 0 && lineNum < this.lineTexts.length) {
        const page = this.getPageForLine(lineNum);
        const context = this.getContextAroundLines([lineNum], 8); // Reduced context for performance
        results.push({
          lineNum,
          text: this.lineTexts[lineNum].substring(0, 200), // Limit text length
          page,
          context: context.substring(0, 1000), // Limit context length
        });
      }
    }

    return results;
  }

  // Get page number for a given line
  getPageForLine(lineNum: number): number {
    if (!this.loaded || !this.linesData) return 1;

    let currentLine = 0;
    for (const page of this.linesData.pages) {
      const pageLineCount = page.lines.length;
      if (lineNum < currentLine + pageLineCount) {
        return page.page;
      }
      currentLine += pageLineCount;
    }
    return this.linesData.pages[this.linesData.pages.length - 1]?.page || 1;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // Get enhanced context for AI based on request (optimized)
  getEnhancedContext(markdown: string, selectedText: string | null, request: string): string {
    if (!this.loaded) return "";

    let enhancedInfo = "";
    const maxInfoLength = 1500; // Limit total enhanced info length

    try {
      // Check if request mentions a chapter
      const chapterMatch = request.match(/chapter\s+(\d+)/i);
      if (chapterMatch) {
        const chapterNum = chapterMatch[1];
        const chapters = this.findChapter(`Chapter ${chapterNum}`);
        if (chapters.length > 0 && enhancedInfo.length < maxInfoLength) {
          enhancedInfo += `\n\n[Document Structure] Found ${chapters.length} occurrence(s) of Chapter ${chapterNum}:\n`;
          for (const chapter of chapters.slice(0, 5)) { // Limit to first 5
            enhancedInfo += `- Page ${chapter.page}, Line ${chapter.lineNum}: ${chapter.title.substring(0, 60)}\n`;
          }
          if (chapters.length > 5) {
            enhancedInfo += `... and ${chapters.length - 5} more occurrence(s)\n`;
          }
        }
      }

      // If text is selected, find its location (limit processing)
      if (selectedText && selectedText.trim().length < 500) {
        const occurrences = this.findAllOccurrencesWithContext(selectedText, 3);
        if (occurrences.length > 0 && enhancedInfo.length < maxInfoLength) {
          enhancedInfo += `\n\n[Selected Text Location] Found at:\n`;
          for (const occ of occurrences) {
            enhancedInfo += `- Page ${occ.page}, Line ${occ.lineNum}\n`;
          }
          if (occurrences.length > 1) {
            enhancedInfo += `⚠️ IMPORTANT: This text appears ${occurrences.length} times. Update ALL occurrences.\n`;
          }
        }
      }

      // Extract important keywords from request (limit processing)
      if (enhancedInfo.length < maxInfoLength) {
        const keywords = (request.match(/\b\w{5,}\b/gi) || []).slice(0, 2); // Only longer, meaningful words
        if (keywords.length > 0) {
          const relevantInfo: string[] = [];
          for (const keyword of keywords) {
            const matches = this.findTextLines(keyword);
            // Only include if it's not too common (appears < 30 times) but exists
            if (matches.length > 0 && matches.length < 30) {
              const context = this.getContextAroundLines(matches.slice(0, 2), 3);
              if (context.length > 0 && context.length < 300) {
                relevantInfo.push(`${keyword}: ${context.substring(0, 150)}...`);
                if (relevantInfo.length >= 2) break; // Limit to 2 keywords
              }
            }
          }
          if (relevantInfo.length > 0 && enhancedInfo.length + relevantInfo.join('\n').length < maxInfoLength) {
            enhancedInfo += `\n\n[Related Content]\n${relevantInfo.join('\n\n')}`;
          }
        }
      }
    } catch (error) {
      // Silently fail - enhanced info is optional
      console.warn("Error generating enhanced context:", error);
    }

    return enhancedInfo.substring(0, maxInfoLength); // Ensure we don't exceed limit
  }
}

// Singleton instance - lazy load to avoid blocking server startup
let mmdIndexInstance: MMDIndexServer | null = null;
let isLoading = false;

export function getMMDIndex(): MMDIndexServer {
  if (!mmdIndexInstance) {
    mmdIndexInstance = new MMDIndexServer();
    // Load asynchronously to avoid blocking
    if (!isLoading) {
      isLoading = true;
      // Load in background - won't block if it takes time
      try {
        mmdIndexInstance.load();
      } catch (error) {
        console.warn("Background MMD index load failed, will retry on first use");
      } finally {
        isLoading = false;
      }
    }
  }
  // Ensure it's loaded (retry if needed)
  if (!mmdIndexInstance.isLoaded() && !isLoading) {
    try {
      mmdIndexInstance.load();
    } catch (error) {
      // Silent fail - optional feature
    }
  }
  return mmdIndexInstance;
}

