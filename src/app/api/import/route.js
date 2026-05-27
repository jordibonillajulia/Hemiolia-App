import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://www.hemiolia.cat/index.js');
    const text = await res.text();
    
    const startIndex = text.indexOf('const concerts = [');
    if (startIndex === -1) {
      throw new Error("No s'ha trobat la llista de concerts a la web.");
    }
    const endIndex = text.indexOf('];', startIndex) + 2;
    const arrayText = text.substring(startIndex, endIndex);
    
    // Executem en entorn Node.js per extreure l'array de manera segura
    const func = new Function(`
      ${arrayText}
      return concerts;
    `);
    const concerts = func();
    
    return NextResponse.json({ concerts });
  } catch (err) {
    console.error("Error al servidor:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
