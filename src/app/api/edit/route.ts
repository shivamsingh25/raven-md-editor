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

// Helper function to get relevant context from markdown with MMD index enhancement
function getRelevantContext(markdown: string, selectedText: string | null, request: string, maxChars: number = 25000): string {
  const mmdIndex = getMMDIndex();
  let context = "";
  let enhancedInfo = "";

  // Use MMD index to get enhanced context if available
  if (mmdIndex.isLoaded()) {
    enhancedInfo = mmdIndex.getEnhancedContext(markdown, selectedText, request);
  }

  // If text is selected, find its context in the document
  if (selectedText && selectedText.trim()) {
    // Try to use MMD index first for better accuracy
    if (mmdIndex.isLoaded()) {
      const occurrences = mmdIndex.findAllOccurrencesWithContext(selectedText, 3);
      if (occurrences.length > 0) {
        const contextParts = occurrences.map(occ => occ.context);
        context = contextParts.join('\n\n[... location change ...]\n\n');
        if (occurrences.length > 1) {
          enhancedInfo += `\n\nIMPORTANT: The selected text appears ${occurrences.length} times in the document. Make sure to update ALL occurrences if needed.`;
        }
      }
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
    // No selection - check for chapter/section requests
    const chapterMatch = request.match(/chapter\s+(\d+)/i);
    if (chapterMatch && mmdIndex.isLoaded()) {
      const chapterNum = chapterMatch[1];
      const chapters = mmdIndex.findChapter(`Chapter ${chapterNum}`);
      
      if (chapters.length > 0) {
        // Use MMD index to get all chapter occurrences
        const contextParts = chapters.map(ch => ch.context);
        context = contextParts.join('\n\n[... chapter occurrence ...]\n\n');
        enhancedInfo += `\n\nFound Chapter ${chapterNum} at ${chapters.length} location(s) in the document.`;
      }
    }

    // Fallback to pattern matching if index not available
    if (!context) {
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
              let totalChars = 0;
              
              for (const match of matches) {
                const index = markdown.indexOf(match);
                if (index !== -1 && totalChars < maxChars) {
                  const start = Math.max(0, index - 2000);
                  const end = Math.min(markdown.length, index + match.length + 2000);
                  contextParts.push(markdown.substring(start, end));
                  totalChars += context.length;
                }
              }
              
              if (contextParts.length > 0) {
                context = contextParts.join('\n\n[...]\n\n');
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
    const mmdIndex = getMMDIndex();
    const useEnhancedIndex = mmdIndex.isLoaded();
    
    console.log(`Processing request: context size ~${contextSize} tokens, full doc: ${markdown.length} chars, request: "${request}", enhanced index: ${useEnhancedIndex}`);

    // Get document structure info if available
    let structureInfo = "";
    if (useEnhancedIndex) {
      try {
        const structure = mmdIndex.getDocumentStructure();
        if (structure.chapters.length > 0) {
          structureInfo = `\n\nDocument Structure: ${structure.totalPages} pages, ${structure.totalLines} lines, ${structure.chapters.length} chapters/sections detected.`;
        }
      } catch (error) {
        console.warn("Error getting document structure:", error);
        // Continue without structure info
      }
    }

    const context = selectedText
      ? `Edit the following selected text: "${selectedText}"\n\nContext from document:\n${relevantContext}${structureInfo}`
      : `Edit the document. Here's the relevant context:\n${relevantContext}${structureInfo}${markdown.length > 25000 ? '\n\nNote: This is a large document. The context above shows relevant sections. Use the document structure information to locate all occurrences if needed.' : ''}`;

    // Enhanced prompt for better context understanding with MMD index support
    const hasStructureInfo = structureInfo.length > 0;
    const enhancedInstructions = hasStructureInfo
      ? "IMPORTANT INSTRUCTIONS (Enhanced with Document Structure):\n" +
        "1. The document structure information above shows exact locations (pages, lines) of chapters and sections.\n" +
        "2. If the request mentions changing a chapter title, section title, or heading, you MUST find and update ALL occurrences shown in the document structure.\n" +
        "3. Use the page and line number information to ensure you're updating both the table of contents AND the actual chapter/section headers.\n" +
        "4. If multiple occurrences are shown, set replaceAll: true and make sure oldContent matches all of them.\n" +
        "5. Be precise with oldContent - use the exact text as it appears, including any markdown formatting (\\section*, \\title, etc.).\n" +
        "6. Pay attention to the location markers (Page X, Line Y) to understand document structure.\n\n"
      : "IMPORTANT INSTRUCTIONS:\n" +
        "1. If the request mentions changing a chapter title, section title, or heading, you MUST find and update ALL occurrences of that title throughout the document (not just the table of contents).\n" +
        "2. Look for the title in the table of contents AND in the actual chapter/section headers later in the document.\n" +
        "3. If the oldContent matches multiple places, the edit should update all of them. Use a pattern that will match all occurrences.\n" +
        "4. Be precise with the oldContent - use the exact text as it appears, including any markdown formatting.\n\n";

    const prompt =
      'You are a helpful Markdown editor. User request: "' +
      request +
      '".\n\n' +
      context +
      "\n\n" +
      enhancedInstructions +
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
  } catch (error: any) {
    console.error("API Error:", error);
    
    // Provide more specific error messages
    let errorMessage = "Internal server error";
    let statusCode = 500;
    
    if (error instanceof OpenAI.APIError) {
      statusCode = error.status || 500;
      errorMessage = error.message || "OpenAI API error";
      
      if (error.status === 401) {
        errorMessage = "Invalid API key. Please check your OPENAI_API_KEY environment variable.";
      } else if (error.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (error.status === 413 || errorMessage.includes("too long")) {
        errorMessage = "Request too large. Please select a smaller portion of text or use a more specific request.";
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error?.message },
      { status: statusCode }
    );
  }
}
