import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/lib/auth/auth-service';

export async function POST(request: NextRequest) {
  try {
    const { name, phone } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({
        error: 'Nombre y teléfono son requeridos'
      }, { status: 400 });
    }

    const result = await authService.registerVeterinarian({
      name,
      phone
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error
      }, { status: result.statusCode || 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Veterinario registrado correctamente. Se ha enviado un código de verificación.',
      user: result.user,
      otp: result.otp // Solo en desarrollo
    });

  } catch (error) {
    console.error('Error al registrar veterinario:', error);
    return NextResponse.json({
      error: 'Error procesando la solicitud'
    }, { status: 500 });
  }
}