import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, JWTPayload } from '@/middleware/auth-middleware';


export const GET = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const { searchParams } = new URL(req.url);
    const petId = searchParams.get('petId');
    const catalogId = searchParams.get('catalogId');
    const vaccineId = searchParams.get('id');
    const authorId = searchParams.get('authorId');

    if (vaccineId) {
      const id = parseInt(vaccineId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'ID de vacuna inválido' },
          { status: 400 }
        );
      }

      const vaccine = await prisma.vaccine.findUnique({
        where: { id },
        include: {
          catalog: true,
          pet: {
            include: {
              owners: true,
            },
          },
          author: true,
          consultation: true,
        },
      });

      if (!vaccine) {
        return NextResponse.json(
          { error: 'Vacuna no encontrada' },
          { status: 404 }
        );
      }

      return NextResponse.json(mapVaccineToDTO(vaccine));
    }

    // Preparar filtros para la consulta
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

    if (catalogId) {
      const id = parseInt(catalogId, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'ID de catálogo inválido' },
          { status: 400 }
        );
      }
      whereClause.catalogId = id;
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

    // Obtener las vacunas con los filtros aplicados
    const vaccines = await prisma.vaccine.findMany({
      where: whereClause,
      include: {
        catalog: true,
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
      orderBy: { applicationDate: 'desc' },
    });

    // Mapear los resultados al formato DTO
    const vaccineResults = vaccines.map(vaccine => mapVaccineToDTO(vaccine));

    return NextResponse.json(vaccineResults);
  } catch (error) {
    console.error('Error al obtener vacunas:', error);
    return NextResponse.json(
      { error: 'Error al obtener vacunas' },
      { status: 500 }
    );
  }
});

/**
 * Mapea una vacuna de Prisma a un objeto DTO
 */
function mapVaccineToDTO(vaccine: any) {
  return {
    id: vaccine.id,
    catalogId: vaccine.catalogId,
    applicationDate: vaccine.applicationDate.toISOString(),
    expirationDate: vaccine.expirationDate?.toISOString() || null,
    batchNumber: vaccine.batchNumber,
    notes: vaccine.notes,
    petId: vaccine.petId,
    consultationId: vaccine.consultationId,
    authorId: vaccine.authorId,
    catalog: vaccine.catalog ? {
      id: vaccine.catalog.id,
      name: vaccine.catalog.name,
      description: vaccine.catalog.description,
      periodicity: vaccine.catalog.periodicity,
      minAge: vaccine.catalog.minAge,
      notes: vaccine.catalog.notes,
      applicableTo: vaccine.catalog.applicableTo,
    } : undefined,
    pet: vaccine.pet ? {
      id: vaccine.pet.id,
      name: vaccine.pet.name,
      dateOfBirth: vaccine.pet.dateOfBirth.toISOString(),
      species: vaccine.pet.species,
      owners: vaccine.pet.owners?.map((owner: any) => ({
        id: owner.id,
        name: owner.name,
        phone: owner.phone,
      })),
    } : undefined,
    author: vaccine.author ? {
      id: vaccine.author.id,
      name: vaccine.author.name,
      phone: vaccine.author.phone,
    } : undefined,
    consultation: vaccine.consultation ? {
      id: vaccine.consultation.id,
      date: vaccine.consultation.date.toISOString(),
      chiefComplaint: vaccine.consultation.chiefComplaint,
    } : undefined,
  };
}

