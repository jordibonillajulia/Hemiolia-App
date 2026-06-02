import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { userPrompt, contacts } = await request.json();
    if (!userPrompt) {
      return NextResponse.json({ error: 'El prompt és obligatori.' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in the environment");
      return NextResponse.json({ error: 'La IA no està configurada.' }, { status: 500 });
    }

    // Simplify contacts to reduce token usage
    const simplifiedContacts = contacts.map(c => ({
      id: c.id,
      entity: c.entity || '',
      municipality: c.municipality || '',
      province: c.province || '',
      status: c.status || '',
      notes: c.notes ? (c.notes.length > 200 ? c.notes.substring(0, 200) + '...' : c.notes) : '',
      feedbackSummary: c.feedbackSummary ? (c.feedbackSummary.length > 150 ? c.feedbackSummary.substring(0, 150) + '...' : c.feedbackSummary) : '',
      mood: c.mood || '',
      interestedShows: c.interestedShows || [],
      performedShows: c.performedShows || []
    }));

    const systemPrompt = `You are an AI Email Campaign Assistant for "Hemiòlia Produccions", a music and theater production company.
You must analyze the user's natural language request (usually in Catalan) which describes:
1. Who should receive the email (e.g. "contactes de Girona", "els que hagin contractat Cavernus", "aquells amb estat 'Entrevista pendent'").
2. What the email is about (e.g. "felicitar el Nadal i oferir un descompte", "demanar si estan interessats en Marcel").

You must return a valid JSON object containing:
- "matchedContactIds": an array of contact ID strings that match the query filters.
- "subject": a suggested, compelling email subject line.
- "body": a suggested email body written in a professional, warm, and appropriate tone (usually in Catalan). 
  Important: the body MUST contain the placeholders "{nom}" (for the contact's name) and "{entitat}" (for the entity name) to allow automatic personalization.
  Do not mention specific dates or events unless requested. Keep it elegant.

Return ONLY a valid JSON object of the form:
{
  "matchedContactIds": ["id1", "id2", ...],
  "subject": "Suggested Subject Line",
  "body": "Hola {nom},\\n\\nEns posem en contacte amb {entitat}...\\n\\nAtentament,\\nL'equip d'Hemiòlia."
}
Do not include markdown wrappers (like \`\`\`json) outside the JSON. Return only the raw JSON string.`;

    const promptText = `User Prompt/Instructions: "${userPrompt}"

Contacts list:
${JSON.stringify(simplifiedContacts)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + "\n\n" + promptText }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error in Campaign Builder:", errText);
      return NextResponse.json({ error: 'Error del servei de la IA.' }, { status: 502 });
    }

    const resData = await response.json();
    const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    let result = { matchedContactIds: [], subject: '', body: '' };
    try {
      const cleanText = textResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      result = JSON.parse(cleanText);
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini Campaign builder:", textResponse, e);
      return NextResponse.json({ error: 'La resposta de la IA no s\'ha pogut processar com a JSON.' }, { status: 500 });
    }

    return NextResponse.json({
      matchedContactIds: result.matchedContactIds || result.matched_ids || [],
      subject: result.subject || "Salutacions des d'Hemiòlia Produccions",
      body: result.body || "Hola {nom},\n\n..."
    });
  } catch (error) {
    console.error("AI campaign route error:", error);
    return NextResponse.json({ error: error.message || 'Error de xarxa' }, { status: 500 });
  }
}
