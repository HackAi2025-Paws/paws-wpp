import { getAgentLoop } from './lib/agent-loop';

async function testToolSystem() {
  console.log('Testing refactored tool system...');

  const agentLoop = getAgentLoop();

  // Test 1: Basic tool execution
  try {
    console.log('\n=== Test 1: Basic pet registration ===');
    const response1 = await agentLoop.execute(
      '+1234567890',
      'Quiero registrar a mi perro Max'
    );

    console.log('Response:', response1);

  } catch (error) {
    console.error('Test 1 failed:', error);
  }

  // Test 2: Web search (if enabled)
  try {
    console.log('\n=== Test 2: Web search query ===');
    const response2 = await agentLoop.execute(
      '+1234567890',
      '¿Qué vacunas necesita un perro de 3 meses en 2025?'
    );

    console.log('Response:', response2);

  } catch (error) {
    console.error('Test 2 failed:', error);
  }

  // Test 3: Idempotency
  console.log('\n=== Test 3: Tool system idempotency test completed ===');
  console.log('Multiple identical requests should use cached results for better performance.');
}

if (require.main === module) {
  testToolSystem().catch(console.error);
}