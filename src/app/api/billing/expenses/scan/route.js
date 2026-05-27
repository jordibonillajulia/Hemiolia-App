import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ 
        error: "Falta la clau d'API de Gemini (GEMINI_API_KEY) al fitxer .env.local. Si us plau, afegeix-la per poder utilitzar el lector de factures." 
      }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const owner = formData.get('owner') || 'Jordi'; // Jordi o Paula
    const year = formData.get('year') || '2026';
    const period = formData.get('period') || '1T';

    if (!file) {
      return NextResponse.json({ error: "No s'ha penjat cap fitxer de factura." }, { status: 400 });
    }

    // Convert file to array buffer and base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || 'application/pdf';

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `
Extract all relevant invoice data from the provided document image or PDF.
Return the result in a valid JSON object matching the following structure:
{
  "supplierNif": "NIF of the supplier/issuer (e.g. B12345678, clean uppercase, no spaces/hyphens)",
  "supplierName": "Name of the supplier (e.g. ENDESA)",
  "dateExp": "Invoice date in YYYY-MM-DD format",
  "invoiceNumber": "Invoice number or identifier string",
  "base": 100.00, // Base imposable (amount before taxes) as float
  "vatPercent": 21, // VAT percentage as integer (can be 21, 10, 4, 0)
  "vatQuota": 21.00, // VAT quota as float
  "irpfPercent": 0, // IRPF retention percentage if applicable (typically 15, 7, 0)
  "irpfQuota": 0.00, // IRPF quota as float
  "total": 121.00, // Total invoice amount as float (base + vatQuota)
  "expenseConcept": "G08" // Suggested AEAT expense concept code:
                           // 'G01' for purchases, materials
                           // 'G05' for rentals
                           // 'G06' for repairs/maintenance
                           // 'G07' for professional services (consultants, managers, lawyers)
                           // 'G08' for utilities (water, electricity, gas, internet, phone)
                           // 'G12' for other deductible expenses (software, tools, other services)
}
Only return the raw JSON object. Do not include markdown code block formatting (like \`\`\`json).
`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de Gemini API (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResponse) {
      throw new Error("No s'ha rebut cap resposta de text del model de Gemini.");
    }

    // Parse the JSON returned by Gemini
    let extractedData;
    try {
      extractedData = JSON.parse(textResponse.trim());
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini:", textResponse);
      throw new Error("La resposta del model d'IA no tenia un format JSON vàlid.");
    }
    // Parse year and period from extracted invoice date
    let extYear = year;
    let extPeriod = period;
    if (extractedData.dateExp && /^\d{4}-\d{2}-\d{2}$/.test(extractedData.dateExp)) {
      const dateParts = extractedData.dateExp.split('-');
      extYear = dateParts[0];
      const month = parseInt(dateParts[1], 10);
      if (month >= 1 && month <= 3) extPeriod = '1T';
      else if (month >= 4 && month <= 6) extPeriod = '2T';
      else if (month >= 7 && month <= 9) extPeriod = '3T';
      else if (month >= 10 && month <= 12) extPeriod = '4T';
    }

    // Determine target folder path
    // Sibling directory to the project folder, under /Users/hemiolia/Documents/ANTIGRAVITY
    const parentDir = '/Users/hemiolia/Documents/ANTIGRAVITY';
    const folderName = `despeses ${owner}`;
    const subfolderName = `${extYear}-${extPeriod}`;
    const targetDir = path.join(parentDir, folderName, subfolderName);
    // Generate filename: YYYYMMDD_[NIF]_[Name].[ext]
    const ext = path.extname(file.name) || (mimeType === 'application/pdf' ? '.pdf' : '.jpg');
    const cleanDate = (extractedData.dateExp || '').replace(/-/g, '');
    const cleanNif = (extractedData.supplierNif || 'SENSE_NIF').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanName = (extractedData.supplierName || 'PROVEIDOR').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const finalFilename = `${cleanDate}_${cleanNif}_${cleanName}${ext}`;
    const targetFilePath = path.join(targetDir, finalFilename);

    // Create directory recursively and save file to local disk (optional fallback)
    let savedLocalPath = null;
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetFilePath, buffer);
      console.log(`Saved invoice locally to: ${targetFilePath}`);
      savedLocalPath = targetFilePath;
    } catch (fsErr) {
      console.warn("Could not save invoice locally (running on mobile/non-local context):", fsErr);
    }

    // Return the response
    return NextResponse.json({
      success: true,
      data: extractedData,
      detectedYear: extYear,
      detectedPeriod: extPeriod,
      savedPath: savedLocalPath,
      savedFilename: finalFilename
    });
  } catch (err) {
    console.error("Error in expense scanner route:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
