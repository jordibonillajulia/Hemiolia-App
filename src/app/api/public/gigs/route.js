import { NextResponse } from 'next/server';
import { getUpcomingGigs } from '../../../../lib/firestoreUtils';

export async function GET() {
  try {
    // Aquesta API retorna els pròxims bolos per ser mostrats a la web www.hemiolia.cat
    const gigs = await getUpcomingGigs();
    
    // Podem filtrar per data per assegurar-nos que només enviem els bolos futurs
    const today = new Date().toISOString().split('T')[0];
    const futureGigs = gigs.filter(gig => gig.date >= today);

    // Només retornem informació pública (no enviem els telèfons privats)
    const publicGigs = futureGigs.map(gig => ({
      date: gig.date,
      title: gig.title,
      location: gig.locationName,
      municipality: gig.municipality
    }));

    // Afegim les capçaleres CORS perquè www.hemiolia.cat pugui fer la crida fetch()
    return NextResponse.json(publicGigs, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // O 'https://www.hemiolia.cat'
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error("Error fetching gigs for API:", error);
    return NextResponse.json({ error: "No s'han pogut carregar els bolos" }, { status: 500 });
  }
}
