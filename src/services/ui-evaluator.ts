import { quickCompletion } from './openai.js';
import { config } from '../config/index.js';
import type { UIEvaluationResult } from '../types/index.js';

const EVALUATION_PROMPT = `You are an assistant that evaluates whether a visual UI component would help explain an AI response to a user.

Analyze the following AI response and determine if a visual UI accompaniment would be helpful.

Consider generating a UI when:
- The response contains a lot of text that could be better organized visually
- The response explains a concept that would benefit from visualization (diagrams, flowcharts)
- The response includes step-by-step instructions (interactive checklist)
- The response contains data, lists, or comparisons (tables, charts)
- The response explains code or algorithms (visual representation)
- The response teaches a concept that would benefit from an interactive example

Do NOT generate a UI for:
- Simple, short answers
- Direct factual responses
- Responses that are already concise and clear
- Conversational/casual exchanges

Respond in JSON format:
{
  "shouldGenerateUI": true/false,
  "reason": "Brief explanation of your decision",
  "suggestedUIType": "One of: checklist, diagram, table, interactive-demo, visualization, code-playground, or null if no UI"
}`;

export async function evaluateForUI(
  assistantResponse: string
): Promise<UIEvaluationResult> {
  try {
    const response = await quickCompletion(config.models.evaluation, [
      { role: 'system', content: EVALUATION_PROMPT },
      { role: 'user', content: `AI Response to evaluate:\n\n${assistantResponse}` },
    ]);

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { shouldGenerateUI: false, reason: 'Failed to parse evaluation' };
    }

    const result = JSON.parse(jsonMatch[0]) as UIEvaluationResult;
    return result;
  } catch (error) {
    console.error('UI evaluation error:', error);
    return { shouldGenerateUI: false, reason: 'Evaluation failed' };
  }
}
