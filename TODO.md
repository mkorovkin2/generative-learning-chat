# TODO - Key Improvements

## Persistent Chat

**Current state:** Chat history is stored in-memory and lost on page refresh or server restart.

**Improvement:** Persist conversations to a database or local storage so users can:
- Resume previous conversations
- Access chat history across sessions
- Export/import conversation data

**Implementation options:**
- localStorage for client-side persistence
- SQLite/PostgreSQL for server-side storage
- IndexedDB for larger client-side datasets

---

## Cancel Chat Mid-Conversation

**Current state:** Once a message is sent, the user must wait for the full response to complete.

**Improvement:** Add ability to cancel an in-progress response:
- Stop button that appears during streaming
- Abort the SSE connection cleanly
- Save partial response or discard entirely

**Implementation:**
- Use AbortController for fetch requests
- Add server-side handling to stop generation
- UI state management for cancel/resume

---

## Customizable Visualizations

**Current state:** The AI automatically decides visualization type and style.

**Improvement:** Give users control over generated visualizations:
- Choose preferred visualization types (charts, diagrams, tables, etc.)
- Select color schemes or themes
- Adjust complexity level (simple vs detailed)
- Edit generated visualizations inline
- Save visualization preferences

**Implementation:**
- User preferences stored in settings
- Pass preferences to HTML generator prompt
- Visualization editor component

---

## Parallel Generation of Visualizations

**Current state:** Visualizations generate sequentially after the text response completes.

**Improvement:** Generate visualizations in parallel with the text response:
- Start visualization evaluation as soon as enough context exists
- Stream text and visualization generation simultaneously
- Show visualization placeholder while generating
- Reduce total response time

**Implementation:**
- Split streaming into parallel pipelines
- Evaluate visualization need from initial context
- Progressive rendering of both text and visuals
- Handle race conditions and partial data
