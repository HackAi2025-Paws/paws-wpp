import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { WebSearchService } from '../web-search/service';
import { WebSearchArgs, WebSearchRequest } from '../web-search/types';
import { createSearchConfig } from '../web-search/config';

type WebSearchInputType = WebSearchRequest;

export class WebSearchTool implements ToolHandler<WebSearchInputType> {
  name = 'web_search';
  schema = WebSearchArgs as z.ZodType<WebSearchInputType>;

  definition = {
    name: 'web_search',
    description: 'Search the web for fresh or factual information like veterinary care, vaccination schedules, medication recalls, symptom information, or current prices. Use ONLY when you need up-to-date information that you cannot answer from your existing knowledge. Do NOT use for basic pet care knowledge. Do NOT use for finding locations or businesses - use map_search instead.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string' as const,
          description: 'Search query focusing on current/factual information'
        },
        n: {
          type: 'integer' as const,
          minimum: 1,
          maximum: 10,
          default: 5,
          description: 'Number of results to return (1-10)'
        },
        recencyDays: {
          type: 'integer' as const,
          minimum: 1,
          description: 'Only return results from last N days'
        },
        site: {
          type: 'string' as const,
          description: 'Restrict search to specific site (e.g., "veterinary.org")'
        }
      },
      required: ['query'],
      additionalProperties: false
    }
  };

  config = {
    timeout: 15000, // Longer timeout for web requests
    retries: 1, // Limited retries for external API
    retryDelay: 2000
  };

  private searchService: WebSearchService;

  constructor() {
    const searchConfig = createSearchConfig();
    this.searchService = new WebSearchService(searchConfig);
  }

  async execute(input: WebSearchInputType, context: ToolContext): Promise<ToolResult> {
    if (!this.searchService.isEnabled()) {
      return {
        ok: false,
        error: 'Web search is not configured. Please set TAVILY_API_KEY environment variable.'
      };
    }

    try {
      console.log(`[${context.requestId}] Web search: "${input.query}"`);

      const result = await this.searchService.search(input);

      return {
        ok: true,
        data: {
          query: result.query,
          results: result.results,
          cached: result.cached,
          count: result.count
        }
      };

    } catch (error) {
      console.error(`[${context.requestId}] Web search failed:`, error);

      // Return partial failure to allow conversation to continue
      return {
        ok: false,
        error: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}