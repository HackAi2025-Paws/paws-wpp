import { z } from 'zod';

export type ReminderStrategy =
  | {
      type: 'ABSOLUTE';
      date: string;
    }
  | {
      type: 'RELATIVE';
      offsetDays: number;
      time: string;
    }
  | {
      type: 'RECURRING';
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      dayOfWeek?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
      time: string;
      maxOccurrences?: number;
    };

export type ReminderConfig = ReminderStrategy[];

export const absoluteReminderSchema = z.object({
    type: z.literal('ABSOLUTE'),
    date: z.string().refine(val => !isNaN(Date.parse(val)), {
        message: "Formato de fecha inválido. Debe ser una cadena ISO"
    })
});

export const relativeReminderSchema = z.object({
    type: z.literal('RELATIVE'),
    offsetDays: z.number(),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Formato de hora inválido. Debe ser HH:MM"
    })
});

export const dayOfWeekEnum = z.enum([
    'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
]);

export const recurringReminderSchema = z.object({
    type: z.literal('RECURRING'),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    dayOfWeek: dayOfWeekEnum.optional(),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: "Formato de hora inválido. Debe ser HH:MM"
    }),
    maxOccurrences: z.number().int().positive().optional()
});

export const reminderStrategySchema = z.discriminatedUnion('type', [
    absoluteReminderSchema,
    relativeReminderSchema,
    recurringReminderSchema
]);

export const reminderConfigSchema = z.array(reminderStrategySchema);