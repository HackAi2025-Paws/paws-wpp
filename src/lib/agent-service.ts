import { ClaudeService, AgentToolCall } from './claude-service';
import { InputNormalizer } from './input-normalizer';
import { PetRepository } from '../mcp/repository';
import {
  RegisterUserSchema,
  ListPetsSchema,
  RegisterPetSchema,
  AskUserSchema,
  RegisterUserInput,
  ListPetsInput,
  RegisterPetInput,
  AskUserInput,
  OperationResult,
  UserResult,
  PetResult
} from '../mcp/types';

export class AgentService {
  private static repository = new PetRepository();

  static async processUserMessage(userPhone: string, messageBody: string): Promise<string> {
    try {
      // Get Claude's tool calls (can be multiple)
      const toolCalls = await ClaudeService.processMessage(userPhone, messageBody);

      // Execute all tool calls and collect results
      const results: string[] = [];

      for (const toolCall of toolCalls) {
        try {
          const result = await this.executeValidatedTool(toolCall);
          const formattedResponse = this.formatResponse(toolCall, result);
          results.push(formattedResponse);
        } catch (error) {
          console.error(`Failed to execute tool ${toolCall.name}:`, error);
          results.push(`❌ Error procesando ${toolCall.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
        }
      }

      // Combine all results
      return results.join('\n\n');

    } catch (error) {
      console.error('Agent processing error:', error);
      return 'Lo siento, ocurrió un error procesando tu mensaje. ¿Podrías intentar de nuevo?';
    }
  }

  private static async executeValidatedTool(toolCall: AgentToolCall): Promise<OperationResult<UserResult | PetResult[] | PetResult> | { message: string }> {
    console.log(`Executing tool: ${toolCall.name}`, toolCall.input);

    try {
      switch (toolCall.name) {
        case 'register_user': {
          // Normalize and validate input
          const normalizedInput = {
            ...toolCall.input,
            name: typeof toolCall.input.name === 'string' ? InputNormalizer.normalizeName(toolCall.input.name) : toolCall.input.name
          };

          const args = RegisterUserSchema.parse(normalizedInput) as RegisterUserInput;
          return await this.repository.upsertUserByPhone(args.name, args.phone);
        }

        case 'list_pets': {
          const args = ListPetsSchema.parse(toolCall.input) as ListPetsInput;
          return await this.repository.listPetsByUserPhone(args.phone);
        }

        case 'register_pet': {
          // Normalize inputs before validation
          const normalizedInput = {
            ...toolCall.input,
            name: typeof toolCall.input.name === 'string' ? InputNormalizer.normalizeName(toolCall.input.name) : toolCall.input.name,
            species: typeof toolCall.input.species === 'string' ? InputNormalizer.normalizeSpecies(toolCall.input.species) : toolCall.input.species,
            dateOfBirth: typeof toolCall.input.dateOfBirth === 'string' ? InputNormalizer.normalizeDate(toolCall.input.dateOfBirth) : toolCall.input.dateOfBirth
          };

          const args = RegisterPetSchema.parse(normalizedInput) as RegisterPetInput;
          return await this.repository.createPetForUser(
            args.name,
            new Date(args.dateOfBirth),
            args.species,
            args.ownerPhone
          );
        }

        case 'ask_user': {
          const args = AskUserSchema.parse(toolCall.input) as AskUserInput;
          return { message: args.message };
        }

        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }
    } catch (error) {
      console.error(`Tool execution failed for ${toolCall.name}:`, error);

      // Handle normalization errors with helpful messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid species')) {
          return {
            message: 'No reconozco esa especie de mascota. Por favor especifica si es un "perro" o "gato".'
          };
        }

        if (error.message.includes('Invalid date')) {
          return {
            message: 'No pude entender la fecha de nacimiento. ¿Podrías darme una fecha más específica? Por ejemplo: "15 de enero de 2022" o "2022-01-15".'
          };
        }

        if (error.message.includes('validation') || error.message.includes('required')) {
          return {
            message: 'Faltan algunos datos para completar tu solicitud. ¿Podrías proporcionar más información?'
          };
        }
      }

      throw error;
    }
  }

  private static formatResponse(
    toolCall: AgentToolCall,
    result: OperationResult<UserResult | PetResult[] | PetResult> | { message: string }
  ): string {
    // Handle ask_user and error responses
    if ('message' in result) {
      return result.message;
    }

    // Handle operation results
    const operationResult = result as OperationResult<UserResult | PetResult[] | PetResult>;

    if (!operationResult.success) {
      return `❌ Error: ${operationResult.error}`;
    }

    switch (toolCall.name) {
      case 'register_user': {
        const user = operationResult.data as UserResult;
        return `✅ Usuario registrado: ${user.name} con teléfono ${user.phone}`;
      }

      case 'list_pets': {
        const pets = operationResult.data as PetResult[];
        if (pets.length === 0) {
          return 'No tienes mascotas registradas aún. ¿Te gustaría registrar una mascota? 🐾';
        }

        const petsList = pets.map(pet => {
          const age = this.calculateAge(new Date(pet.dateOfBirth));
          const species = pet.species === 'CAT' ? 'gato' : 'perro';
          return `• ${pet.name} (${species}, ${age})`;
        }).join('\n');

        return `🐾 Tus mascotas:\n${petsList}`;
      }

      case 'register_pet': {
        const pet = operationResult.data as PetResult;
        const species = pet.species === 'CAT' ? 'gato' : 'perro';
        const age = this.calculateAge(new Date(pet.dateOfBirth));
        return `✅ Mascota registrada: ${pet.name} (${species}, ${age}) 🎉`;
      }

      default:
        return '✅ Operación completada exitosamente';
    }
  }

  private static calculateAge(birthDate: Date): string {
    const now = new Date();
    const ageInMs = now.getTime() - birthDate.getTime();
    const ageInYears = ageInMs / (1000 * 60 * 60 * 24 * 365.25);

    if (ageInYears < 1) {
      const ageInMonths = Math.floor(ageInYears * 12);
      return ageInMonths === 1 ? '1 mes' : `${ageInMonths} meses`;
    } else {
      const years = Math.floor(ageInYears);
      return years === 1 ? '1 año' : `${years} años`;
    }
  }
}