import dotenv from 'dotenv';

dotenv.config();

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  models: {
    chat: 'gpt-5.2',          // Main chat responses
    evaluation: 'gpt-5-mini', // Fast evaluation for UI decision
    htmlGeneration: 'gpt-5-mini', // HTML generation
  },
} as const;

// Validate required config
if (!config.openai.apiKey) {
  throw new Error('OPENAI_API_KEY is required in .env file');
}
