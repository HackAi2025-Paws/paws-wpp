import { BaseSearchProvider } from './base';
import { WebSearchRequest, WebHit } from '../types';

interface TavilyResponse {
  results: Array<{
    title: string;
    url: string;
    content: string;
    published_date?: string;
    score?: number;
  }>;
}

export class TavilyProvider extends BaseSearchProvider {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';

  constructor(apiKey: string, timeout = 1500) {
    super(timeout);
    this.apiKey = apiKey;
  }

  async search(request: WebSearchRequest): Promise<WebHit[]> {
    try {
      const body = this.buildRequestBody(request);

      const response = await this.withTimeout(
        fetch(`${this.baseUrl}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(body)
        })
      );

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
      }

      const data: TavilyResponse = await response.json();
      const mappedResults = this.mapResults(data);

      return this.deduplicateResults(mappedResults);
    } catch (error) {
      console.error('Tavily search error:', error);
      // Return empty array on error to allow partial results from other providers
      return [];
    }
  }

  private buildRequestBody(request: WebSearchRequest) {
    const body: Record<string, any> = {
      query: request.query,
      max_results: request.n,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
      format_response: true
    };

    // Add site filter if specified
    if (request.site) {
      body.query = `site:${request.site} ${request.query}`;
    }

    // Add recency filter if specified
    if (request.recencyDays) {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - request.recencyDays);
      body.published_after = fromDate.toISOString().split('T')[0];
    }

    return body;
  }

  private mapResults(data: TavilyResponse): WebHit[] {
    return data.results.map(result => ({
      title: result.title,
      url: result.url,
      snippet: result.content,
      published: result.published_date,
      score: result.score
    }));
  }
}