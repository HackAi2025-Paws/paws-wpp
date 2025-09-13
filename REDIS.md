# Redis Setup for Session Management

This project uses Redis to store WhatsApp conversation sessions with automatic TTL expiry.

## Quick Start

### 1. Start Redis
```bash
# Start Redis in background
npm run redis:up

# Check logs
npm run redis:logs
```

### 2. Verify Connection
```bash
# Test the session system
npm run test:session

# Check health endpoint
curl http://localhost:3000/api/health
```

### 3. Development with GUI (Optional)
```bash
# Start Redis + Redis Commander web interface
npm run redis:dev

# Access GUI at: http://localhost:8081
# Login: admin / admin123
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run redis:up` | Start Redis container |
| `npm run redis:down` | Stop Redis container |
| `npm run redis:logs` | View Redis logs |
| `npm run redis:dev` | Start Redis + GUI |
| `npm run redis:reset` | Reset Redis data |
| `npm run test:session` | Test session flow |

## Configuration

Redis runs on the default port `6379` and data persists in a Docker volume.

**Settings:**
- **Memory**: 256MB limit with LRU eviction
- **Persistence**: AOF (Append Only File) enabled
- **TTL**: Sessions auto-expire after 6 hours
- **Health Check**: Built-in ping every 10s

## Session Data Structure

Sessions are stored as:
```
Key: wh:session:+1234567890
TTL: 6 hours
Value: {
  "status": "active",
  "messages": [
    { "role": "user", "content": "Hola" },
    { "role": "assistant", "content": [...] }
  ],
  "updatedAt": 1704067200000
}
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Debug Session (dev only)
```bash
curl -X POST http://localhost:3000/api/health \
  -H "Content-Type: application/json" \
  -d '{"phone":"+1234567890"}'
```

### Redis Commands
```bash
# Connect to Redis CLI
docker exec -it paws-wpp-redis redis-cli

# List all session keys
KEYS wh:session:*

# Get session data
GET wh:session:+1234567890

# Check TTL
TTL wh:session:+1234567890
```

## Troubleshooting

### Redis Won't Start
```bash
# Check if port 6379 is in use
netstat -an | findstr 6379

# Force restart
npm run redis:reset
```

### Connection Errors
1. Verify Redis is running: `npm run redis:logs`
2. Check `.env` has: `REDIS_URL=redis://localhost:6379`
3. Test health endpoint: `curl http://localhost:3000/api/health`

### Memory Issues
```bash
# Check Redis memory usage
docker exec -it paws-wpp-redis redis-cli INFO memory

# Clear all session data
docker exec -it paws-wpp-redis redis-cli FLUSHDB
```

## Production Notes

- Use Redis Cluster for high availability
- Monitor memory usage and adjust `maxmemory`
- Set up Redis backup/persistence
- Use Redis AUTH in production
- Consider Redis Sentinel for failover