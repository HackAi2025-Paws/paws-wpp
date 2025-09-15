import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// Base tool result interface
export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

// Tool execution context
export interface ToolContext {
  requestId: string;
  userPhone: string;
  messageId?: string;
}

// Tool configuration
export interface ToolConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// Tool handler interface
export interface ToolHandler<T = any> {
  name: string;
  schema: z.ZodSchema<T>;
  definition: Anthropic.Tool;
  config?: ToolConfig;
  execute(input: T, context: ToolContext): Promise<ToolResult>;
}

// Default tool configuration
export const DEFAULT_TOOL_CONFIG: Required<ToolConfig> = {
  timeout: 10000, // 10 seconds
  retries: 2,
  retryDelay: 1000 // 1 second
};