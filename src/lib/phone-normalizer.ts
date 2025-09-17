import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

   export class PhoneNormalizer {
     /**
      * Normaliza un número de teléfono al formato E.164 (ej: +5491123456789)
      * @param phone Número de teléfono en cualquier formato
      * @param defaultCountry Código ISO de país por defecto si no se especifica (ej: 'AR')
      * @returns Número normalizado o null si no es válido
      */
     static normalize(phone: string, defaultCountry: CountryCode = 'AR'): string | null {
       try {
         const cleanPhone = phone.replace(/^whatsapp:/, '');

         const phoneNumber = parsePhoneNumberFromString(cleanPhone, defaultCountry);

         if (!phoneNumber || !phoneNumber.isValid()) {
           return null;
         }

         return phoneNumber.format('E.164');
       } catch (error) {
         console.error('Error al normalizar teléfono:', error);
         return null;
       }
     }

     /**
      * Formatea un número ya normalizado para mostrar al usuario
      */
     static formatForDisplay(normalizedPhone: string): string {
       try {
         const phoneNumber = parsePhoneNumberFromString(normalizedPhone);
         return phoneNumber ? phoneNumber.formatInternational() : normalizedPhone;
       } catch {
         return normalizedPhone;
       }
     }

     /**
      * Convierte un número normalizado al formato de WhatsApp
      */
     static toWhatsAppFormat(normalizedPhone: string): string {
       return normalizedPhone.startsWith('whatsapp:')
         ? normalizedPhone
         : `whatsapp:${normalizedPhone}`;
     }
   }