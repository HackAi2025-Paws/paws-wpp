# Web Search Module

Web search capabilities for Claude API integration, optimized for veterinary information.

## Setup

Add to your `.env`:
```bash
TAVILY_API_KEY=your_tavily_api_key
```

## Usage

### Integrated Agent Loop
```typescript
import { getAgentLoop } from '../agent-loop';

const agentLoop = getAgentLoop();
const response = await agentLoop.execute(userPhone, 'What vaccines does a puppy need?');

console.log(response); // Final WhatsApp response with search results integrated
```

The agent automatically uses web search when appropriate and integrates results into the final response.

### Direct Search
```typescript
import { WebSearchService } from './service';
import { createSearchConfig } from './config';

const searchService = new WebSearchService(createSearchConfig());
const result = await searchService.search({
  query: 'dog vaccination schedule 2025',
  n: 5,
  recencyDays: 30
});
```

## When Search is Used

Claude automatically searches for:
- **Fresh Info**: Vaccination schedules, drug recalls, disease outbreaks
- **Niche Data**: Specific medications, IoT compatibility, pricing
- **Recent Changes**: New treatments, regulatory updates

Claude **avoids** searching for stable knowledge like basic pet care, anatomy, or training tips.

## Configuration

Optional environment variables:
```bash
WEB_SEARCH_MAX_RESULTS=5        # Results per search (1-10)
WEB_SEARCH_MAX_PARALLEL=3       # Concurrent searches
WEB_SEARCH_TIMEOUT=1500         # Timeout (ms)
WEB_SEARCH_CACHE_TTL=300000     # Cache TTL (5 min)
WEB_SEARCH_MAX_ROUNDS=3         # Tool conversation rounds
```

## Important Characteristics

**Performance:**
- ~200-400ms search latency
- 5-minute in-memory cache
- Up to 3 parallel searches per turn
- 20-40% cache hit rate expected

**Reliability:**
- 1.5s timeout protection
- Graceful degradation on errors
- URL deduplication
- Empty results on failure (no crashes)

## Limitations

- **Tavily Only**: Currently supports Tavily API only
- **Memory Cache**: Cache doesn't persist across restarts
- **Rate Limits**: Subject to Tavily's rate limiting
- **Language**: Optimized for Spanish queries
- **Tool Rounds**: Max 3 conversation rounds to prevent loops
- **No Auth**: Search queries not tied to user authentication