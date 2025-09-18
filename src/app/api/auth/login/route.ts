import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/auth-service';
import jwt from 'jsonwebtoken';
import { configDotenv } from 'dotenv';
import {JWTPayload} from "@/middleware/auth-middleware";

configDotenv();

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'development') return 'tu_clave_secreta_por_defecto';
  throw new Error('JWT_SECRET environment variable must be set in production');
})();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export async function POST(request: NextRequest) {
  try {
    const { phone, token } = await request.json();

    if (!phone || !token) {
      return NextResponse.json({ error: 'Teléfono y token son requeridos' }, { status: 400 });
    }

    const result = await authService.verifyOTPAndLogin(phone, token);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    const jwtPayload: JWTPayload = {
      sub: result.user.id,
      name: result.user.name,
      phone: result.user.phone
    };

    const accessToken = jwt.sign(jwtPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN as unknown as number
    });

    return NextResponse.json({
      success: true,
      accessToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        phone: result.user.phone
      }
    });
  } catch (error) {
    console.error('Error al procesar login:', error);
    return NextResponse.json({
      error: 'Error procesando la solicitud'
    }, { status: 500 });
  }
}