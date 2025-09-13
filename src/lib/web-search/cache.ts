import { WebHit, CacheEntry } from './types';

export class SearchCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(ttlMs = 5 * 60 * 1000) { // 5 minutes default
    this.ttl = ttlMs;
  }

  get(key: string): WebHit[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.results;
  }

  set(key: string, results: WebHit[]): void {
    this.cache.set(key, {
      results,
      timestamp: Date.now()
    });
  }

  private generateKey(query: string, n: number, recencyDays?: number, site?: string): string {
    const parts = [query, n.toString()];
    if (recencyDays) parts.push(`recency:${recencyDays}`);
    if (site) parts.push(`site:${site}`);
    return parts.join('|');
  }

  getCachedResults(query: string, n: number, recencyDays?: number, site?: string): WebHit[] | null {
    const key = this.generateKey(query, n, recencyDays, site);
    return this.get(key);
  }

  setCachedResults(query: string, n: number, results: WebHit[], recencyDays?: number, site?: string): void {
    const key = this.generateKey(query, n, recencyDays, site);
    this.set(key, results);
  }

  clear(): void {
    this.cache.clear();
  }
}