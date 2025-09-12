import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const { petId } = await request.json()

    if (!petId) {
      return NextResponse.json(
        { error: 'Pet ID is required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if pet exists
    const pet = await prisma.pet.findUnique({
      where: { id: petId }
    })

    if (!pet) {
      return NextResponse.json(
        { error: 'Pet not found' },
        { status: 404 }
      )
    }

    // Add pet to user
    await prisma.user.update({
      where: { id: userId },
      data: {
        pets: {
          connect: { id: petId }
        }
      }
    })

    return NextResponse.json({ message: 'Pet added to user successfully' })
  } catch (error) {
    console.error('Error adding pet to user:', error)
    return NextResponse.json(
      { error: 'Failed to add pet to user' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { pets: true }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user.pets)
  } catch (error) {
    console.error('Error getting user pets:', error)
    return NextResponse.json(
      { error: 'Failed to get user pets' },
      { status: 500 }
    )
  }
}