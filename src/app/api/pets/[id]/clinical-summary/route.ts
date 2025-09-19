import { NextRequest, NextResponse } from 'next/server'
import { ClinicalHistoryService } from '@/services/clinicalHistoryService'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const petId = parseInt(id)

    if (isNaN(petId)) {
      return NextResponse.json(
        { error: 'ID de mascota inválido' },
        { status: 400 }
      )
    }

    const result = await ClinicalHistoryService.getClinicalSummary(petId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Error in clinical summary endpoint:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}