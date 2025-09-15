import { WebSearchRequest, WebHit } from '../types';

export abstract class BaseSearchProvider {
  protected timeout: number;

  constructor(timeout = 1500) {
    this.timeout = timeout;
  }

  abstract search(request: WebSearchRequest): Promise<WebHit[]>;

  protected async withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
    const timeout = timeoutMs || this.timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), timeout);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  protected deduplicateResults(results: WebHit[]): WebHit[] {
    const seen = new Set<string>();
    return results.filter(hit => {
      if (seen.has(hit.url)) {
        return false;
      }
      seen.add(hit.url);
      return true;
    });
  }
}