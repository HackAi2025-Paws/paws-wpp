import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_por_defecto';

// Rutas que NO requieren autenticación (públicas)
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/otp',
  '/api/health',
  '/api/webhook/whatsapp',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Se requiere autenticación' },
      { status: 401 }
    );
  }

  const token = authHeader.substring(7);

  try {
    jwt.verify(token, JWT_SECRET);
    return NextResponse.next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return NextResponse.json(
        { error: 'Token expirado' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Token inválido' },
      { status: 401 }
    );
  }
}
export const config = {
  matcher: ['/api/:path*'],
};