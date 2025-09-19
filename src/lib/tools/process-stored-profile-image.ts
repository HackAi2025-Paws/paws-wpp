import { z } from 'zod';
import { ToolHandler, ToolContext, ToolResult } from './types';
import { PetService } from '../pet-service';
import { FileHandler } from '@/hooks';
import { getSessionStore } from '../session-store';

const ProcessStoredProfileImageArgs = z.object({
  petId: z.number({
    errorMap: () => ({ message: 'Pet ID is required and must be a number' })
  }),
  tempImageKey: z.string({
    errorMap: () => ({ message: 'Temporary image key is required' })
  })
});

type ProcessStoredProfileImageInputType = z.infer<typeof ProcessStoredProfileImageArgs>;

export class ProcessStoredProfileImageTool implements ToolHandler<ProcessStoredProfileImageInputType> {
  name = 'process_stored_profile_image';
  schema = ProcessStoredProfileImageArgs;

  definition = {
    name: 'process_stored_profile_image',
    description: 'Use this tool when the user confirms a pet selection for a previously uploaded image. The tempImageKey should be extracted from the conversation context where it mentions "IMAGEN_TEMP_KEY:".',
    input_schema: {
      type: 'object' as const,
      properties: {
        petId: {
          type: 'number' as const,
          description: 'The ID of the pet to set the profile image for'
        },
        tempImageKey: {
          type: 'string' as const,
          description: 'The temporary image key from Redis (format: temp_image:phone:timestamp)'
        }
      },
      required: ['petId', 'tempImageKey']
    }
  };

  async execute(
    args: ProcessStoredProfileImageInputType,
    context: ToolContext
  ): Promise<ToolResult> {
    console.log(`[ProcessStoredProfileImageTool] Processing stored image for pet ${args.petId}`);

    try {
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

      // Retrieve stored image data from Redis
      const sessionStore = getSessionStore();
      await sessionStore.connect();

      let imageData;
      try {
        const storedData = await sessionStore.redisClient.get(args.tempImageKey);
        if (!storedData) {
          return {
            ok: false,
            error: 'La imagen temporal ha expirado o no se encontró. Por favor, envía la imagen nuevamente.'
          };
        }
        imageData = JSON.parse(storedData);
      } catch (error) {
        console.error('Error retrieving stored image:', error);
        return {
          ok: false,
          error: 'Error al recuperar la imagen temporal. Por favor, envía la imagen nuevamente.'
        };
      }

      if (!imageData.buffer) {
        return {
          ok: false,
          error: 'Los datos de la imagen están corruptos. Por favor, envía la imagen nuevamente.'
        };
      }

      try {
        // Convert base64 to buffer
        const buffer = Buffer.from(imageData.buffer, 'base64');

        // Initialize file handler
        const fileHandler = new FileHandler({
          allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
          maxFileSize: 5 * 1024 * 1024, // 5MB
        });

        await fileHandler.initialize();

        // Upload new image
        const uploadResult = await fileHandler.uploadFile(
          buffer,
          imageData.filename,
          imageData.contentType
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

        // Clean up the temporary stored image
        try {
          await sessionStore.redisClient.del(args.tempImageKey);
          console.log(`Cleaned up temporary image: ${args.tempImageKey}`);
        } catch (cleanupError) {
          console.warn('Warning: Could not cleanup temporary image:', cleanupError);
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
        console.error('Error processing stored profile image:', error);
        return {
          ok: false,
          error: `Error interno al procesar la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`
        };
      }

    } catch (error) {
      console.error('Error in ProcessStoredProfileImageTool:', error);
      return {
        ok: false,
        error: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }
}