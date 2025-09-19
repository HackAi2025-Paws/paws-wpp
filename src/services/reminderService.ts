import { prisma } from '@/lib/prisma';
import { Pending, Reminder } from '@prisma/client';
import { ReminderConfig } from '@/types/reminder';

export async function scheduleRemindersForPending(pending: Pending): Promise<void> {
  if (!pending.reminderConfig) return;

  const reminderConfig = pending.reminderConfig as unknown as ReminderConfig;
  const reminderDates = calculateReminderDates(reminderConfig, pending);

  await prisma.reminder.deleteMany({
    where: {
      pendingId: pending.id,
      sent: false
    }
  });

  for (const date of reminderDates) {
    await prisma.reminder.create({
      data: {
        pendingId: pending.id,
        scheduledFor: date,
        sent: false
      }
    });
  }

  console.log(`Programados ${reminderDates.length} recordatorios para la tarea "${pending.title}"`);
}

function calculateReminderDates(config: ReminderConfig, pending: Pending): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  const defaultMaxFutureDays = 30;

  for (const strategy of config) {
    switch(strategy.type) {
      case 'ABSOLUTE':
        const absoluteDate = new Date(strategy.date);
        if (absoluteDate > now) {
          dates.push(absoluteDate);
        }
        break;

      case 'RELATIVE':
        if (pending.date) {
          const pendingDate = new Date(pending.date);
          const [hours, minutes] = strategy.time.split(':').map(Number);

          const reminderDate = new Date(pendingDate);
          reminderDate.setDate(pendingDate.getDate() + strategy.offsetDays);
          reminderDate.setHours(hours, minutes, 0, 0);

          if (reminderDate > now) {
            dates.push(reminderDate);
          }
        }
        break;

      case 'RECURRING':
        const [recurHours, recurMinutes] = strategy.time.split(':').map(Number);
        const maxOccurrences = strategy.maxOccurrences || defaultMaxFutureDays;

        switch(strategy.frequency) {
          case 'DAILY':
            let dailyCount = 0;
            for (let i = 0; i < defaultMaxFutureDays && dailyCount < maxOccurrences; i++) {
              const date = new Date();
              date.setDate(date.getDate() + i);
              date.setHours(recurHours, recurMinutes, 0, 0);

              if (date > now) {
                dates.push(date);
                dailyCount++;
              }
            }
            break;

          case 'WEEKLY':
            const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
            let weeklyCount = 0;
            for (let i = 0; i < defaultMaxFutureDays && weeklyCount < maxOccurrences; i++) {
              const date = new Date();
              date.setDate(date.getDate() + i);
              date.setHours(recurHours, recurMinutes, 0, 0);

              const dayName = days[date.getDay()];
              if (date > now && (!strategy.dayOfWeek || strategy.dayOfWeek === dayName)) {
                dates.push(date);
                weeklyCount++;
              }
            }
            break;

          case 'MONTHLY':
            const currentMonth = now.getMonth();
            const maxMonths = Math.min(maxOccurrences, 3);
            for (let i = 0; i < maxMonths; i++) {
              const date = new Date();
              date.setMonth(currentMonth + i);
              date.setDate(1);
              date.setHours(recurHours, recurMinutes, 0, 0);

              if (date > now) {
                dates.push(date);
              }
            }
            break;
        }
        break;
    }
  }

  return dates;
}

export async function processReminders(): Promise<Array<{id: number, pending: any}>> {
  const now = new Date();
  const fiveMinutesAgo = new Date(now);
  fiveMinutesAgo.setMinutes(now.getMinutes() - 5);

  const dueReminders = await prisma.reminder.findMany({
    where: {
      scheduledFor: {
        gte: fiveMinutesAgo,
        lte: now
      },
      sent: false
    },
    include: {
      pending: {
        include: {
          user: {
            select: { id: true, name: true, phone: true }
          },
          pet: {
            select: { id: true, name: true }
          }
        }
      }
    }
  });

  const processedReminders = [];

  for (const reminder of dueReminders) {
    try {
      await sendReminderNotification(reminder);
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { sent: true }
      });
      processedReminders.push({
        id: reminder.id,
        pending: {
          id: reminder.pending.id,
          title: reminder.pending.title
        }
      });
    } catch (error) {
      console.error(`Error enviando recordatorio ${reminder.id}:`, error);
    }
  }

  return processedReminders;
}

// Envío de notificaciones
async function sendReminderNotification(reminder: any): Promise<void> {
  const pending = reminder.pending;
  console.log(`Enviando recordatorio: ${pending.title}`);
  console.log(`Usuario: ${pending.user.name}, Teléfono: ${pending.user.phone}`);
  console.log(`Mascota: ${pending.pet.name}`);

}

export async function cancelRemindersForPending(pendingId: number): Promise<number> {
  const result = await prisma.reminder.deleteMany({
    where: {
      pendingId: pendingId,
      sent: false
    }
  });

  return result.count;
}

export async function reschedulePendingReminders(pendingId: number): Promise<void> {
  const pending = await prisma.pending.findUnique({
    where: { id: pendingId }
  });

  if (!pending) {
    throw new Error(`No se encontró la tarea con ID ${pendingId}`);
  }
  await scheduleRemindersForPending(pending);
}