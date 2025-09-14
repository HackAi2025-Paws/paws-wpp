import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';

const AskUserArgs = z.object({
  message: z.string().min(1, 'Message is required')
});

type AskUserInputType = z.infer<typeof AskUserArgs>;

export class AskUserTool implements ToolHandler<AskUserInputType> {
  name = 'ask_user';
  schema = AskUserArgs;

  definition = {
    name: 'ask_user',
    description: 'Ask the user for missing information or clarification.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' as const, description: 'Clarification question in Spanish' }
      },
      required: ['message'],
      additionalProperties: false
    }
  };

  config = {
    timeout: 1000, // Fast operation
    retries: 0, // No retries needed for user questions
    retryDelay: 0
  };

  async execute(input: AskUserInputType, context: ToolContext): Promise<ToolResult> {
    console.log(`[${context.requestId}] Asking user: ${input.message}`);

    // This tool is always successful and idempotent
    return {
      ok: true,
      data: { message: input.message }
    };
  }
}