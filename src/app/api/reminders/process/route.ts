import { NextRequest, NextResponse } from 'next/server';
import { processReminders } from '@/services/reminderService';
import { withAuth } from '@/middleware/auth-middleware';

export const GET = withAuth(async (req: NextRequest) => {
  try {
    await processReminders();
    return NextResponse.json({ success: true, message: 'Recordatorios procesados correctamente' });
  } catch (error) {
    console.error('Error procesando recordatorios:', error);
    return NextResponse.json(
      { error: 'Error al procesar recordatorios' },
      { status: 500 }
    );
  }
});
