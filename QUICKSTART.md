# 🚀 Quick Start Guide

Get the Paws WhatsApp bot running in seconds with these one-command setups.

## 🎯 One-Command Setup

### Quick Start (Normal)
```bash
npm run dev:full
```
**What it does:**
- ✅ Starts Redis container
- ✅ Generates Prisma client
- ✅ Starts development server
- ⚡ Ready in ~30 seconds

### Fresh Start (Full Reset)
```bash
npm run dev:fresh
```
**What it does:**
- ✅ Resets Redis (clears all sessions)
- ✅ Pushes database schema
- ✅ Generates Prisma client
- ✅ Starts development server
- ⚡ Clean slate in ~45 seconds

### Setup Only (No Server Start)
```bash
npm run setup        # Quick setup
npm run setup:fresh  # Fresh setup
```

## 🔧 Manual Control Commands

| Command | Description |
|---------|-------------|
| `npm run dev:full` | **Complete setup + start server** |
| `npm run dev:fresh` | **Full reset + start server** |
| `npm run setup` | Setup services only |
| `npm run setup:fresh` | Reset & setup services only |
| `npm run redis:up` | Start Redis only |
| `npm run redis:dev` | Redis + web GUI |
| `npm run test:session` | Test session system |

## 📋 What You Get

After running `npm run dev:full`:

- **🗄️ Database**: PostgreSQL with pet/user tables
- **🔄 Redis**: Session management with 6h TTL
- **🤖 WhatsApp Bot**: Claude-powered conversation AI
- **📱 Twilio Integration**: Ready for WhatsApp webhooks
- **🔍 Health Monitoring**: `/api/health` endpoint
- **🐛 Debug Tools**: Session inspection & logging

## ⚙️ Advanced Options

```bash
# Get help
node scripts/setup.mjs --help

# Verbose logging
node scripts/setup.mjs --fresh --verbose

# Setup without starting server
node scripts/setup.mjs --no-start
```

## 🛠️ Troubleshooting

### Common Issues

**Docker not running?**
```bash
# Start Docker Desktop, then:
npm run dev:fresh
```

**Port conflicts?**
```bash
# Stop existing services
npm run redis:down
# Then restart
npm run dev:fresh
```

**Database issues?**
```bash
# Reset everything
npm run setup:fresh
```

### Health Check
```bash
# Test all systems
curl http://localhost:3000/api/health

# Test session system
npm run test:session
```

## 🌐 Production Checklist

Before going live:

1. **Environment Variables**
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...     # ✅ Set
   REDIS_URL=redis://prod-host      # ✅ Production Redis
   DATABASE_URL=postgresql://...    # ✅ Production DB
   TWILIO_ACCOUNT_SID=AC...         # ✅ Set
   GOOGLE_PLACES_API_KEY=AI...      # ✅ Optional: For map search
   TAVILY_API_KEY=tvly-...          # ✅ Optional: For web search
   ```

2. **Redis Configuration**
   - Use Redis Cluster for HA
   - Enable Redis AUTH
   - Set up backup/monitoring

3. **Deployment**
   ```bash
   npm run build  # Build for production
   npm start      # Start production server
   ```

---

**🎉 That's it! Your WhatsApp AI assistant is ready to go.**

Test it by sending a WhatsApp message to your Twilio number: