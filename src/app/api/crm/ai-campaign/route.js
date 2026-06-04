import { NextResponse } from 'next/server';
import { verifySessionOrToken } from '@/lib/serverAuth';

export async function POST(request) {
  try {
    // Verify authorization
    const session = await verifySessionOrToken(request, ['admin', 'crm']);
    if (!session) {
      return NextResponse.json({ error: 'No autoritzat' }, { status: 401 });
    }

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
2. What the email is about (e.g. "felicitar el Nadal i oferir un descompte", "demanar si estan interessats en Cavernus").

You must construct the email content using EXCLUSIVELY the show information listed below from our official website "hemiolia.cat", combined with any additional information the user might facilitate directly in their prompt. Do not invent details about the shows.

Official Shows and Dossiers from hemiolia.cat:
1. Layla, un viatge d'esperança:
   - Description: Un espectacle reflexiu sobre la immigració i la migració forçada que fusiona música en viu de Manuel de Falla, sintetitzadors electrònics de gran actualitat i projeccions audiovisuals sincronitzades al detall.
   - Dossier: +Info (CAT) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_+INFO_CAT.pdf)
   - Dossier: +Info (ES) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_+INFO_CAS.pdf)
   - Dossier: +Info (EN) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_+INFO_EN.pdf)

2. Layla, el contacontes:
   - Description: Contacontes musical per a gaudir en família. Cadascuna de les precioses il·lustracions del llibre va acompanyada de fragments musicals interpretats en directe per fer viatjar la imaginació dels més petits. Per mitjà de la música de Manuel de Falla i les tendres il·lustracions del conte, plantegem una sessió educativa que ajuda a tractar temàtiques socials complexes com la migració, la tolerància i l'empatia intercultural, adaptat a edats primerenques.
   - Dossier: +Info (CAT) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_CONTACONTES_+INFO_CAT.pdf)
   - Dossier: +Info (ES) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_CONTACONTES_+INFO_CAS.pdf)
   - Dossier: +Info (EN) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/LAYLA_CONTACONTES_+INFO_EN.pdf)
   - Dossier: Dossier Pedagògic (https://hemiolia.cat/DOSSIER%20PEDAGO%CC%80GIC/LAYLA_CONTACONTES%20-%20Dossier%20Pedago%CC%80gic.pdf)
   - Dossier: Guia Docent (https://hemiolia.cat/GUIA%20DOCENT/LAYLA_CONTACONTES%20-%20Guia%20docent.pdf)

3. Cavernus, una evolució musical:
   - Description: Un viatge en el temps sense paraules i amb molt d'humor a càrrec de dos cavernícoles que repassen la història de la música universal. Una combinació sorprenent, teatral i completament interactiva. L'espectacle repassa els moments clau del desenvolupament històric de la música en un to humorístic, ideal per a alumnes de primària i secundària. Els materials docents estan pensats per a treballar a l'aula aspectes d'història de la música, instrumentació i expressió corporal.
   - Dossier: +Info (CAT) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/CAVERNUS_+INFO_CAT.pdf)
   - Dossier: +Info (ES) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/CAVERNUS_+INFO_CAS.pdf)
   - Dossier: +Info (EN) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/CAVERNUS_+INFO_EN.pdf)
   - Dossier: Dossier Pedagògic (https://hemiolia.cat/DOSSIER%20PEDAGO%CC%80GIC/CAVERNUS%20-%20Dossier%20Pedago%CC%80gic.pdf)
   - Dossier: Guia Docent (https://hemiolia.cat/GUIA%20DOCENT/CAVERNUS%20-%20Guia%20docent.pdf)

4. Un Nadal Màgic:
   - Description: La Nora i en Pau viuran una gran aventura musical a la recerca de la màgia del Nadal i de la música, després d'un imprevist al poble de muntanya dels Ports de Tortosa-Beseit. Espectacle familiar. El material docent d'aquest concert familiar ofereix activitats musicals de caràcter nadalenc i tradicional. Es treballen cantates, percussió corporal i contes educatius basats en la història teatral dels ports de Tortosa-Beseit.
   - Dossier: +Info (CAT) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/UN_NADAL_MAGIC_+INFO_CAT.pdf)
   - Dossier: Dossier Pedagògic (https://hemiolia.cat/DOSSIER%20PEDAGO%CC%80GIC/UN_NADAL_MA%CC%80GIC%20-%20Dossier%20Pedago%CC%80gic.pdf)
   - Dossier: Guia Docent (https://hemiolia.cat/GUIA%20DOCENT/UN_NADAL_MA%CC%80GIC%20-%20Guia%20docent.pdf)

5. Silencis Trencats:
   - Description: Espectacle compromès amb la violència en la societat a partir de la música de J.S. Bach. Una deconstrucció musical innovadora fusionant instruments acústics tradicionals i sons electrònics industrials.
   - Dossier: +Info (CAT) (https://hemiolia.cat/+%20INFO%20ESPECTACLE/SILENCIS%20TRENCATS%20-%20+INFO_CAT-1.pdf)

Espectacles en via de creació (En desenvolupament):
6. El petit Leonardo:
   - Description: La curiositat extrema i la creativitat aclaparadora que li brollaven des de ben petit, van portar a Leonardo da Vinci a convertir-se en un dels més grans artistes que ha conegut la humanitat.
7. Simfonia Corporativa (Unint música i negocis):
   - Description: Conferència-espectacle on es pretén demostrar de manera interactiva i entretinguda com les habilitats musicals es tradueixen en competències empresarials essencials, com la col·laboració, la comunicació i el lideratge.

If the user's prompt mentions or implies sending or attaching one or more of these dossiers (e.g. "envia el dossier de Silencis Trencats" or "passa el dossier de Cavernus"), select them and include them in the "suggestedAttachments" array.

You must return a valid JSON object containing:
- "matchedContactIds": an array of contact ID strings that match the query filters.
- "subject": a suggested, compelling email subject line.
- "body": a suggested email body written in a professional, warm, and appropriate tone (usually in Catalan). 
  Important: the body MUST contain the placeholders "{nom}" (for the contact's name) and "{entitat}" (for the entity name) to allow automatic personalization.
  You must always end the body with this exact signature block: "Atentament,\n\nHEMIÒLIA\nPaula Martí i Jordi Bonilla\n619579935 - 639966697".
  Do not mention specific dates or events unless requested. Keep it elegant.
- "suggestedAttachments": an array of objects representing the matched dossiers, e.g. [{"name": "Cavernus +Info (CAT)", "url": "https://hemiolia.cat/+%20INFO%20ESPECTACLE/CAVERNUS_+INFO_CAT.pdf"}]. If no dossiers are requested, return an empty array.
- "includeOtherContacts": a boolean indicating if the user's prompt requests to send to, copy, or include other contacts, secondary contacts, or all contacts of the contact record/sheet (e.g. "tots els contactes", "altres contactes", "contacte 2, 3 i 4").

Return ONLY a valid JSON object of the form:
{
  "matchedContactIds": ["id1", "id2", ...],
  "subject": "Suggested Subject Line",
  "body": "Hola {nom},\\n\\nEns posem en contacte amb {entitat}...\\n\\nAtentament,\\n\\nHEMIÒLIA\\nPaula Martí i Jordi Bonilla\\n619579935 - 639966697",
  "suggestedAttachments": [],
  "includeOtherContacts": false
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
    
    let result = { matchedContactIds: [], subject: '', body: '', suggestedAttachments: [], includeOtherContacts: false };
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
      body: result.body || "Hola {nom},\n\n...",
      suggestedAttachments: result.suggestedAttachments || [],
      includeOtherContacts: !!(result.includeOtherContacts || result.include_other_contacts)
    });
  } catch (error) {
    console.error("AI campaign route error:", error);
    return NextResponse.json({ error: error.message || 'Error de xarxa' }, { status: 500 });
  }
}
