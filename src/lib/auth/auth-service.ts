import { PrismaClient } from '@prisma/client';
import { randomInt } from 'crypto';
import { WhatsAppService } from '../twilio';
import {PhoneNormalizer} from "@/lib/phone-normalizer";

const prisma = new PrismaClient();

export class AuthService {

  async generateOTP(phone: string): Promise<{ success: boolean; otp?: string; error?: string }> {
    try {

      const normalizedPhone = PhoneNormalizer.normalize(phone);

      if (!normalizedPhone) {
        return {
          success: false,
          error: 'Número de teléfono inválido'
        };
      }

      const user = await prisma.user.findUnique({ where: { phone: normalizedPhone } });

      if (!user) {
        throw Error("Usuario desconocido")
      }

      const otp = randomInt(100000, 999999).toString();

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      await prisma.authToken.create({
        data: {
          token: otp,
          phone: normalizedPhone,
          userId: user.id,
          expiresAt,
          used: false
        }
      });

      if (process.env.WHATSAPP_TEMPLATE_OTP) {
        try {
          await WhatsAppService.sendTemplateMessage(
              normalizedPhone,
              process.env.WHATSAPP_TEMPLATE_OTP,
              [otp]
          );
          return {success: true};
        } catch (whatsappError) {
          console.warn('Error al enviar por WhatsApp, intentando SMS:', whatsappError);
        }
      }

      if (process.env.NODE_ENV === 'development') {
        return { success: true, otp };
      }

      return { success: true };
    } catch (error) {
      console.error('Error generando OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  async verifyOTPAndLogin(phone: string, token: string) {

    const normalizedPhone = PhoneNormalizer.normalize(phone);

    if (!normalizedPhone) {
      throw new Error('Número de teléfono inválido');
    }

    const authToken = await prisma.authToken.findFirst({
      where: {
        phone: normalizedPhone,
        token,
        used: false,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });

    if (!authToken) {
      throw new Error('Token inválido o expirado');
    }

    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { used: true }
    });

    return {
      user: authToken.user
    };
  }
}

export const authService = new AuthService();