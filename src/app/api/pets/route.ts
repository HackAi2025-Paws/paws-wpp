import { NextRequest, NextResponse } from 'next/server'
import { PetService } from '@/lib/pet-service'
import { withAuth } from '@/middleware/auth-middleware'

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
