import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/user-service'
import { withAuth } from '@/middleware/auth-middleware'

export const GET = withAuth(async (request: NextRequest, token) => {
  try {
    const phone = token.phone

    if (!phone) {
      return NextResponse.json(
        { error: 'No se encontró información de teléfono en el token' },
        { status: 400 }
      )
    }

    const result = await UserService.fetchUserByPhone(phone)

    if (result.success) {
      return NextResponse.json(result.data)
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Error al obtener información del usuario' },
      { status: 500 }
    )
  }
})

export async function POST(request: NextRequest) {
  try {
    const { name, phone } = await request.json()

    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      )
    }

    const result = await UserService.registerUser(name, phone)

    if (result.success) {
      return NextResponse.json(result.data, { status: 201 })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}