import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth-middleware';

export const GET = withAuth(async (req: NextRequest, token) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = parseInt(token.sub);
    const pendingId = searchParams.get('pendingId');
    const upcoming = searchParams.get('upcoming') === 'true';
    const sent = searchParams.get('sent') === 'true';

    const where: any = {};
    if (pendingId) {
      where.pendingId = parseInt(pendingId);
    } else {
      where.pending = {
        userId
      };
    }

    if (upcoming) {
      where.scheduledFor = {
        gt: new Date()
      };
      where.sent = false;
    } else if (sent !== undefined) {
      where.sent = sent;
    }

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        pending: {
          include: {
            pet: {
              select: {
                id: true,
                name: true,
                species: true,
                breed: true
              }
            }
          }
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });

    return NextResponse.json(reminders);
  } catch (error) {
    console.error('Error al obtener recordatorios:', error);
    return NextResponse.json(
      { error: 'Error al obtener los recordatorios' },
      { status: 500 }
    );
  }
});
