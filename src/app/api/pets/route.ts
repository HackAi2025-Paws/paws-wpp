import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Species } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const { name, dateOfBirth, species } = await request.json()

    if (!name || !dateOfBirth || !species) {
      return NextResponse.json(
        { error: 'Name, dateOfBirth, and species are required' },
        { status: 400 }
      )
    }

    if (!Object.values(Species).includes(species)) {
      return NextResponse.json(
        { error: 'Species must be CAT or DOG' },
        { status: 400 }
      )
    }

    const pet = await prisma.pet.create({
      data: {
        name,
        dateOfBirth: new Date(dateOfBirth),
        species,
      },
    })

    return NextResponse.json(pet, { status: 201 })
  } catch (error) {
    console.error('Error creating pet:', error)
    return NextResponse.json(
      { error: 'Failed to create pet' },
      { status: 500 }
    )
  }
}