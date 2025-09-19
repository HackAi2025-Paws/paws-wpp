import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { PetService } from '../pet-service';
import { FileHandler } from '@/hooks';

const AddPetProfilePictureArgs = z.object({
  action: z.enum(['list_pets', 'confirm_pet', 'upload_image'], {
    errorMap: () => ({ message: 'Action must be list_pets, confirm_pet, or upload_image' })
  }),
  petId: z.number().optional(),
  imageData: z.object({
    buffer: z.string(),
    filename: z.string(),
    contentType: z.string()
  }).optional()
});

type AddPetProfilePictureInputType = z.infer<typeof AddPetProfilePictureArgs>;

export class AddPetProfilePictureTool implements ToolHandler<AddPetProfilePictureInputType> {
  name = 'add_pet_profile_picture';
  schema = AddPetProfilePictureArgs;

  definition = {
    name: 'add_pet_profile_picture',
    description: 'Use when the user wants to add, upload, or set a profile picture/photo for their pet. Handles the interactive flow: list pets, confirm selection, and process image upload. Always start with action "list_pets".',
    input_schema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string' as const,
          enum: ['list_pets', 'confirm_pet', 'upload_image'],
          description: 'The action to perform: list_pets to show available pets, confirm_pet to confirm selection, upload_image to process the uploaded file'
        },
        petId: {
          type: 'number' as const,
          description: 'Pet ID (required for confirm_pet and upload_image actions)'
        },
        imageData: {
          type: 'object' as const,
          properties: {
            buffer: {
              type: 'string' as const,
              description: 'Base64 encoded image buffer'
            },
            filename: {
              type: 'string' as const,
              description: 'Original filename'
            },
            contentType: {
              type: 'string' as const,
              description: 'MIME type of the image'
            }
          },
          description: 'Image data (required for upload_image action)'
        }
      },
      required: ['action']
    }
  };

  async execute(
    args: AddPetProfilePictureInputType,
    context: ToolContext
  ): Promise<ToolResult> {
    console.log(`[AddPetProfilePictureTool] Executing action: ${args.action} for user: ${context.userPhone}`);
    try {
      switch (args.action) {
        case 'list_pets': {
          const petsResult = await PetService.listPetsByOwnerPhone(context.userPhone);

          if (!petsResult.success) {
            return {
              ok: false,
              error: petsResult.error || 'Error al obtener las mascotas'
            };
          }

          if (!petsResult.data || petsResult.data.length === 0) {
            return {
              ok: true,
              data: 'No se encontraron mascotas para este propietario. Primero debes registrar una mascota.'
            };
          }

          let response = '📋 **Mascotas disponibles para agregar foto de perfil:**\n\n';

          petsResult.data.forEach((pet, index) => {
            const speciesEmoji = pet.species === 'DOG' ? '🐕' : '🐱';
            const hasProfileImage = pet.profileImageUrl ? '🖼️' : '❌';
            const age = PetService.calculateAge(new Date(pet.dateOfBirth));

            response += `${index + 1}. ${speciesEmoji} **${pet.name}** (ID: ${pet.id})\n`;
            response += `   - Especie: ${pet.species === 'DOG' ? 'Perro' : 'Gato'}\n`;
            response += `   - Edad: ${age}\n`;
            response += `   - Foto actual: ${hasProfileImage}\n`;
            if (pet.breed) response += `   - Raza: ${pet.breed}\n`;
            response += '\n';
          });

          response += '\n💡 **Selecciona una mascota indicando su nombre o ID para continuar.**';

          return {
            ok: true,
            data: response
          };
        }

        case 'confirm_pet': {
          if (!args.petId) {
            return {
              ok: false,
              error: 'Se requiere el ID de la mascota para confirmar la selección.'
            };
          }

          const petResult = await PetService.getPetById(args.petId);

          if (!petResult.success || !petResult.data) {
            return {
              ok: false,
              error: petResult.error || 'No se encontró la mascota especificada.'
            };
          }

          const pet = petResult.data;
          const speciesEmoji = pet.species === 'DOG' ? '🐕' : '🐱';
          const age = PetService.calculateAge(new Date(pet.dateOfBirth));

          let response = `✅ **Has seleccionado:**\n\n`;
          response += `${speciesEmoji} **${pet.name}**\n`;
          response += `- ID: ${pet.id}\n`;
          response += `- Especie: ${pet.species === 'DOG' ? 'Perro' : 'Gato'}\n`;
          response += `- Edad: ${age}\n`;
          if (pet.breed) response += `- Raza: ${pet.breed}\n`;

          if (pet.profileImageUrl) {
            response += `\n⚠️ **Esta mascota ya tiene una foto de perfil. Si subes una nueva imagen, la anterior será reemplazada.**\n`;
          }

          response += `\n📸 **Ahora envía la imagen que quieres usar como foto de perfil para ${pet.name}.**\n`;
          response += `\n📋 **Requisitos de la imagen:**\n`;
          response += `- Formatos permitidos: JPEG, PNG, GIF, WebP\n`;
          response += `- Tamaño máximo: 5MB\n`;
          response += `- Recomendado: Imagen cuadrada para mejor visualización\n`;

          return {
            ok: true,
            data: response
          };
        }

        case 'upload_image': {
          if (!args.petId) {
            return {
              ok: false,
              error: 'Se requiere el ID de la mascota para subir la imagen.'
            };
          }

          if (!args.imageData) {
            return {
              ok: false,
              error: 'No se proporcionó información de la imagen.'
            };
          }

          // Verify pet exists
          const petResult = await PetService.getPetById(args.petId);
          if (!petResult.success || !petResult.data) {
            return {
              ok: false,
              error: `No se encontró la mascota con ID ${args.petId}.`
            };
          }

          const pet = petResult.data;
          const previousImageUrl = pet.profileImageUrl;

          try {
            // Convert base64 to buffer
            const buffer = Buffer.from(args.imageData.buffer, 'base64');

            // Initialize file handler
            const fileHandler = new FileHandler({
              allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
              maxFileSize: 5 * 1024 * 1024, // 5MB
            });

            await fileHandler.initialize();

            // Upload new image
            const uploadResult = await fileHandler.uploadFile(
              buffer,
              args.imageData.filename,
              args.imageData.contentType
            );

            if (!uploadResult.success) {
              return {
                ok: false,
                error: `Error al subir la imagen: ${uploadResult.error}`
              };
            }

            // Update pet with new profile image URL
            const updateResult = await PetService.updatePetProfileImage(
              args.petId,
              uploadResult.url!
            );

            if (!updateResult.success) {
              // Clean up uploaded file if database update fails
              try {
                await fileHandler.deleteFile(uploadResult.fileName!);
              } catch (cleanupError) {
                console.error('Failed to cleanup uploaded file:', cleanupError);
              }
              return {
                ok: false,
                error: `Error al actualizar la mascota: ${updateResult.error}`
              };
            }

            // Delete previous image if it existed
            if (previousImageUrl) {
              try {
                const url = new URL(previousImageUrl);
                const fileName = url.pathname.split('/').pop();
                if (fileName) {
                  await fileHandler.deleteFile(fileName);
                }
              } catch (deleteError) {
                console.warn('Warning: Could not delete previous profile image:', deleteError);
              }
            }

            const speciesEmoji = pet.species === 'DOG' ? '🐕' : '🐱';

            let response = `✅ **¡Foto de perfil actualizada con éxito!**\n\n`;
            response += `${speciesEmoji} **${pet.name}** ahora tiene una nueva foto de perfil.\n\n`;
            response += `📸 **Detalles de la imagen:**\n`;
            response += `- Archivo: ${uploadResult.fileName}\n`;
            response += `- Tamaño: ${(uploadResult.size! / 1024).toFixed(1)} KB\n`;
            response += `- Tipo: ${uploadResult.contentType}\n`;
            response += `- URL: ${uploadResult.url}\n`;

            if (previousImageUrl) {
              response += `\n♻️ La imagen anterior ha sido eliminada del almacenamiento.`;
            }

            return {
              ok: true,
              data: response
            };

          } catch (error) {
            console.error('Error processing pet profile image:', error);
            return {
              ok: false,
              error: `Error interno al procesar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`
            };
          }
        }

        default:
          return {
            ok: false,
            error: 'Acción no válida. Las acciones permitidas son: list_pets, confirm_pet, upload_image.'
          };
      }
    } catch (error) {
      console.error('Error in AddPetProfilePictureTool:', error);
      return {
        ok: false,
        error: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
}