import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/database';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeResponse {
  content: Anthropic.ContentBlock[];
  tokens: number;
  cost: number;
}

// Pricing for claude-haiku-4-5-20251001 (approximate)
const INPUT_COST_PER_TOKEN = 0.00000025; // $0.25 per 1M tokens
const OUTPUT_COST_PER_TOKEN = 0.00000125; // $1.25 per 1M tokens

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  tools?: Anthropic.Tool[]
): Promise<ClaudeResponse> {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  if (tools && tools.length > 0) {
    params.tools = tools;
    params.tool_choice = { type: 'auto' };
  }

  const response = await client.messages.create(params);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const totalTokens = inputTokens + outputTokens;
  const cost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

  // Log to agent_logs
  const outputSummary = response.content
    .map((block) => {
      if (block.type === 'text') return block.text.slice(0, 200);
      if (block.type === 'tool_use') return `tool_use: ${block.name}`;
      return '';
    })
    .join(' | ');

  db.prepare(
    `INSERT INTO agent_logs (agent_type, input_summary, output_summary, tokens_used, cost_usd)
     VALUES (?, ?, ?, ?, ?)`
  ).run('claude-haiku', userMessage.slice(0, 300), outputSummary, totalTokens, cost);

  return {
    content: response.content,
    tokens: totalTokens,
    cost,
  };
}

export function extractJsonFromResponse(content: Anthropic.ContentBlock[]): Record<string, unknown> | null {
  for (const block of content) {
    if (block.type === 'tool_use') {
      return block.input as Record<string, unknown>;
    }
    if (block.type === 'text') {
      // Try to parse JSON from text
      const jsonMatch = block.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                        block.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch {
          // continue
        }
      }
    }
  }
  return null;
}
