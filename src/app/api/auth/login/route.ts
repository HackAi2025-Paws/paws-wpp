import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/auth-service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_por_defecto';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export async function POST(request: NextRequest) {
  try {
    const { phone, token } = await request.json();

    if (!phone || !token) {
      return NextResponse.json({ error: 'Teléfono y token son requeridos' }, { status: 400 });
    }

    try {

      const result = await authService.verifyOTPAndLogin(phone, token);

      const jwtPayload = {
        sub: result.user.id,
        name: result.user.name,
        phone: result.user.phone
      };

      const accessToken = jwt.sign(jwtPayload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
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
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Error de autenticación'
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Error al procesar login:', error);
    return NextResponse.json({
      error: 'Error procesando la solicitud'
    }, { status: 500 });
  }
}