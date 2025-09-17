import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/auth-service';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json({ error: 'El número de teléfono es requerido' }, { status: 400 });
    }

    const result = await authService.generateOTP(phone);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'OTP generado correctamente',
      ...(result.otp && process.env.NODE_ENV === 'development' ? { otp: result.otp } : {})
    });
  } catch (error) {
    console.error('Error al procesar solicitud OTP:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}