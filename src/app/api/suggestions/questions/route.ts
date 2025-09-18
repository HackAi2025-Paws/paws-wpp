import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface VeterinarySuggestionsRequest {
  transcription: string;
  conversationContext?: string;
  petInfo?: {
    species?: 'CAT' | 'DOG';
    breed?: string;
    age?: string;
  };
}

interface Suggestion {
  id: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface VeterinarySuggestionsResponse {
  suggestions: Suggestion[];
  generatedAt: string;
  transcriptionLength: number;
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[VetQuestionsAPI] Missing ANTHROPIC_API_KEY environment variable');
      return NextResponse.json(
        {
          error: 'ANTHROPIC_API_KEY not configured. Please check your environment variables.'
        },
        { status: 500 }
      );
    }

    const body: VeterinarySuggestionsRequest = await request.json();
    const { transcription, conversationContext, petInfo } = body;

    if (!transcription || !transcription.trim()) {
      return NextResponse.json(
        { error: 'Transcription is required' },
        { status: 400 }
      );
    }

    // Crear cliente de Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const suggestionsPrompt = `Eres un asistente veterinario experto que ayuda a veterinarios durante consultas con mascotas en tiempo real.

    Tu tarea es generar preguntas y consideraciones que el veterinario debería tener en cuenta durante la consulta basadas en la transcripción actual.

    CATEGORÍAS DE PREGUNTAS:
    - "symptoms": Preguntas sobre síntomas específicos observados
    - "history": Preguntas sobre historia clínica, vacunas, tratamientos previos
    - "examination": Preguntas relacionadas con el examen físico de la mascota
    - "behavior": Preguntas sobre cambios de comportamiento
    - "nutrition": Preguntas sobre alimentación y hábitos dietéticos
    - "environment": Preguntas sobre el entorno y estilo de vida de la mascota
    - "timeline": Preguntas sobre cuándo comenzaron los síntomas
    - "severity": Preguntas sobre la intensidad o progresión de los síntomas
    - "triggers": Preguntas sobre posibles factores desencadenantes

    PRIORIDADES:
    - "high": Preguntas críticas para el diagnóstico o la seguridad de la mascota
    - "medium": Preguntas importantes para completar el cuadro clínico
    - "low": Preguntas útiles pero complementarias

    INSTRUCCIONES ESPECÍFICAS:
    - Genera entre 4-6 sugerencias relevantes
    - Enfócate en información que AÚN NO ha sido mencionada en la transcripción
    - Las preguntas deben ser directas, claras y específicas para consultas veterinarias
    - Considera las diferencias entre especies (gato vs perro) si se proporciona esa información
    - Prioriza preguntas que ayuden a descartar diagnósticos diferenciales veterinarios
    - Evita preguntas genéricas, sé específico según el contexto clínico veterinario

    FORMATO DE RESPUESTA:
    Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta:
    {
      "suggestions": [
        {
          "text": "Pregunta o consideración específica aquí",
          "priority": "high" | "medium" | "low",
          "category": "categoria_aqui"
        }
      ]
    }

    No incluyas bloques de código markdown, explicaciones adicionales, solo el JSON puro.`;

    console.log('[VetQuestionsAPI] Generando preguntas veterinarias para transcripción de', transcription.length, 'caracteres');

    // Preparar contexto para Claude
    let contextText = `TRANSCRIPCIÓN ACTUAL:\n${transcription}`;

    if (conversationContext) {
      contextText += `\n\nCONTEXTO ADICIONAL:\n${conversationContext}`;
    }

    if (petInfo) {
      contextText += `\n\nINFORMACIÓN DE LA MASCOTA:`;
      if (petInfo.species) contextText += `\n- Especie: ${petInfo.species}`;
      if (petInfo.breed) contextText += `\n- Raza: ${petInfo.breed}`;
      if (petInfo.age) contextText += `\n- Edad: ${petInfo.age}`;
    }

    // Llamada a Claude para generar sugerencias
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      system: suggestionsPrompt,
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: contextText
        }
      ]
    });

    const aiResponse = claudeResponse.content[0]?.type === 'text' ? claudeResponse.content[0].text : null;

    if (!aiResponse) {
      throw new Error('No se recibió respuesta de Claude');
    }

    console.log('[VetQuestionsAPI] Procesando respuesta de preguntas veterinarias...');

    // Limpiar la respuesta de Claude
    let cleanedResponse = aiResponse.trim();

    // Si la respuesta está envuelta en bloques de código markdown, extraer el contenido
    const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
    const match = cleanedResponse.match(jsonBlockRegex);
    if (match) {
      cleanedResponse = match[1].trim();
      console.log('[VetQuestionsAPI] JSON extraído de bloque markdown');
    }

    // Intentar parsear la respuesta JSON
    let parsedResponse: { suggestions: any[] };
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('[VetQuestionsAPI] Error parseando JSON de preguntas veterinarias:', parseError);
      console.error('[VetQuestionsAPI] Respuesta original:', aiResponse);

      // Fallback: generar sugerencias básicas veterinarias
      parsedResponse = {
        suggestions: [
          {
            text: "¿Ha notado algún cambio en el apetito o consumo de agua de su mascota?",
            priority: "medium",
            category: "symptoms"
          },
          {
            text: "¿Cuándo fue la última vez que recibió vacunas?",
            priority: "medium",
            category: "history"
          },
          {
            text: "Examinar las encías y mucosas para verificar coloración",
            priority: "high",
            category: "examination"
          },
          {
            text: "¿Cuándo comenzaron a aparecer estos síntomas?",
            priority: "high",
            category: "timeline"
          }
        ]
      };
    }

    // Procesar y validar sugerencias veterinarias
    const suggestions: Suggestion[] = parsedResponse.suggestions
      .filter(suggestion => suggestion.text && suggestion.text.trim()) // Filtrar sugerencias vacías
      .slice(0, 6) // Máximo 6 sugerencias
      .map((suggestion, index) => ({
        id: `vet_suggestion_${Date.now()}_${index}`,
        text: suggestion.text.trim(),
        priority: ['high', 'medium', 'low'].includes(suggestion.priority) ? suggestion.priority : 'medium',
        category: suggestion.category || 'general'
      }));

    console.log('[VetQuestionsAPI] Preguntas veterinarias generadas exitosamente:', suggestions.length);

    const response: VeterinarySuggestionsResponse = {
      suggestions,
      generatedAt: new Date().toISOString(),
      transcriptionLength: transcription.length
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[VetQuestionsAPI] Error generando preguntas veterinarias:', error);

    // Manejo específico de errores de Claude
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        { error: 'Invalid Anthropic API key configuration' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: 'Error interno del servidor al generar preguntas veterinarias',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Veterinary Questions API is running',
    endpoint: '/api/suggestions/questions',
    methods: ['POST'],
    description: 'Generate veterinary consultation questions using Claude AI',
    version: '2.0.0'
  });
}
