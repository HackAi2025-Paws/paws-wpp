import { NextRequest, NextResponse } from 'next/server'
import { getSessionStore } from '@/lib/session-store'

export async function GET() {
  try {
    const sessionStore = getSessionStore()

    // Check Redis connectivity
    await sessionStore.connect()
    const isRedisHealthy = await sessionStore.isHealthy()

    // Check environment variables
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
    const hasRedisUrl = !!process.env.REDIS_URL
    const hasDatabase = !!process.env.DATABASE_URL
    const hasTwilio = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN

    const health = {
      status: isRedisHealthy && hasAnthropicKey && hasDatabase ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          status: isRedisHealthy ? 'up' : 'down',
          configured: hasRedisUrl
        },
        anthropic: {
          configured: hasAnthropicKey
        },
        database: {
          configured: hasDatabase
        },
        twilio: {
          configured: hasTwilio
        }
      }
    }

    const statusCode = health.status === 'healthy' ? 200 : 503
    return NextResponse.json(health, { status: statusCode })

  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 503 })
  }
}

// Debug endpoint to sample a session (only in development)
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    const sessionStore = getSessionStore()
    await sessionStore.connect()

    const session = await sessionStore.load(phone)

    return NextResponse.json({
      phone: phone,
      session: session ? {
        status: session.status,
        messageCount: session.messages.length,
        updatedAt: new Date(session.updatedAt).toISOString(),
        messages: session.messages.map(msg => ({
          role: msg.role,
          type: msg.role === 'assistant' && 'content' in msg ?
            msg.content.map(c => c.type).join(',') :
            'content' in msg ? 'text' : 'tool'
        }))
      } : null
    })

  } catch (error) {
    console.error('Debug session failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}