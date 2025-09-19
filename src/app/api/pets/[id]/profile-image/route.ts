import { NextRequest, NextResponse } from 'next/server'
import { PetService } from '@/lib/pet-service'
import { FileHandler } from '@/hooks'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if pet exists
    const existingPet = await PetService.getPetById(petId)
    if (!existingPet.success) {
      return NextResponse.json(
        { error: 'Mascota no encontrada' },
        { status: 404 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Initialize file handler with image-specific settings
    const fileHandler = new FileHandler({
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxFileSize: 5 * 1024 * 1024, // 5MB limit for images
    })

    await fileHandler.initialize()

    // Upload the file
    const uploadResult = await fileHandler.uploadFile(
      buffer,
      file.name,
      file.type
    )

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error || 'Error al subir la imagen' },
        { status: 400 }
      )
    }

    // Update pet with new profile image URL
    const updateResult = await PetService.updatePetProfileImage(
      petId,
      uploadResult.url!
    )

    if (!updateResult.success) {
      // If database update fails, try to clean up the uploaded file
      try {
        await fileHandler.deleteFile(uploadResult.fileName!)
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError)
      }

      return NextResponse.json(
        { error: updateResult.error || 'Error al actualizar la imagen de perfil' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        pet: updateResult.data,
        image: {
          fileId: uploadResult.fileId,
          fileName: uploadResult.fileName,
          url: uploadResult.url,
          size: uploadResult.size,
          contentType: uploadResult.contentType
        }
      }
    })

  } catch (error) {
    console.error('Error in pet profile image upload:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Get current pet data
    const existingPet = await PetService.getPetById(petId)
    if (!existingPet.success || !existingPet.data) {
      return NextResponse.json(
        { error: 'Mascota no encontrada' },
        { status: 404 }
      )
    }

    // Check if pet has a profile image
    if (!existingPet.data.profileImageUrl) {
      return NextResponse.json(
        { error: 'La mascota no tiene imagen de perfil' },
        { status: 400 }
      )
    }

    // Extract filename from URL
    const url = new URL(existingPet.data.profileImageUrl)
    const fileName = url.pathname.split('/').pop()

    if (!fileName) {
      return NextResponse.json(
        { error: 'No se pudo determinar el nombre del archivo' },
        { status: 400 }
      )
    }

    // Initialize file handler
    const fileHandler = new FileHandler()
    await fileHandler.initialize()

    // Delete file from storage
    const deleteFileResult = await fileHandler.deleteFile(fileName)

    // Update pet to remove profile image URL
    const updateResult = await PetService.updatePetProfileImage(petId, '')

    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error || 'Error al actualizar la mascota' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Imagen de perfil eliminada correctamente',
      fileDeleted: deleteFileResult.success
    })

  } catch (error) {
    console.error('Error in pet profile image deletion:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}