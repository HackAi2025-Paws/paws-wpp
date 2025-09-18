import { Consultation, Pet, Treatment, User, Vaccine } from '@prisma/client';
import {
  ConsultationResult,
  PetResult,
  TreatmentResult,
  UserResult,
  VaccineResult
} from './types';

type PetWithOwners = Pet & {
  owners: User[]
};

type VaccineWithCatalog = Vaccine & {
  catalog?: {
    name: string;
    description: string | null;
  }
};

/**
 * Transforma un objeto de usuario de Prisma a un DTO de usuario
 */
export function mapUserToDTO(user: User): UserResult {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone
  };
}

/**
 * Transforma un objeto de mascota de Prisma (con propietarios) a un DTO de mascota
 */
export function mapPetToDTO(pet: PetWithOwners): PetResult {
  return {
    id: pet.id,
    name: pet.name,
    dateOfBirth: pet.dateOfBirth.toISOString(),
    species: pet.species,
    owners: pet.owners.map(owner => mapUserToDTO(owner))
  };
}

/**
 * Transforma un objeto de tratamiento de Prisma a un DTO de tratamiento
 */
export function mapTreatmentToDTO(treatment: Treatment): TreatmentResult {
  return {
    id: treatment.id,
    name: treatment.name,
    startDate: treatment.startDate.toISOString(),
    endDate: treatment.endDate?.toISOString() || null,
    notes: treatment.notes,
    petId: treatment.petId,
    authorId: treatment.authorId
  };
}

/**
 * Transforma un objeto de vacuna de Prisma a un DTO de vacuna
 */
export function mapVaccineToDTO(vaccine: VaccineWithCatalog): VaccineResult {
  return {
    id: vaccine.id,
    catalogId: vaccine.catalogId,
    applicationDate: vaccine.applicationDate.toISOString(),
    expirationDate: vaccine.expirationDate?.toISOString() || null,
    batchNumber: vaccine.batchNumber,
    notes: vaccine.notes,
    petId: vaccine.petId,
    authorId: vaccine.authorId,
    catalog: vaccine.catalog ? {
      name: vaccine.catalog.name,
      description: vaccine.catalog.description
    } : undefined
  };
}

/**
 * Transforma un objeto de consulta de Prisma a un DTO de consulta
 */
export function mapConsultationToDTO(consultation: Consultation & {
  pet?: PetWithOwners;
  user?: User;
  treatment: Treatment[];
  vaccines: VaccineWithCatalog[];
}): ConsultationResult {
  return {
    id: consultation.id,
    petId: consultation.petId,
    userId: consultation.userId,
    consultationType: consultation.consultationType,
    date: consultation.date.toISOString(),
    chiefComplaint: consultation.chiefComplaint,
    findings: consultation.findings,
    diagnosis: consultation.diagnosis,
    nextSteps: consultation.nextSteps,
    additionalNotes: consultation.additionalNotes,
    nextConsultation: consultation.nextConsultation?.toISOString() || null,
    createdAt: consultation.createdAt.toISOString(),
    pet: consultation.pet ? mapPetToDTO(consultation.pet) : undefined,
    user: consultation.user ? mapUserToDTO(consultation.user) : undefined,
    treatment: consultation.treatment.map(t => mapTreatmentToDTO(t)),
    vaccines: consultation.vaccines.map(v => mapVaccineToDTO(v))
  };
}
