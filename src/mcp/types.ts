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

export const CreateConsultationSchema = z.object({
  petId: z.number().int().positive('Pet ID is required'),
  userId: z.number().int().positive('User ID is required'),
  date: z.string().datetime('Invalid date format'),
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  findings: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  nextSteps: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export const GetConsultationSchema = z.object({
  id: z.number().int().positive('Consultation ID is required'),
});

export const ListConsultationsSchema = z.object({
  petId: z.number().int().positive().optional(),
  userId: z.number().int().positive().optional(),
}).refine((data) => data.petId || data.userId, {
  message: 'Either petId or userId must be provided',
});

export const CreateConsultationMcpSchema = z.object({
  ownerPhone: z.string().min(1, 'Owner phone is required'),
  petName: z.string().min(1, 'Pet name is required'),
  date: z.string().datetime('Invalid date format'),
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  findings: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  nextSteps: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;
export type ListPetsInput = z.infer<typeof ListPetsSchema>;
export type RegisterPetInput = z.infer<typeof RegisterPetSchema>;
export type AskUserInput = z.infer<typeof AskUserSchema>;
export type CreateConsultationInput = z.infer<typeof CreateConsultationSchema>;
export type CreateConsultationMcpInput = z.infer<typeof CreateConsultationMcpSchema>;
export type GetConsultationInput = z.infer<typeof GetConsultationSchema>;
export type ListConsultationsInput = z.infer<typeof ListConsultationsSchema>;

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

export interface ConsultationResult {
  id: number;
  petId: number;
  userId: number;
  date: string;
  chiefComplaint: string;
  findings: string | null;
  diagnosis: string | null;
  treatment: string | null;
  nextSteps: string | null;
  additionalNotes: string | null;
  createdAt: string;
  pet?: PetResult;
  user?: UserResult;
}

export interface ConsultationListResult {
  id: number;
  petId: number;
  userId: number;
  date: string;
  chiefComplaint: string;
  diagnosis: string | null;
  petName?: string;
  userName?: string;
}

export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}