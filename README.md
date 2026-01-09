# Learning Chat

A local AI-powered chat interface for learning and Q&A. Built with TypeScript, React, and OpenAI's GPT models.

## Features

- Chat with GPT-5.2 for learning and explanations
- Intelligent UI generation: GPT-4o evaluates responses and GPT-5-mini generates interactive HTML components when helpful
- Streaming responses for real-time feedback
- Session-based conversations (cleared on refresh)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure your `.env` file contains your OpenAI API key:
   ```
   OPENAI_API_KEY=your-key-here
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser

## Scripts

- `npm run dev` - Start development server (frontend + backend)
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run typecheck` - Check TypeScript types

## Architecture

```
src/
├── config/          # Environment & model configuration
├── services/        # Core business logic
│   ├── openai.ts    # OpenAI client wrapper
│   ├── chat.ts      # Chat orchestration
│   ├── ui-evaluator.ts  # GPT-4o UI evaluation
│   └── html-generator.ts # GPT-5-mini HTML generation
├── server/          # Express + SSE streaming
├── types/           # TypeScript interfaces
└── client/          # React frontend
```

## AI Models Used

| Model | Purpose |
|-------|---------|
| GPT-5.2 | Main chat responses (streaming) |
| GPT-4o | Evaluates if visual UI would help |
| GPT-5-mini | Generates interactive HTML |

## How It Works

1. User sends a question
2. GPT-5.2 streams a learning-focused response
3. GPT-4o evaluates if a visual UI would help explain the content
4. If yes, GPT-5-mini generates interactive HTML
5. HTML renders inline in a sandboxed iframe
