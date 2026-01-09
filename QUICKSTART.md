# Quickstart Guide

Get up and running with Learning Chat in minutes.

## Installation

```bash
# Install dependencies
npm install

# Create .env file with your OpenAI API key
echo "OPENAI_API_KEY=your-api-key-here" > .env

# Start the development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Use Cases

### 1. Learning Complex Topics

Ask about any subject and receive explanations with auto-generated visualizations.

**Example prompts:**
- "Explain how TCP/IP networking works"
- "What is the difference between SQL and NoSQL databases?"
- "How does machine learning training work?"

The AI will provide a detailed explanation and automatically generate diagrams, charts, or interactive components when they would help understanding.

### 2. Step-by-Step Procedures

Learn processes with auto-generated checklists and workflows.

**Example prompts:**
- "How do I set up a React project from scratch?"
- "Walk me through deploying an app to AWS"
- "What are the steps to debug a memory leak?"

You'll receive procedural guidance with interactive checklists you can follow along with.

### 3. Algorithm and Code Understanding

Explore algorithms with visual representations and code examples.

**Example prompts:**
- "Explain how quicksort works with an example"
- "Show me how binary search trees work"
- "How does the A* pathfinding algorithm work?"

The AI generates interactive demos and code playgrounds to illustrate concepts.

### 4. Data and Statistics

Understand numbers with auto-generated tables and charts.

**Example prompts:**
- "Compare the time complexity of common sorting algorithms"
- "What are the key metrics to track for a SaaS business?"
- "Explain the normal distribution with examples"

Data-heavy responses include visual tables and charts for clarity.

### 5. Contextual Follow-ups

Highlight any text in a response to ask targeted questions.

1. Select text in any AI response
2. Click the popup icon that appears
3. Ask a follow-up question about just that highlighted content

This opens a branch chat that focuses on your specific selection without losing context from the main conversation.

## Tips

- **Let visualizations generate** - The AI decides when visuals help. Wait for them to appear after the text response completes.
- **Use selection for deep dives** - Highlight terms or concepts you want to explore further.
- **Clear chat when switching topics** - Click the clear button to start fresh for new subjects.
- **Fullscreen visualizations** - Click the expand button on any visualization to see it in full screen.

## Available Commands

```bash
npm run dev        # Development mode with hot reload
npm run build      # Build for production
npm start          # Run production build
npm run typecheck  # Check TypeScript types
```
