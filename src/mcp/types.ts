import { z } from 'zod';
import { Species } from '@prisma/client';

export const RegisterUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
});

export const ListPetsSchema = z.object({
  phone: z.string().min(1, 'Phone is required'),
});

export const RegisterPetSchema = z.object({
  name: z.string().min(1, 'Pet name is required'),
  dateOfBirth: z.string().datetime('Invalid date format'),
  species: z.nativeEnum(Species),
  ownerPhone: z.string().min(1, 'Owner phone is required'),
});

export const AskUserSchema = z.object({
  message: z.string().min(1, 'Clarification message is required'),
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type ListPetsInput = z.infer<typeof ListPetsSchema>;
export type RegisterPetInput = z.infer<typeof RegisterPetSchema>;
export type AskUserInput = z.infer<typeof AskUserSchema>;

export interface UserResult {
  id: number;
  name: string;
  phone: string;
  pets?: PetResult[];
}

export interface PetResult {
  id: number;
  name: string;
  dateOfBirth: string;
  species: Species;
  owners: UserResult[];
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}