import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateConsultationSchema } from '@/mcp/types';
import { withAuth, JWTPayload } from '@/middleware/auth-middleware';
import { mapConsultationToDTO } from '@/mcp/dto';

export const POST = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const body = await req.json();
    body.userId = parseInt(token.sub, 10)
    const validation = CreateConsultationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const consultation = await prisma.consultation.create({
      data: {
        petId: validation.data.petId,
        userId: parseInt(token.sub, 10),
        consultationType: validation.data.consultationType,
        date: new Date(validation.data.date),
        chiefComplaint: validation.data.chiefComplaint,
        findings: validation.data.findings || null,
        diagnosis: validation.data.diagnosis || null,
        nextSteps: validation.data.nextSteps || null,
        additionalNotes: validation.data.additionalNotes || null,
        nextConsultation: validation.data.nextConsultation ? new Date(validation.data.nextConsultation) : null,
        treatment: validation.data.treatment ? {
          create: validation.data.treatment.map(t => ({
            name: t.name,
            startDate: new Date(t.startDate),
            endDate: t.endDate ? new Date(t.endDate) : null,
            notes: t.notes || null,
            petId: validation.data.petId,
            authorId: parseInt(token.sub, 10)
          }))
        } : undefined,
        vaccines: validation.data.vaccines ? {
          create: validation.data.vaccines.map(v => ({
            catalogId: v.catalogId,
            applicationDate: new Date(v.applicationDate),
            expirationDate: v.expirationDate ? new Date(v.expirationDate) : null,
            batchNumber: v.batchNumber || null,
            notes: v.notes || null,
            petId: validation.data.petId,
            authorId: parseInt(token.sub, 10)
          }))
        } : undefined,
      },
      include: {
        pet: {
          include: {
            owners: true,
          },
        },
        user: true,
        treatment: true,
        vaccines: {
          include: {
            catalog: true
          }
        }
      },
    });

    return NextResponse.json(mapConsultationToDTO(consultation), { status: 201 });
  } catch (error) {
    console.error('Error creating consultation:', error);
    return NextResponse.json(
      { error: 'Failed to create consultation' },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const { searchParams } = new URL(req.url);
    const petId = searchParams.get('petId');
    const userId = parseInt(token.sub, 10);
    const consultationId = searchParams.get('id');

    if (consultationId) {
      const id = parseInt(consultationId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'Invalid consultation ID' },
          { status: 400 }
        );
      }

      const consultation = await prisma.consultation.findUnique({
        where: { id },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
          treatment: true,
          vaccines: {
            include: {
              catalog: true,
            },
          },
        },
      });

      if (!consultation) {
        return NextResponse.json(
          { error: 'Consultation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(mapConsultationToDTO(consultation));
    }

    if (petId) {
      const id = parseInt(petId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'Invalid pet ID' },
          { status: 400 }
        );
      }

      const consultations = await prisma.consultation.findMany({
        where: { petId: id },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
          treatment: true,
          vaccines: {
            include: {
              catalog: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults = consultations.map(consultation =>
        mapConsultationToDTO(consultation)
      );

      return NextResponse.json(consultationResults);
    }

    if (userId) {
      if (isNaN(userId)) {
        return NextResponse.json(
          { error: 'Invalid user ID' },
          { status: 400 }
        );
      }

      const consultations = await prisma.consultation.findMany({
        where: { userId },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          user: true,
          treatment: true,
          vaccines: {
            include: {
              catalog: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults = consultations.map(consultation =>
        mapConsultationToDTO(consultation)
      );

      return NextResponse.json(consultationResults);
    }

    return NextResponse.json(
      { error: 'Please provide petId, userId, or id query parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching consultations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consultations' },
      { status: 500 }
    );
  }
});