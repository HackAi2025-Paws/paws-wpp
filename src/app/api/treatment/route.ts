import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, JWTPayload } from '@/middleware/auth-middleware';

export const GET = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const { searchParams } = new URL(req.url);
    const petId = searchParams.get('petId');
    const treatmentId = searchParams.get('id');
    const authorId = searchParams.get('authorId');

    if (treatmentId) {
      const id = parseInt(treatmentId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'ID de tratamiento inválido' },
          { status: 400 }
        );
      }

      const treatment = await prisma.treatment.findUnique({
        where: { id },
        include: {
          pet: {
            include: {
              owners: true,
            },
          },
          author: true,
          consultation: {
            select: {
              id: true,
              date: true,
              chiefComplaint: true,
            }
          },
        },
      });

      if (!treatment) {
        return NextResponse.json(
          { error: 'Tratamiento no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json(mapTreatmentToDTO(treatment));
    }

    const whereClause: any = {};

    if (petId) {
      const id = parseInt(petId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'ID de mascota inválido' },
          { status: 400 }
        );
      }
      whereClause.petId = id;
    }

    if (authorId) {
      const id = parseInt(authorId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'ID de autor inválido' },
          { status: 400 }
        );
      }
      whereClause.authorId = id;
    }

    // Obtener los tratamientos con los filtros aplicados
    const treatments = await prisma.treatment.findMany({
      where: whereClause,
      include: {
        pet: {
          include: {
            owners: true,
          },
        },
        author: true,
        consultation: {
          select: {
            id: true,
            date: true,
            chiefComplaint: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const treatmentResults = treatments.map(treatment => mapTreatmentToDTO(treatment));

    return NextResponse.json(treatmentResults);
  } catch (error) {
    console.error('Error al obtener tratamientos:', error);
    return NextResponse.json(
      { error: 'Error al obtener tratamientos' },
      { status: 500 }
    );
  }
});

/**
 * Mapea un tratamiento de Prisma a un objeto DTO
 */
function mapTreatmentToDTO(treatment: any) {
  return {
    id: treatment.id,
    name: treatment.name,
    startDate: treatment.startDate.toISOString(),
    endDate: treatment.endDate?.toISOString() || null,
    notes: treatment.notes,
    petId: treatment.petId,
    consultationId: treatment.consultationId,
    authorId: treatment.authorId,
    pet: treatment.pet ? {
      id: treatment.pet.id,
      name: treatment.pet.name,
      dateOfBirth: treatment.pet.dateOfBirth.toISOString(),
      species: treatment.pet.species,
      owners: treatment.pet.owners?.map((owner: any) => ({
        id: owner.id,
        name: owner.name,
        phone: owner.phone,
      })),
    } : undefined,
    author: treatment.author ? {
      id: treatment.author.id,
      name: treatment.author.name,
      phone: treatment.author.phone,
    } : undefined,
    consultation: treatment.consultation ? {
      id: treatment.consultation.id,
      date: treatment.consultation.date.toISOString(),
      chiefComplaint: treatment.consultation.chiefComplaint,
    } : undefined,
  };
}
