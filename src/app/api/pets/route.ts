import { NextRequest, NextResponse } from 'next/server'
import { PetService } from '@/lib/pet-service'
import { withAuth } from '@/middleware/auth-middleware'

export const GET = withAuth(async (request: NextRequest, token) => {
  try {
    // Obtener parámetros de búsqueda y paginación de la URL
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name') || undefined
    const breed = searchParams.get('breed') || undefined
    const ownerName = searchParams.get('ownerName') || undefined
    const petId = searchParams.get('id')
    const ownerId = searchParams.get('ownerId')

    // Parámetros de paginación
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10

    // Validar parámetros de paginación
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: 'El parámetro page debe ser un número mayor a 0' },
        { status: 400 }
      )
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'El parámetro limit debe ser un número entre 1 y 100' },
        { status: 400 }
      )
    }

    // Si se proporciona un ownerId, devolvemos todas las mascotas de ese propietario
    if (ownerId) {
      const id = parseInt(ownerId, 10)
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'ID de propietario inválido' },
          { status: 400 }
        )
      }

      const result = await PetService.getPetsByOwnerId(id, { page, limit })
      if (result.success) {
        return NextResponse.json({
          data: result.data,
          pagination: result.pagination
        })
      } else {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        )
      }
    }

    // Si se proporciona un ID, devolvemos los detalles de esa mascota específica
    if (petId) {
      const id = parseInt(petId, 10)
      if (isNaN(id)) {
        return NextResponse.json(
          { error: 'ID de mascota inválido' },
          { status: 400 }
        )
      }

      const result = await PetService.getPetDetails(id)
      if (result.success) {
        return NextResponse.json(result.data)
      } else {
        return NextResponse.json(
          { error: result.error },
          { status: 404 }
        )
      }
    }

    // Si no hay ID, realizamos una búsqueda con los parámetros proporcionados
    const result = await PetService.searchPets({ name, breed, ownerName }, { page, limit })
    if (result.success) {
      return NextResponse.json({
        data: result.data,
        pagination: result.pagination
      })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error searching pets:', error)
    return NextResponse.json(
      { error: 'Error al buscar mascotas' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (request: NextRequest, token) => {
  try {
    const { name, dateOfBirth, species, sex, weight, breed } = await request.json()

    const ownerPhone = token.phone

    if (!ownerPhone) {
      return NextResponse.json(
        { error: 'El token no contiene el número de teléfono del usuario' },
        { status: 400 }
      )
    }

    if (!name || !dateOfBirth || !species || !sex || !weight || !breed) {
      return NextResponse.json(
        { error: 'Name, dateOfBirth, species, sex, weight, y breed son requeridos' },
        { status: 400 }
      )
    }

    const result = await PetService.registerPet(name, dateOfBirth, species, sex, weight, breed, ownerPhone)

    if (result.success) {
      return NextResponse.json(result.data, { status: 201 })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error creating pet:', error)
    return NextResponse.json(
      { error: 'Failed to create pet' },
      { status: 500 }
    )
  }
})
