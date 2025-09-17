/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PendingCategory, PendingStatus } from '@prisma/client';
import {JWTPayload, withAuth} from "@/middleware/auth-middleware";

export const GET = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const status = req.nextUrl.searchParams.get('status') as PendingStatus | null;
    const category = req.nextUrl.searchParams.get('category') as PendingCategory | null;

    const where: any = {};

    if (userId) where.userId = parseInt(userId);
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

export const POST = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const data = await req.json();

    if (!data.title || !data.status || !data.category || !data.userId) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios (título, estado, categoría, userId)' },
        { status: 400 }
      );
    }

    const pending = await prisma.pending.create({
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        category: data.category,
        date: data.date ? new Date(data.date) : null,
        reminderConfig: data.reminderConfig,
        userId: parseInt(data.userId)
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

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();

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

    const updatedPending = await prisma.pending.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        status: data.status,
        category: data.category,
        date: data.date ? new Date(data.date) : null,
        reminderConfig: data.reminderConfig,
        userId: data.userId ? parseInt(data.userId) : undefined
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
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere el ID para eliminar' },
        { status: 400 }
      );
    }

    await prisma.pending.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar pending:', error);
    return NextResponse.json(
      { error: 'Error al eliminar la tarea pendiente' },
      { status: 500 }
    );
  }
}