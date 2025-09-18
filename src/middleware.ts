import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'development') return 'tu_clave_secreta_por_defecto';
  throw new Error('JWT_SECRET environment variable must be set in production');
})();

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/otp',
  '/api/health',
  '/api/webhook/whatsapp',
];

function createCorsResponse(response: NextResponse, request: NextRequest) {
  const origin = request.headers.get('origin');

  // Allow all localhost origins
  if (origin && origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    return createCorsResponse(response, request);
  }

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    const response = NextResponse.next();
    return createCorsResponse(response, request);
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const response = NextResponse.json(
      { error: 'Se requiere autenticación' },
      { status: 401 }
    );
    return createCorsResponse(response, request);
  }

  const token = authHeader.substring(7);

  try {
    jwt.verify(token, JWT_SECRET);
    const response = NextResponse.next();
    return createCorsResponse(response, request);
  } catch (error) {
    console.error('[middleware]', { error });
    if (error instanceof jwt.TokenExpiredError) {
      const response = NextResponse.json(
        { error: 'Token expirado' },
        { status: 401 }
      );
      return createCorsResponse(response, request);
    }
    const response = NextResponse.json(
      { error: 'Token inválido' },
      { status: 401 }
    );
    return createCorsResponse(response, request);
  }
}
export const config = {
  matcher: ['/api/:path*'],
  runtime: 'nodejs',
};