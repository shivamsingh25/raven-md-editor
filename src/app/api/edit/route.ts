import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getMMDIndex } from "../utils/mmdIndex";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Set in .env.local
});

// Helper function to find all occurrences of a pattern in markdown
function findAllOccurrences(markdown: string, pattern: string): number[] {
  const occurrences: number[] = [];
  let index = markdown.indexOf(pattern);
  while (index !== -1) {
    occurrences.push(index);
    index = markdown.indexOf(pattern, index + 1);
  }
  return occurrences;
}

// Helper function to extract keywords and understand intent from request
function extractIntent(request: string): {
  keywords: string[];
  intent: "math" | "table" | "chapter" | "section" | "general" | "formatting";
  mentions: string[];
} {
  const lowerRequest = request.toLowerCase();
  const keywords: string[] = [];
  const mentions: string[] = [];
  let intent: "math" | "table" | "chapter" | "section" | "general" | "formatting" = "general";

  // Extract meaningful keywords (3+ chars, not common words)
  const words = lowerRequest.match(/\b\w{3,}\b/g) || [];
  const commonWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "its", "let", "put", "say", "she", "too", "use"]);
  
  for (const word of words) {
    if (!commonWords.has(word) && word.length >= 3) {
      keywords.push(word);
    }
  }

  // Detect intent
  if (/\b(math|equation|formula|solve|calculate|compute|latex|tex)\b/i.test(request)) {
    intent = "math";
  } else if (/\b(table|row|column|cell|header)\b/i.test(request)) {
    intent = "table";
  } else if (/\b(chapter|section|heading|title)\b/i.test(request)) {
    intent = "chapter";
  } else if (/\b(format|style|bold|italic|underline|font)\b/i.test(request)) {
    intent = "formatting";
  }

  // Extract mentions (quoted strings, specific terms)
  const quoted = request.match(/["']([^"']+)["']/g);
  if (quoted) {
    mentions.push(...quoted.map(q => q.replace(/["']/g, "")));
  }

  // Extract chapter/section numbers
  const chapterMatch = request.match(/chapter\s+(\d+)/i);
  if (chapterMatch) mentions.push(`Chapter ${chapterMatch[1]}`);

  const sectionMatch = request.match(/section\s+(\d+)/i);
  if (sectionMatch) mentions.push(`Section ${sectionMatch[1]}`);

  return { keywords, intent, mentions };
}

// Helper function to find relevant sections based on keywords
function findRelevantSections(markdown: string, keywords: string[], maxResults: number = 5): string[] {
  const sections: Array<{ text: string; score: number; index: number }> = [];
  
  // Split by paragraphs/sections
  const blocks = markdown.split(/\n\n+/);
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].toLowerCase();
    let score = 0;
    
    // Score based on keyword matches
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      const matches = block.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    if (score > 0) {
      // Include surrounding context
      const start = Math.max(0, i - 1);
      const end = Math.min(blocks.length, i + 2);
      const context = blocks.slice(start, end).join("\n\n");
      
      sections.push({
        text: context,
        score,
        index: i,
      });
    }
  }
  
  // Sort by score and return top results
  sections.sort((a, b) => b.score - a.score);
  return sections.slice(0, maxResults).map(s => s.text);
}

// Helper function to get relevant context from markdown with MMD index enhancement
function getRelevantContext(markdown: string, selectedText: string | null, request: string, maxChars: number = 25000): string {
  let context = "";
  let enhancedInfo = "";

  // Extract intent and keywords from request
  const { keywords, intent, mentions } = extractIntent(request);

  // Use MMD index to get enhanced context if available (optional - won't break if unavailable)
  try {
    const mmdIndex = getMMDIndex();
    if (mmdIndex.isLoaded()) {
      try {
        enhancedInfo = mmdIndex.getEnhancedContext(markdown, selectedText, request);
      } catch (error) {
        // Index methods failed - continue without enhancement
      }
    }
  } catch (error) {
    // Index unavailable - continue without it
  }

  // If text is selected, find its context in the document
  if (selectedText && selectedText.trim()) {
    // Try to use MMD index first for better accuracy (if available)
    try {
      const mmdIndex = getMMDIndex();
      if (mmdIndex.isLoaded()) {
        try {
          const occurrences = mmdIndex.findAllOccurrencesWithContext(selectedText, 3);
          if (occurrences.length > 0) {
            const contextParts = occurrences.map(occ => occ.context);
            context = contextParts.join('\n\n[... location change ...]\n\n');
            if (occurrences.length > 1) {
              enhancedInfo += `\n\nIMPORTANT: The selected text appears ${occurrences.length} times in the document. Make sure to update ALL occurrences if needed.`;
            }
          }
        } catch (error) {
          // Index lookup failed - fall through to string search
        }
      }
    } catch (error) {
      // Index unavailable - fall through to string search
    }

    // Fallback to simple string search if index not available
    if (!context) {
      const selectedIndex = markdown.indexOf(selectedText);
      if (selectedIndex !== -1) {
        const contextBefore = Math.max(0, selectedIndex - 5000);
        const contextAfter = Math.min(markdown.length, selectedIndex + selectedText.length + 5000);
        context = markdown.substring(contextBefore, contextAfter);
      }
    }
  } else {
    // No selection - intelligently find relevant context based on request
    
    // First, try to find specific mentions (chapters, sections, etc.)
    if (mentions.length > 0) {
      for (const mention of mentions) {
        const mentionIndex = markdown.indexOf(mention);
        if (mentionIndex !== -1) {
          const start = Math.max(0, mentionIndex - 3000);
          const end = Math.min(markdown.length, mentionIndex + mention.length + 3000);
          const mentionContext = markdown.substring(start, end);
          if (mentionContext.length > 0) {
            context += (context ? "\n\n[...]\n\n" : "") + mentionContext;
            if (context.length > maxChars * 0.7) break;
          }
        }
      }
    }

    // Try MMD index for chapter/section requests
    if (!context || context.length < 1000) {
      const chapterMatch = request.match(/chapter\s+(\d+)/i);
      if (chapterMatch) {
        try {
          const mmdIndex = getMMDIndex();
          if (mmdIndex.isLoaded()) {
            try {
              const chapterNum = chapterMatch[1];
              const chapters = mmdIndex.findChapter(`Chapter ${chapterNum}`);
              
              if (chapters.length > 0) {
                const contextParts = chapters.map(ch => ch.context);
                context = (context ? context + "\n\n[...]\n\n" : "") + contextParts.join('\n\n[... chapter occurrence ...]\n\n');
                enhancedInfo += `\n\nFound Chapter ${chapterNum} at ${chapters.length} location(s) in the document.`;
              }
            } catch (error) {
              // Index lookup failed - fall through
            }
          }
        } catch (error) {
          // Index unavailable - fall through
        }
      }
    }

    // If still no context, use keyword-based search
    if (!context || context.length < 1000) {
      if (keywords.length > 0) {
        const relevantSections = findRelevantSections(markdown, keywords, 3);
        if (relevantSections.length > 0) {
          context = relevantSections.join("\n\n[...]\n\n");
        }
      }
    }

    // Fallback to pattern matching for specific patterns
    if (!context || context.length < 500) {
      const titleMatch = request.match(/(?:change|update|edit).*(?:chapter|section|title).*(?:to|as)\s+["']?([^"']+)["']?/i);
      if (titleMatch) {
        const chapterMatch = request.match(/chapter\s+(\d+)/i);
        if (chapterMatch) {
          const chapterNum = chapterMatch[1];
          const patterns = [
            new RegExp(`(?:Chapter|chapter)\\s*${chapterNum}[^\\n]*`, 'gi'),
            new RegExp(`\\\\section\\*?\\{[^}]*Chapter\\s*${chapterNum}[^}]*\\}`, 'gi'),
            new RegExp(`#+\\s*Chapter\\s*${chapterNum}[^\\n]*`, 'gi'),
          ];
          
          for (const pattern of patterns) {
            const matches = markdown.match(pattern);
            if (matches && matches.length > 0) {
              const contextParts: string[] = [];
              
              for (const match of matches) {
                const index = markdown.indexOf(match);
                if (index !== -1) {
                  const start = Math.max(0, index - 2000);
                  const end = Math.min(markdown.length, index + match.length + 2000);
                  contextParts.push(markdown.substring(start, end));
                }
              }
              
              if (contextParts.length > 0) {
                context = (context ? context + "\n\n[...]\n\n" : "") + contextParts.join('\n\n[...]\n\n');
                break;
              }
            }
          }
        }
      }
    }
  }
  
  // If still no context, use default strategy
  if (!context) {
    if (markdown.length > maxChars) {
      const firstPortion = markdown.substring(0, Math.floor(maxChars * 0.7));
      const lastPortion = markdown.substring(markdown.length - Math.floor(maxChars * 0.3));
      context = `${firstPortion}\n\n[... document continues ...]\n\n${lastPortion}`;
    } else {
      context = markdown;
    }
  }

  // Limit context size and append enhanced info
  if (context.length > maxChars) {
    context = context.substring(0, maxChars) + "\n[... truncated ...]";
  }

  // Append enhanced info if available (limit its size too)
  if (enhancedInfo && enhancedInfo.length < 2000) {
    context += enhancedInfo;
  }

  return context;
}

// Helper to estimate token count (rough approximation: 1 token ≈ 4 characters)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function POST(req: NextRequest) {
  try {
    // Validate OpenAI API key first
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable." },
        { status: 500 }
      );
    }

    const { markdown, selectedText, request } = await req.json();

    if (!request || !request.trim()) {
      return NextResponse.json(
        { error: "Request is required" },
        { status: 400 }
      );
    }

    if (!markdown) {
      return NextResponse.json(
        { error: "Markdown content is required" },
        { status: 400 }
      );
    }

    // Get relevant context (chunked for large files)
    const relevantContext = getRelevantContext(markdown, selectedText, request, 25000);
    const contextSize = estimateTokens(relevantContext);
    
    // Get MMD index for enhanced context (optional - won't break if unavailable)
    let structureInfo = "";
    try {
      const mmdIndex = getMMDIndex();
      const useEnhancedIndex = mmdIndex.isLoaded();
      
      if (useEnhancedIndex) {
        try {
          const structure = mmdIndex.getDocumentStructure();
          if (structure && structure.chapters && structure.chapters.length > 0) {
            structureInfo = `\n\nDocument Structure: ${structure.totalPages} pages, ${structure.totalLines} lines, ${structure.chapters.length} chapters/sections detected.`;
          }
        } catch (error) {
          // Silently continue without structure info
        }
      }
    } catch (error) {
      // Index loading failed - continue without it (optional feature)
    }
    
    console.log(`Processing request: context size ~${contextSize} tokens, full doc: ${markdown.length} chars, request: "${request.substring(0, 50)}..."`);

    // Determine intent for better context
    const { intent, keywords } = extractIntent(request);
    
    // Build context message based on intent
    let contextMessage = "";
    if (selectedText) {
      contextMessage = `The user has selected this text: "${selectedText}"\n\n`;
    }
    
    contextMessage += `Document Context:\n${relevantContext}${structureInfo}`;
    
    if (markdown.length > 25000) {
      contextMessage += '\n\nNote: This is a large document. The context above shows relevant sections.';
    }

    // Build capability-specific instructions
    let capabilityInstructions = "";
    
    if (intent === "math") {
      capabilityInstructions = "MATH/EQUATION EDITING:\n" +
        "- You can solve equations, simplify expressions, or fix math notation\n" +
        "- Preserve LaTeX/MathJax syntax exactly (\\[ \\], \\( \\), $$, etc.)\n" +
        "- If solving, show the solution clearly\n" +
        "- If correcting, fix the math syntax while preserving the meaning\n" +
        "- Use proper mathematical notation\n\n";
    } else if (intent === "table") {
      capabilityInstructions = "TABLE EDITING:\n" +
        "- You can edit table cells, rows, columns, or headers\n" +
        "- Preserve table structure (markdown table syntax: | | |)\n" +
        "- Maintain alignment and formatting\n" +
        "- If adding/removing rows/columns, ensure proper alignment\n" +
        "- Keep table markdown syntax valid\n\n";
    } else if (intent === "chapter" || intent === "section") {
      capabilityInstructions = "CHAPTER/SECTION EDITING:\n" +
        "- Find and update ALL occurrences (table of contents AND actual headers)\n" +
        "- Use exact text matching including markdown formatting\n" +
        "- Set replaceAll: true if multiple occurrences exist\n" +
        "- Preserve document structure\n\n";
    } else if (intent === "formatting") {
      capabilityInstructions = "FORMATTING:\n" +
        "- Apply markdown formatting (bold, italic, headers, lists, etc.)\n" +
        "- Preserve existing structure\n" +
        "- Use proper markdown syntax\n\n";
    }

    // Enhanced prompt for better context understanding with MMD index support
    const hasStructureInfo = structureInfo.length > 0;
    const enhancedInstructions = hasStructureInfo
      ? "IMPORTANT INSTRUCTIONS (Enhanced with Document Structure):\n" +
        "1. The document structure information above shows exact locations (pages, lines) of chapters and sections.\n" +
        "2. You are a comprehensive document assistant - you can edit ANY part of the document: text, math, tables, formatting, structure, etc.\n" +
        "3. If the request mentions changing a chapter title, section title, or heading, you MUST find and update ALL occurrences of that title throughout the document.\n" +
        "4. Use the page and line number information to ensure you're updating both the table of contents AND the actual chapter/section headers.\n" +
        "5. If multiple occurrences are shown, set replaceAll: true and make sure oldContent matches all of them.\n" +
        "6. Be precise with oldContent - use the exact text as it appears, including any markdown formatting (\\section*, \\title, etc.).\n" +
        "7. Pay attention to the location markers (Page X, Line Y) to understand document structure.\n" +
        "8. You can work on ANY part of the document - math equations, tables, text, formatting - be smart about finding the right context.\n\n"
      : "IMPORTANT INSTRUCTIONS:\n" +
        "1. You are a comprehensive document assistant - you can edit ANY part of the document: text, math equations, tables, formatting, structure, etc.\n" +
        "2. If the request mentions changing a chapter title, section title, or heading, you MUST find and update ALL occurrences of that title throughout the document (not just the table of contents).\n" +
        "3. Look for the title in the table of contents AND in the actual chapter/section headers later in the document.\n" +
        "4. If the oldContent matches multiple places, the edit should update all of them. Use a pattern that will match all occurrences.\n" +
        "5. Be precise with the oldContent - use the exact text as it appears, including any markdown formatting.\n" +
        "6. You can solve math problems, edit table values, fix formatting, or make any other document changes - be smart about understanding what the user wants.\n\n";

    const prompt =
      'You are an intelligent document assistant that can help with ANY aspect of document editing. User request: "' +
      request +
      '".\n\n' +
      contextMessage +
      "\n\n" +
      capabilityInstructions +
      enhancedInstructions +
      "CAPABILITIES:\n" +
      "- Edit text, paragraphs, sentences\n" +
      "- Solve math equations and fix math notation\n" +
      "- Edit table cells, rows, columns\n" +
      "- Change formatting (bold, italic, headers, lists)\n" +
      "- Update chapter/section titles (all occurrences)\n" +
      "- Fix grammar, spelling, clarity\n" +
      "- Reorganize content\n" +
      "- Any other document improvement\n\n" +
      "Propose an edit. Respond with natural language explanation, then a JSON block with:\n" +
      "{\n" +
      '  "description": "Brief explanation of what will change",\n' +
      '  "oldContent": "The exact text to replace (use a pattern that matches all occurrences if needed)",\n' +
      '  "newContent": "The new Markdown text",\n' +
      '  "replaceAll": true/false  // Set to true if this should replace all occurrences, false for single replacement\n' +
      '  "isSafe": true/false  // Only true if edit is clear, safe, and valid Markdown\n' +
      "}\n\n" +
      "If unclear or unsafe, explain and set isSafe: false without newContent.\n\n" +
      "End with ```json ... ``` for the proposal. Keep response concise.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000, // Limit response size
    });

    // Use the response stream (async iterable) from the OpenAI client, formatted as SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              const sseData = `data: ${JSON.stringify({
                choices: [{ delta: { content: delta } }],
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseData));
            }
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Streaming error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("API Error:", error);
    
    // Provide more specific error messages
    let errorMessage = "Internal server error";
    let statusCode = 500;
    let errorDetails: string | undefined;
    
    if (error instanceof OpenAI.APIError) {
      statusCode = error.status || 500;
      errorMessage = error.message || "OpenAI API error";
      
      if (error.status === 401) {
        errorMessage = "Invalid API key. Please check your OPENAI_API_KEY environment variable in Amplify.";
      } else if (error.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (error.status === 413 || errorMessage.includes("too long")) {
        errorMessage = "Request too large. Please select a smaller portion of text or use a more specific request.";
      }
      errorDetails = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack;
    } else {
      errorMessage = String(error);
    }
    
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === "production") {
      errorDetails = undefined;
    }
    
    return NextResponse.json(
      { error: errorMessage, ...(errorDetails && { details: errorDetails }) },
      { status: statusCode }
    );
  }
}
