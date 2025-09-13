import { SearchConfig } from './types';

export function createSearchConfig(): SearchConfig {
  return {
    tavilyApiKey: process.env.TAVILY_API_KEY,
    maxResults: parseInt(process.env.WEB_SEARCH_MAX_RESULTS || '5', 10),
    maxParallelRequests: parseInt(process.env.WEB_SEARCH_MAX_PARALLEL || '3', 10),
    timeout: parseInt(process.env.WEB_SEARCH_TIMEOUT || '1500', 10),
    cacheTtl: parseInt(process.env.WEB_SEARCH_CACHE_TTL || '300000', 10), // 5 minutes
    maxToolRounds: parseInt(process.env.WEB_SEARCH_MAX_ROUNDS || '3', 10)
  };
}