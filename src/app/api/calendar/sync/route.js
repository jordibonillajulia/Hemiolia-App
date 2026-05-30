import { NextResponse } from 'next/server';
const { syncGig, deleteGig, syncReminder, deleteReminder } = require('../../../../lib/googleCalendar');

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, id, action, calendarEventId } = body;

    if (!type || (!id && !calendarEventId)) {
      return NextResponse.json({ error: "Paràmetres 'type' i ('id' o 'calendarEventId') són obligatoris" }, { status: 400 });
    }

    let result = { status: 'noop' };

    if (type === 'gig') {
      if (action === 'delete' && calendarEventId) {
        result = await deleteGig(calendarEventId);
      } else if (id) {
        result = await syncGig(id);
      }
    } else if (type === 'reminder') {
      if (action === 'delete' && calendarEventId) {
        result = await deleteReminder(calendarEventId);
      } else if (id) {
        result = await syncReminder(id);
      }
    } else {
      return NextResponse.json({ error: "Tipus desconegut. Ha de ser 'gig' o 'reminder'" }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("❌ API Calendar Sync Error:", error);
    return NextResponse.json({ error: error.message || "Error intern en sincronitzar el calendari" }, { status: 500 });
  }
}
