import { Species } from '@prisma/client';

export class InputNormalizer {
  /**
   * Normalize species input to valid enum values
   */
  static normalizeSpecies(input: string): Species {
    const normalized = input.toUpperCase().trim();

    // Direct matches
    if (normalized === 'CAT' || normalized === 'GATO') return Species.CAT;
    if (normalized === 'DOG' || normalized === 'PERRO') return Species.DOG;

    // Fuzzy matches for common variations
    const catVariations = ['GATA', 'GATITO', 'GATITA', 'FELINO', 'MICHI', 'MIAU'];
    const dogVariations = ['PERRA', 'PERRITO', 'PERRITA', 'CANINO', 'CACHORRO', 'CACHORRA', 'GUAU'];

    if (catVariations.some(variation => normalized.includes(variation))) {
      return Species.CAT;
    }

    if (dogVariations.some(variation => normalized.includes(variation))) {
      return Species.DOG;
    }

    throw new Error(`Invalid species: ${input}. Must be CAT/GATO or DOG/PERRO`);
  }

  /**
   * Normalize date input to ISO string
   */
  static normalizeDate(input: string): string {
    // Try parsing the input as-is first
    let date = new Date(input);

    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Handle Spanish date formats
    const spanishMonths = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };

    let normalizedInput = input.toLowerCase().trim();

    // Replace Spanish month names with numbers
    for (const [spanish, number] of Object.entries(spanishMonths)) {
      normalizedInput = normalizedInput.replace(spanish, number);
    }

    // Handle common Spanish date patterns
    // "15 de 01 de 2022" -> "2022-01-15"
    const spanishPattern = /(\d{1,2})\s+de\s+(\d{1,2}|\d{1,2})\s+de\s+(\d{4})/;
    const spanishMatch = normalizedInput.match(spanishPattern);
    if (spanishMatch) {
      const [, day, month, year] = spanishMatch;
      date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // Handle relative ages like "2 años" or "2 years old"
    const agePattern = /(\d+)\s*(año|años|year|years)/i;
    const ageMatch = input.match(agePattern);
    if (ageMatch) {
      const years = parseInt(ageMatch[1]);
      const birthYear = new Date().getFullYear() - years;
      // Use January 1st as approximate birth date
      date = new Date(`${birthYear}-01-01`);
      return date.toISOString();
    }

    // Handle "X meses" or "X months"
    const monthsPattern = /(\d+)\s*(mes|meses|month|months)/i;
    const monthsMatch = input.match(monthsPattern);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1]);
      date = new Date();
      date.setMonth(date.getMonth() - months);
      return date.toISOString();
    }

    throw new Error(`Invalid date format: ${input}. Please provide a specific date like "2022-01-15" or "15 de enero de 2022"`);
  }

  /**
   * Normalize phone number to consistent format
   */
  static normalizePhone(input: string): string {
    // Remove all non-digit characters except +
    let normalized = input.replace(/[^\d+]/g, '');

    // Ensure it starts with +
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }

    return normalized;
  }

  /**
   * Normalize name by capitalizing each word
   */
  static normalizeName(input: string): string {
    return input
      .trim()
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}