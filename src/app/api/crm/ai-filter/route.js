import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { query: userQuery, contacts } = await request.json();
    if (!userQuery) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined in the environment");
      return NextResponse.json({ error: 'AI Filter is not configured' }, { status: 500 });
    }

    // Simplify contacts to reduce token size and focus on relevant search fields
    const simplifiedContacts = contacts.map(c => ({
      id: c.id,
      entity: c.entity || '',
      municipality: c.municipality || '',
      province: c.province || '',
      status: c.status || '',
      notes: c.notes ? (c.notes.length > 300 ? c.notes.substring(0, 300) + '...' : c.notes) : '',
      feedbackSummary: c.feedbackSummary ? (c.feedbackSummary.length > 200 ? c.feedbackSummary.substring(0, 200) + '...' : c.feedbackSummary) : '',
      mood: c.mood || '',
      interestedShows: c.interestedShows || [],
      performedShows: c.performedShows || [],
      nextActionNotes: c.nextActionNotes ? (c.nextActionNotes.length > 150 ? c.nextActionNotes.substring(0, 150) + '...' : c.nextActionNotes) : '',
      nextActionDate: c.nextActionDate || ''
    }));

    const systemPrompt = `You are a CRM database filter assistant.
Your task is to filter a list of contacts based on a natural language query.
Analyze the user's request (often in Catalan or Spanish) and return a list of contact IDs that match the request.

How to match mood and preferences:
- "agradat" / "ha anat bé" / "positiu": mood is 'molt_be' or 'be', or notes indicate liking the show.
- "no ha agradat" / "negatiu" / "no interessa": mood is 'malament'.
- "entrevista feta": status is "Entrevista feta".
- "espectacle cavernus" / "cavernus": check performedShows, interestedShows, notes, or feedbackSummary for "Cavernus".

Return ONLY a valid JSON object of the form:
{
  "matchedIds": ["id1", "id2", ...]
}
Do not include any extra text or comments outside the JSON object.`;

    const prompt = `User Query: "${userQuery}"

Contacts list:
${JSON.stringify(simplifiedContacts)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + "\n\n" + prompt }],
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
      console.error("Gemini API error response:", errText);
      try {
        const parsedErr = JSON.parse(errText);
        if (parsedErr.error?.message?.includes("RESOURCE_EXHAUSTED") || parsedErr.error?.code === 429) {
          return NextResponse.json({ error: 'La quota de la IA s\'ha esgotat temporalment. Si us plau, torna-ho a intentar en uns segons.' }, { status: 429 });
        }
        if (parsedErr.error?.status === "UNAVAILABLE" || parsedErr.error?.code === 503) {
          return NextResponse.json({ error: 'El servei de la IA no està disponible actualment per alta demanda. Torna-ho a provar en uns instants.' }, { status: 503 });
        }
        return NextResponse.json({ error: parsedErr.error?.message || 'Error de la IA' }, { status: 502 });
      } catch (e) {
        return NextResponse.json({ error: `Error del servidor de Gemini (${response.status})` }, { status: 502 });
      }
    }

    const resData = await response.json();
    const textResponse = resData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    let matchedIds = [];
    try {
      const cleanText = textResponse.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      const result = JSON.parse(cleanText);
      matchedIds = result.matchedIds || result.matched_ids || result.ids || [];
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini:", textResponse, e);
      // Fallback: extract 20-character alphanumeric strings (standard Firestore IDs)
      matchedIds = textResponse.match(/\b[A-Za-z0-9]{20}\b/g) || [];
    }

    return NextResponse.json({ matchedIds });
  } catch (error) {
    console.error("AI filter route error:", error);
    return NextResponse.json({ error: error.message || 'Error de xarxa' }, { status: 500 });
  }
}
