import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, JWTPayload } from '@/middleware/auth-middleware';
import { Species } from '@prisma/client';

/**
 * Obtiene el catálogo de vacunas con filtros opcionales
 */
export const GET = withAuth(async (req: NextRequest, token: JWTPayload) => {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const species = searchParams.get('species');

    // Obtener una vacuna específica por ID
    if (id) {
      const catalogId = parseInt(id, 10);
      if (isNaN(catalogId)) {
        return NextResponse.json(
          { error: 'ID de catálogo inválido' },
          { status: 400 }
        );
      }

      const vaccineCatalog = await prisma.vaccineCatalog.findUnique({
        where: { id: catalogId }
      });

      if (!vaccineCatalog) {
        return NextResponse.json(
          { error: 'Catálogo de vacuna no encontrado' },
          { status: 404 }
        );
      }

      return NextResponse.json(mapVaccineCatalogToDTO(vaccineCatalog));
    }

    // Preparar filtros para consulta de múltiples vacunas
    const whereClause: any = {};

    // Filtrar por especie si se proporciona
    if (species) {
      try {
        const speciesEnum = species.toUpperCase() as Species;
        whereClause.applicableTo = { has: speciesEnum };
      } catch (e) {
        return NextResponse.json(
          { error: 'Especie inválida. Valores permitidos: CAT, DOG' },
          { status: 400 }
        );
      }
    }

    // Obtener todas las vacunas del catálogo con los filtros aplicados
    const vaccineCatalog = await prisma.vaccineCatalog.findMany({
      where: whereClause,
      orderBy: { name: 'asc' }
    });

    // Mapear los resultados al formato DTO
    const catalogResults = vaccineCatalog.map(catalog => mapVaccineCatalogToDTO(catalog));

    return NextResponse.json(catalogResults);
  } catch (error) {
    console.error('Error al obtener el catálogo de vacunas:', error);
    return NextResponse.json(
      { error: 'Error al obtener el catálogo de vacunas' },
      { status: 500 }
    );
  }
});

/**
 * Mapea un catálogo de vacuna de Prisma a un objeto DTO
 */
function mapVaccineCatalogToDTO(catalog: any) {
  return {
    id: catalog.id,
    name: catalog.name,
    description: catalog.description,
    periodicity: catalog.periodicity,
    minAge: catalog.minAge,
    notes: catalog.notes,
    applicableTo: catalog.applicableTo,
  };
}

