import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PendingCategory, PendingStatus } from '@prisma/client';
import {JWTPayload, withAuth} from "@/middleware/auth-middleware";
import { z } from 'zod';
import {reminderConfigSchema} from "@/types/reminder";

export const GET = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const userId = token.sub;
    const petId = req.nextUrl.searchParams.get('petId');
    const status = req.nextUrl.searchParams.get('status') as PendingStatus | null;
    const category = req.nextUrl.searchParams.get('category') as PendingCategory | null;

    const where: any = {};

    if (userId) where.userId = parseInt(userId);
    if (petId) where.petId = parseInt(petId);
    if (status) where.status = status;
    if (category) where.category = category;

    const pendings = await prisma.pending.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        },
        pet: {
          select:{
            id: true,
            name: true,
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    return NextResponse.json(pendings);
  } catch (error) {
    console.error('Error al obtener pendings:', error);
    return NextResponse.json(
      { error: 'Error al obtener las tareas pendientes' },
      { status: 500 }
    );
  }
});

const createPendingSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  description: z.string().optional(),
  category: z.nativeEnum(PendingCategory),
  date: z.string().optional(),
  location: z.string().optional(),
  petId: z.number(),
  reminderConfig: reminderConfigSchema.optional()
});

type CreatePendingRequest = z.infer<typeof createPendingSchema>;

export const POST = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const rawData = await req.json();

    const result = createPendingSchema.safeParse(rawData);

    if (!result.success) {
      return NextResponse.json(
          { error: 'Datos inválidos', issues: result.error.issues },
          { status: 400 }
      );
    }

    const data = result.data;

    const pending = await prisma.pending.create({
      data: {
        title: data.title,
        description: data.description,
        status: PendingStatus.PENDING,
        location: data.location,
        reminderConfig: data.reminderConfig,
        category: data.category,
        date: data.date ? new Date(data.date) : null,
        userId: parseInt(token.sub),
        petId : data.petId
      }
    });

    return NextResponse.json(pending, { status: 201 });
  } catch (error) {
    console.error('Error al crear pending:', error);
    return NextResponse.json(
      { error: 'Error al crear la tarea pendiente' },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const data = await req.json();

    if (!data.id) {
      return NextResponse.json(
        { error: 'Se requiere el ID para actualizar' },
        { status: 400 }
      );
    }

    const id = parseInt(data.id);

    const existingPending = await prisma.pending.findUnique({
      where: { id }
    });

    if (!existingPending) {
      return NextResponse.json(
        { error: 'Tarea pendiente no encontrada' },
        { status: 404 }
      );
    }

    if (existingPending.userId !== parseInt(token.sub)) {
      return NextResponse.json(
        { error: 'No tienes permiso para actualizar esta tarea' },
        { status: 403 }
      );
    }

    const updatedPending = await prisma.pending.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        category: data.category,
        date: data.date ? new Date(data.date) : null,
        reminderConfig: data.reminderConfig,
        location: data.location
      }
    });

    return NextResponse.json(updatedPending);
  } catch (error) {
    console.error('Error al actualizar pending:', error);
    return NextResponse.json(
      { error: 'Error al actualizar la tarea pendiente' },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID para eliminar' },
        { status: 400 }
      );
    }

    const pendingId = parseInt(id);

    const existingPending = await prisma.pending.findUnique({
      where: { id: pendingId }
    });

    if (!existingPending) {
      return NextResponse.json(
        { error: 'Tarea pendiente no encontrada' },
        { status: 404 }
      );
    }

    if (existingPending.userId !== parseInt(token.sub)) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar esta tarea' },
        { status: 403 }
      );
    }

    await prisma.pending.delete({
      where: { id: pendingId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar pending:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la tarea pendiente' },
      { status: 500 }
    );
  }
});