import { NextRequest, NextResponse } from 'next/server'
import { PetService } from '@/lib/pet-service'

export async function POST(request: NextRequest) {
  try {
    const { name, dateOfBirth, species, ownerPhone } = await request.json()

    if (!name || !dateOfBirth || !species || !ownerPhone) {
      return NextResponse.json(
        { error: 'Name, dateOfBirth, species, and ownerPhone are required' },
        { status: 400 }
      )
    }

    const result = await PetService.registerPet(name, dateOfBirth, species, ownerPhone)

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
}