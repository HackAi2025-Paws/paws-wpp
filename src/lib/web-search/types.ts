import { z } from 'zod';

// Web search tool schema
export const WebSearchArgs = z.object({
  query: z.string().min(1, 'Query is required'),
  n: z.number().int().min(1).max(10).default(5),
  recencyDays: z.number().int().positive().optional(),
  site: z.string().optional()
});

export type WebSearchRequest = z.infer<typeof WebSearchArgs>;

// Web search result format
export interface WebHit {
  title: string;
  url: string;
  snippet: string;
  published?: string; // ISO date string
  score?: number;
}

// Search provider abstraction
export interface SearchProvider {
  search(request: WebSearchRequest): Promise<WebHit[]>;
}

// Configuration
export interface SearchConfig {
  tavilyApiKey?: string;
  maxResults: number;
  maxParallelRequests: number;
  timeout: number;
  cacheTtl: number;
  maxToolRounds: number;
}

// Cache entry
export interface CacheEntry {
  results: WebHit[];
  timestamp: number;
}

// Tool result for Claude
export interface WebSearchToolResult {
  results: WebHit[];
  query: string;
  cached: boolean;
  count: number;
}