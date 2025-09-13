#!/usr/bin/env node

import { AgentService } from './lib/agent-service';

async function testAgent() {
  console.log('Testing Claude WhatsApp Agent...\n');

  const testPhone = '+1234567890';

  const testMessages = [
    'Hola, me llamo María y quiero registrarme',
    '¿Cuáles son mis mascotas?',
    'Quiero registrar mi perro Luna que nació el 15 de enero de 2022',
    'Tengo un gato que se llama Michi de 2 años',
    'Registrar mi gatita Fluffy pero no sé cuándo nació',
    'Mi cachorro Rocky tiene 8 meses'
  ];

  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`Test ${i + 1}: "${message}"`);

    try {
      const response = await AgentService.processUserMessage(testPhone, message);
      console.log(`Response: ${response}`);
    } catch (error) {
      console.error(`Error: ${error}`);
    }

    console.log('---');
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testAgent().catch(console.error);
}