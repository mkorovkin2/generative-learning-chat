import { quickCompletion } from './openai.js';
import { config } from '../config/index.js';

const GENERATION_PROMPT = `You are an expert at creating simple, interactive HTML components that help explain concepts.

Generate a single, self-contained HTML document that visualizes or makes interactive the concept from the AI response.

If the user explicitly requested specific visuals or visual components in their question, prioritize creating what they asked for.

Requirements:
- Output ONLY valid HTML (no markdown, no code blocks)
- Include all CSS in a <style> tag in the head
- Include all JavaScript in a <script> tag at the end of body
- Keep it simple and focused on clarity
- Use modern CSS (flexbox, grid) for layout
- Use MINIMAL styling - basic colors, adequate spacing, readable fonts. Do NOT over-style or add unnecessary visual flourishes.
- If interactive, ensure it works with vanilla JavaScript
- Maximum ~200 lines of code
- Do not include external dependencies or CDN links
- Use a clean, simple design with a white/light background

The HTML will be rendered in a sandboxed iframe, so:
- No access to parent window
- No external resources
- Must be fully self-contained`;

export async function generateHTML(
  assistantResponse: string,
  suggestedUIType: string | undefined,
  userMessage?: string
): Promise<string> {
  const typeHint = suggestedUIType
    ? `\n\nSuggested UI type: ${suggestedUIType}`
    : '';

  const userContext = userMessage
    ? `\n\nUser's original question:\n${userMessage}`
    : '';

  const response = await quickCompletion(config.models.htmlGeneration, [
    { role: 'system', content: GENERATION_PROMPT },
    {
      role: 'user',
      content: `Create an HTML UI to help explain this response:

${assistantResponse}${typeHint}${userContext}`,
    },
  ]);

  // Clean up response - remove markdown code blocks if present
  let html = response.trim();
  if (html.startsWith('```html')) {
    html = html.slice(7);
  } else if (html.startsWith('```')) {
    html = html.slice(3);
  }
  if (html.endsWith('```')) {
    html = html.slice(0, -3);
  }

  return html.trim();
}
