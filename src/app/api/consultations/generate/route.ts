import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

interface ConsultationGenerationRequest {
  transcription: string;
  conversationContext?: string;
  petInfo?: {
    species?: "CAT" | "DOG";
    breed?: string;
    age?: string;
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        "[VetQuestionsAPI] Missing ANTHROPIC_API_KEY environment variable"
      );
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY not configured. Please check your environment variables.",
        },
        { status: 500 }
      );
    }

    const body: ConsultationGenerationRequest = await request.json();
    const { transcription, conversationContext, petInfo } = body;

    if (!transcription || !transcription.trim()) {
      return NextResponse.json(
        { error: "Transcription is required" },
        { status: 400 }
      );
    }

    // Crear cliente de Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const vaccines = await prisma.vaccine.findMany({
      include: {
        catalog: true,
        pet: true,
      },
    });

    const consultationPrompt = `Eres un asistente veterinario que genera BORRADORES de campos clínicos a partir de la transcripción de la consulta. 
    Tu objetivo es completar ÚNICAMENTE los campos que rellena la IA y dejar fuera lo que completa el médico.

    ENTRADAS DISPONIBLES (contexto):
    - transcripción en tiempo real de la consulta
    - especie (perro/gato) si está disponible
    - señales clave (edad aproximada, sexo, peso, antecedentes si se mencionan)

    SALIDAS (SOLO CAMPOS IA):
    Debes devolver un JSON válido con exactamente estas claves y sin campos extra:
    {
    "chiefComplaint": string,            // MOTIVO (IA). Resumen breve y específico
    "findings": string,                  // HALLAZGOS (IA). Observaciones clínicas inferidas de lo dicho (no inventes examen físico)
    "diagnosis": string,                 // DIAGNÓSTICO (IA). Expresa en términos de "sospechas" y diferenciales, no afirmaciones absolutas
    "treatment": [                       // TRATAMIENTO (IA). SOLO nombres propuestos; el médico completará fechas
        { "name": string, "startDate": string }
    ],
    "vaccines": [                        // VACUNACIÓN (IA). SOLO tipo (enum). El médico completará fechas
        { "catalogId": string, "applicationDate": string }
    ],
    "nextSteps": string,                 // PRÓXIMOS PASOS (IA). Sugerencias accionables (p. ej., estudios, control, educación al tutor)
    "additionalNotes": string            // NOTAS (IA). Aclaraciones, supuestos, info faltante
    }

    REGLAS IMPORTANTES:
    - Lenguaje: español, clínico y conciso.
    - Basado EXCLUSIVAMENTE en la transcripción; no inventes datos no mencionados. Si falta info clave, indícalo en "additionalNotes" con el prefijo "Faltante:".
    - Adapta el contenido a la especie cuando sea posible (perro vs. gato).
    - En "diagnosis" usa formulaciones de probabilidad (p.ej., "sospecha de", "diferenciales: ...").
    - En "treatment" incluye SOLO el/los "name" (p.ej., "omeprazol 1 mg/kg cada 24 h", "dieta gastrointestinal"); NO incluyas dosis si no surge de la transcripción.
    - En "vaccines", "type" debe ser uno de los valores enumerados según especie. Si la especie no está clara, usa la categoría más general posible o deja el arreglo vacío.

    ENUM DE VACUNAS PERMITIDAS:
    - ${vaccines.toString()}

    VALIDACIÓN DE SALIDA:
    - Devuelve SOLO el JSON puro, sin texto adicional ni markdown.
    - Si algún campo no puede inferirse con seguridad, deja "" (cadena vacía) o [], y explica brevemente en "additionalNotes" qué falta para completarlo.

    Ahora, genera el JSON solicitado usando la transcripción proporcionada.`;

    console.log(
      "[VetQuestionsAPI] Generando preguntas veterinarias para transcripción de",
      transcription.length,
      "caracteres"
    );

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
      model: "claude-sonnet-4-20250514",
      system: consultationPrompt,
      max_tokens: 1000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: contextText,
        },
      ],
    });

    const aiResponse =
      claudeResponse.content[0]?.type === "text"
        ? claudeResponse.content[0].text
        : null;

    if (!aiResponse) {
      throw new Error("No se recibió respuesta de Claude");
    }

    console.log(
      "[VetQuestionsAPI] Procesando respuesta de preguntas veterinarias..."
    );

    // Limpiar la respuesta de Claude
    let cleanedResponse = aiResponse.trim();

    // Si la respuesta está envuelta en bloques de código markdown, extraer el contenido
    const jsonBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
    const match = cleanedResponse.match(jsonBlockRegex);
    if (match) {
      cleanedResponse = match[1].trim();
      console.log("[VetQuestionsAPI] JSON extraído de bloque markdown");
    }

    return NextResponse.json(JSON.parse(cleanedResponse));
  } catch (error) {
    console.error(
      "[VetQuestionsAPI] Error generando preguntas veterinarias:",
      error
    );

    // Manejo específico de errores de Claude
    if (error instanceof Error && error.message.includes("API key")) {
      return NextResponse.json(
        { error: "Invalid Anthropic API key configuration" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Error interno del servidor al generar preguntas veterinarias",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
