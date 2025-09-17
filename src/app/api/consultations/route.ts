import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateConsultationSchema } from '@/mcp/types';
import { withAuth, JWTPayload } from '@/middleware/auth-middleware';

export const POST = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const body = await req.json();

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
        date: new Date(validation.data.date),
        chiefComplaint: validation.data.chiefComplaint,
        findings: validation.data.findings,
        diagnosis: validation.data.diagnosis,
        treatment: validation.data.treatment,
        nextSteps: validation.data.nextSteps,
        additionalNotes: validation.data.additionalNotes,
      },
      include: {
        pet: {
          include: {
            owners: true,
          },
        },
        user: true,
      },
    });

    return NextResponse.json({
      id: consultation.id,
      petId: consultation.petId,
      userId: consultation.userId,
      date: consultation.date.toISOString(),
      chiefComplaint: consultation.chiefComplaint,
      findings: consultation.findings,
      diagnosis: consultation.diagnosis,
      treatment: consultation.treatment,
      nextSteps: consultation.nextSteps,
      additionalNotes: consultation.additionalNotes,
      createdAt: consultation.createdAt.toISOString(),
      pet: {
        id: consultation.pet.id,
        name: consultation.pet.name,
        dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
        species: consultation.pet.species,
        owners: consultation.pet.owners.map(owner => ({
          id: owner.id,
          name: owner.name,
          phone: owner.phone,
        })),
      },
      user: {
        id: consultation.user.id,
        name: consultation.user.name,
        phone: consultation.user.phone,
      },
    }, { status: 201 });
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
        },
      });

      if (!consultation) {
        return NextResponse.json(
          { error: 'Consultation not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        findings: consultation.findings,
        diagnosis: consultation.diagnosis,
        treatment: consultation.treatment,
        nextSteps: consultation.nextSteps,
        additionalNotes: consultation.additionalNotes,
        createdAt: consultation.createdAt.toISOString(),
        pet: {
          id: consultation.pet.id,
          name: consultation.pet.name,
          dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
          species: consultation.pet.species,
          owners: consultation.pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
          })),
        },
        user: {
          id: consultation.user.id,
          name: consultation.user.name,
          phone: consultation.user.phone,
        },
      });
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
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults = consultations.map(consultation => ({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        findings: consultation.findings,
        diagnosis: consultation.diagnosis,
        treatment: consultation.treatment,
        nextSteps: consultation.nextSteps,
        additionalNotes: consultation.additionalNotes,
        createdAt: consultation.createdAt.toISOString(),
        pet: {
          id: consultation.pet.id,
          name: consultation.pet.name,
          dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
          species: consultation.pet.species,
          owners: consultation.pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
          })),
        },
        user: {
          id: consultation.user.id,
          name: consultation.user.name,
          phone: consultation.user.phone,
        },
      }));

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
        },
        orderBy: { date: 'desc' },
      });

      const consultationResults = consultations.map(consultation => ({
        id: consultation.id,
        petId: consultation.petId,
        userId: consultation.userId,
        date: consultation.date.toISOString(),
        chiefComplaint: consultation.chiefComplaint,
        findings: consultation.findings,
        diagnosis: consultation.diagnosis,
        treatment: consultation.treatment,
        nextSteps: consultation.nextSteps,
        additionalNotes: consultation.additionalNotes,
        createdAt: consultation.createdAt.toISOString(),
        pet: {
          id: consultation.pet.id,
          name: consultation.pet.name,
          dateOfBirth: consultation.pet.dateOfBirth.toISOString(),
          species: consultation.pet.species,
          owners: consultation.pet.owners.map(owner => ({
            id: owner.id,
            name: owner.name,
            phone: owner.phone,
          })),
        },
        user: {
          id: consultation.user.id,
          name: consultation.user.name,
          phone: consultation.user.phone,
        },
      }));

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