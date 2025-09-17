/* eslint-disable @typescript-eslint/no-unused-vars */
import { SearchConfig, WebSearchRequest, WebHit, WebSearchToolResult } from './types';
import { SearchCache } from './cache';
import { TavilyProvider } from './providers/tavily';
import { BaseSearchProvider } from './providers/base';

export class WebSearchService {
  private config: SearchConfig;
  private cache: SearchCache;
  private provider: BaseSearchProvider | null = null;

  constructor(config: SearchConfig) {
    this.config = config;
    this.cache = new SearchCache(config.cacheTtl);
    this.initializeProvider();
  }

  private initializeProvider(): void {
    if (this.config.tavilyApiKey) {
      this.provider = new TavilyProvider(this.config.tavilyApiKey, this.config.timeout);
    }
  }

  async search(request: WebSearchRequest): Promise<WebSearchToolResult> {
    const startTime = Date.now();

    // Check cache first
    const cachedResults = this.cache.getCachedResults(
      request.query,
      request.n,
      request.recencyDays,
      request.site
    );

    if (cachedResults) {
      const duration = Date.now() - startTime;
      this.logSearch(request.query, duration, true, cachedResults.length);

      return {
        results: cachedResults,
        query: request.query,
        cached: true,
        count: cachedResults.length
      };
    }

    // If no provider available, return empty results
    if (!this.provider) {
      this.logSearch(request.query, 0, false, 0);
      return {
        results: [],
        query: request.query,
        cached: false,
        count: 0
      };
    }

    try {
      const results = await this.provider.search(request);

      // Cache the results
      this.cache.setCachedResults(
        request.query,
        request.n,
        results,
        request.recencyDays,
        request.site
      );

      const duration = Date.now() - startTime;
      this.logSearch(request.query, duration, false, results.length);

      return {
        results,
        query: request.query,
        cached: false,
        count: results.length
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('Search failed:', error);
      this.logSearch(request.query, duration, false, 0);

      return {
        results: [],
        query: request.query,
        cached: false,
        count: 0
      };
    }
  }

  async searchMultiple(requests: WebSearchRequest[]): Promise<WebSearchToolResult[]> {
    // Limit parallel requests
    const limitedRequests = requests.slice(0, this.config.maxParallelRequests);

    // Execute searches in parallel
    const promises = limitedRequests.map(request => this.search(request));
    return await Promise.all(promises);
  }

  private logSearch(query: string, duration: number, cached: boolean, count: number): void {
    console.log(`[WebSearch] query="${query}" duration=${duration}ms cached=${cached} results=${count}`);
  }

  isEnabled(): boolean {
    return this.provider !== null;
  }
}