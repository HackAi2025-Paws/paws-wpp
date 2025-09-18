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
      // Get Claude's tool call
      const toolCall = await ClaudeService.processMessage(userPhone, messageBody);

      // Execute the tool call
      const result = await this.executeValidatedTool(toolCall);
      return this.formatResponse(toolCall, result);

    } catch (error) {
      console.error('Agent processing error:', error);
      return 'Lo siento, ocurrió un error procesando tu mensaje. ¿Podrías intentar de nuevo?';
    }
  }

  private static async executeValidatedTool(toolCall: AgentToolCall): Promise<OperationResult<UserResult | PetResult[] | PetResult> | { message: string }> {
    console.log(`Executing tool: ${toolCall.name}`, toolCall.arguments);

    try {
      switch (toolCall.name) {
        case 'register_user': {
          const normalizedInput = {
            ...toolCall.arguments,
            name: typeof toolCall.arguments.name === 'string' ? InputNormalizer.normalizeName(toolCall.arguments.name) : toolCall.arguments.name
          };

          const args = RegisterUserSchema.parse(normalizedInput) as RegisterUserInput;
          return await this.repository.upsertUserByPhone(args.name, args.phone);
        }

        case 'list_pets': {
          const args = ListPetsSchema.parse(toolCall.arguments) as ListPetsInput;
          return await this.repository.listPetsByUserPhone(args.phone);
        }

        case 'register_pet': {
          const normalizedInput = {
            ...toolCall.arguments,
            name: typeof toolCall.arguments.name === 'string' ? InputNormalizer.normalizeName(toolCall.arguments.name) : toolCall.arguments.name,
            species: typeof toolCall.arguments.species === 'string' ? InputNormalizer.normalizeSpecies(toolCall.arguments.species) : toolCall.arguments.species,
            dateOfBirth: typeof toolCall.arguments.dateOfBirth === 'string' ? InputNormalizer.normalizeDate(toolCall.arguments.dateOfBirth) : toolCall.arguments.dateOfBirth
          };

          const args = RegisterPetSchema.parse(normalizedInput) as RegisterPetInput;
          return await this.repository.createPetForUser(
            args.name,
            new Date(args.dateOfBirth),
            args.species,
            args.sex,
            args.weight,
            args.breed,
            args.ownerPhone
          );
        }

        case 'ask_user': {
          const args = AskUserSchema.parse(toolCall.arguments) as AskUserInput;
          return { message: args.message };
        }

        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }
    } catch (error) {
      console.error(`Tool execution failed for ${toolCall.name}:`, error);

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
    if ('message' in result) {
      return result.message;
    }

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