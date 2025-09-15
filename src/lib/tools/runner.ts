import { ToolHandler, ToolContext, ToolResult, DEFAULT_TOOL_CONFIG } from './types';

export class ToolRunner {
  private idempotencyCache = new Map<string, ToolResult>();

  async execute<T>(
    handler: ToolHandler<T>,
    input: unknown,
    context: ToolContext
  ): Promise<ToolResult> {
    const config = { ...DEFAULT_TOOL_CONFIG, ...handler.config };

    // Generate idempotency key
    const idempotencyKey = this.generateIdempotencyKey(handler.name, input, context);

    // Check idempotency cache
    if (this.idempotencyCache.has(idempotencyKey)) {
      const cachedResult = this.idempotencyCache.get(idempotencyKey)!;
      console.log(`[${context.requestId}] Tool ${handler.name} returned cached result`);
      return cachedResult;
    }

    // Validate input
    let validatedInput: T;
    try {
      validatedInput = handler.schema.parse(input);
    } catch (error) {
      const result = {
        ok: false,
        error: `Invalid input for tool ${handler.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      this.idempotencyCache.set(idempotencyKey, result);
      return result;
    }

    // Execute with timeout and retries
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        console.log(`[${context.requestId}] Executing tool ${handler.name} (attempt ${attempt + 1}/${config.retries + 1})`);

        const result = await this.withTimeout(
          handler.execute(validatedInput, context),
          config.timeout
        );

        // Cache successful result
        this.idempotencyCache.set(idempotencyKey, result);

        // Clean up old cache entries (simple LRU)
        if (this.idempotencyCache.size > 100) {
          const firstKey = this.idempotencyCache.keys().next().value;
          if (firstKey) {
            this.idempotencyCache.delete(firstKey);
          }
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`[${context.requestId}] Tool ${handler.name} failed (attempt ${attempt + 1}):`, lastError.message);

        // Don't retry on last attempt
        if (attempt < config.retries) {
          await this.delay(config.retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    // All attempts failed
    const result = {
      ok: false,
      error: `Tool ${handler.name} failed after ${config.retries + 1} attempts: ${lastError?.message || 'Unknown error'}`
    };

    this.idempotencyCache.set(idempotencyKey, result);
    return result;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateIdempotencyKey(toolName: string, input: unknown, context: ToolContext): string {
    // Create a stable key based on tool name, input, and context
    const inputHash = JSON.stringify(input, input && typeof input === 'object' ? Object.keys(input).sort() : undefined);
    const messageKey = context.messageId || 'no-msg-id';
    return `${toolName}:${context.userPhone}:${messageKey}:${Buffer.from(inputHash || 'null').toString('base64').slice(0, 16)}`;
  }

  clearCache(): void {
    this.idempotencyCache.clear();
  }

  getCacheSize(): number {
    return this.idempotencyCache.size;
  }
}