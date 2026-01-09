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
    chat: 'gpt-4o',           // Main chat responses
    evaluation: 'gpt-4o-mini', // Fast evaluation for UI decision
    htmlGeneration: 'gpt-4o-mini', // HTML generation
  },
} as const;

// Validate required config
if (!config.openai.apiKey) {
  throw new Error('OPENAI_API_KEY is required in .env file');
}
