import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'development' ? 'tu_clave_secreta_por_defecto' : undefined);

export interface JWTPayload {
  sub: string;
  name?: string;
  phone?: string;
  iat: number;
  exp: number;
}

export function withAuth(
  handler: (req: NextRequest, token: JWTPayload) => Promise<NextResponse>
) {
  return async function (req: NextRequest): Promise<NextResponse> {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'No se proporcionó token de autenticación' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

        return await handler(req, decoded);
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
    } catch (error) {
      console.error('Error en middleware de autenticación:', error);
      return NextResponse.json(
        { error: 'Error en la autenticación' },
        { status: 500 }
      );
    }
  };
}