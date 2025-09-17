import { PrismaClient, UserRole } from '@prisma/client';
import { randomInt } from 'crypto';
import { WhatsAppService } from '../twilio';
import {PhoneNormalizer} from "@/lib/phone-normalizer";
import { prisma } from '../prisma';

export class AuthService {

  async registerVeterinarian(data: { name: string; phone: string }) {
    try {
      const normalizedPhone = PhoneNormalizer.normalize(data.phone);

      if (!normalizedPhone) {
        return {
          success: false,
          error: 'Número de teléfono inválido',
          statusCode: 400
        };
      }

      const existingUser = await prisma.user.findUnique({
        where: { phone: normalizedPhone }
      });

      if (existingUser) {
        return {
          success: false,
          error: 'Este número de teléfono ya está registrado',
          statusCode: 409
        };
      }

      const newUser = await prisma.user.create({
        data: {
          name: data.name,
          phone: normalizedPhone,
          role: UserRole.VETERINARIAN
        }
      });

      const otpResult = await this.generateOTP(normalizedPhone);

      if (!otpResult.success) {
        return {
          success: false,
          error: 'Error al generar código de verificación',
          statusCode: 500
        };
      }

      return {
        success: true,
        user: {
          id: newUser.id,
          name: newUser.name,
          phone: newUser.phone
        },
        otp: process.env.NODE_ENV === 'development' ? otpResult.otp : undefined
      };
    } catch (error) {
      console.error('Error al registrar veterinario:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        statusCode: 500
      };
    }
  }
  async generateOTP(phone: string): Promise<{ success: boolean; otp?: string; error?: string; errorType?: string }> {
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
        return {
          success: false,
          error: 'Usuario desconocido',
          errorType: 'NOT_FOUND'
        };
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

  async verifyOTPAndLogin(phone: string, token: string): Promise<
    | { success: true; user: any }
    | { success: false; error: string; statusCode: number }
  > {
    const normalizedPhone = PhoneNormalizer.normalize(phone);

    if (!normalizedPhone) {
      return {
        success: false,
        error: 'Número de teléfono inválido',
        statusCode: 400
      };
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
      return {
        success: false,
        error: 'Token inválido o expirado',
        statusCode: 401
      };
    }

    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { used: true }
    });

    return {
      success: true,
      user: authToken.user
    };
  }
}

export const authService = new AuthService();