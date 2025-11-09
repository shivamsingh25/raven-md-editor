# Raven MD Editor

This is a document editor that uses AI to help you edit markdown files. Here's how it works:

1. **View Your Document**: The left side shows your markdown document with proper formatting (including math equations)
2. **Chat with AI**: The right side is a chat panel where you can ask the AI to make changes
3. **Select and Edit**: Double-click any text in the document to automatically suggest edits for that section
4. **Review Changes**: The AI shows you exactly what will change with a diff viewer (like GitHub)
5. **Accept or Discard**: You can accept the changes or discard them - you're in control

## Features

- ✅ Edit large markdown files efficiently
- ✅ MMD Support
- ✅ Smart text selection - double-click to edit sections
- ✅ Visual diff viewer to see changes before applying
- ✅ Undo/Redo support
- ✅ Real-time streaming AI responses (Not supported in Amplify Hosting) 

## Setup Instructions

### Step 1: Install Dependencies

Open your terminal/command prompt and navigate to the project folder, then run:

```bash
npm install
```

This will install all the required packages. Wait for it to finish (might take 2-3 minutes).

### Step 2: Set Up Environment Variables

1. Create a file named `.env.local` in the root folder (same level as `package.json`)
2. Add this line to the file:

```
OPENAI_API_KEY=sk-your-api-key-here
```

Replace `sk-your-api-key-here` with your actual API key.


### Step 3: Run the Development Server

In the terminal, run:

```bash
npm run dev
```

### Step 4: Open in Browser

Open your browser and go to:

```
http://localhost:3000
```

## How to Use

### Basic Editing

1. **Load a Document**: The app automatically loads `public/manual.mmd` on startup
2. **Select Text**: Click and drag to select text, or double-click a paragraph
3. **Ask for Changes**: Type in the chat panel like "Make this section clearer" or "Fix grammar"
4. **Review**: The AI will show you what it wants to change
5. **Accept or Discard**: Click "Accept Changes" to apply or "Discard" to ignore

### Double-Click Feature

Double-click any text in the document to:
- Automatically select that section
- Pre-fill the chat input with a suggestion
- Start editing immediately

### Undo/Redo

Use the undo/redo buttons in the top toolbar to go back or forward through your changes.

## Project Structure

```
src/app/
├── components/          # UI components
│   ├── ChatPanel.tsx    # Right side chat interface
│   ├── ChatMessage.tsx  # Individual chat message
│   ├── ChatInput.tsx    # Input field for chat
│   ├── DocumentViewer.tsx # Left side document viewer
│   ├── EditProposal.tsx # Diff viewer for proposals
│   ├── Header.tsx       # Top toolbar
│   └── ThemeRegistry.tsx # MUI theme setup
├── hooks/               # Custom React hooks
│   ├── useChat.ts       # Chat logic and API calls
│   └── useDocumentSelection.ts # Text selection logic
├── store/               # State management
│   └── useMarkdownStore.ts # Zustand store for markdown
├── api/                 # Backend API routes
│   └── edit/           # AI edit endpoint
├── types/               # TypeScript types
└── page.tsx            # Main page component
```

## Building for Production

To create a production build:

```bash
npm run build
```

Then start the production server:

```bash
npm start
```

## Stack

- **Next.js 16** - React framework
- **React** - UI library
- **Material-UI (MUI)** - Component library
- **Zustand** - State management
- **Mathpix Markdown** - Math rendering
- **react-window** - Virtual scrolling for large files
- **OpenAI API** - AI editing
