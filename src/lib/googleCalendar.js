const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const admin = require('firebase-admin');

const certPath = path.join(process.cwd(), 'certs/google-service-account.json');
const CALENDAR_ID = 'hemioliaproduccions@gmail.com';

// Graceful check for service account credentials
const hasCredentials = () => {
  return fs.existsSync(certPath) || !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
};

// Initialize Google Calendar client using JWT authentication
const getCalendarClient = () => {
  if (!hasCredentials()) {
    console.warn("⚠️ Google Calendar Sync: Credentials file 'certs/google-service-account.json' or GOOGLE_SERVICE_ACCOUNT_JSON environment variable not found. Sync is disabled.");
    return null;
  }

  try {
    let creds;
    if (fs.existsSync(certPath)) {
      creds = JSON.parse(fs.readFileSync(certPath, 'utf8'));
    } else {
      creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    }
    const auth = new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
    return google.calendar({ version: 'v3', auth });
  } catch (error) {
    console.error("❌ Google Calendar Sync: Failed to parse credentials or initialize JWT Client:", error.message);
    return null;
  }
};

// Initialize Firestore Admin
const getFirestoreAdmin = () => {
  if (!admin.apps.length) {
    try {
      if (fs.existsSync(certPath)) {
        const creds = JSON.parse(fs.readFileSync(certPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(creds),
          projectId: creds.project_id
        });
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
          credential: admin.credential.cert(creds),
          projectId: creds.project_id
        });
      } else {
        admin.initializeApp();
      }
      console.log("✅ Firebase Admin initialized for Server-Side API.");
    } catch (error) {
      console.error("❌ Firebase Admin Initialization error:", error.message);
    }
  }
  return admin.firestore();
};

/**
 * Helper to parse a local date string (YYYY-MM-DD) and time string (HH:mm)
 * in a specific time zone (default Europe/Madrid) into a JavaScript Date object (UTC).
 */
function parseZonedDateTime(dateStr, timeStr, timeZone = 'Europe/Madrid') {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);

  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date(targetUtc));
  const p = {};
  parts.forEach(part => { if (part.type !== 'literal') p[part.type] = part.value; });

  const formattedHour = parseInt(p.hour, 10) % 24;

  const formattedAsUtc = Date.UTC(
    parseInt(p.year, 10),
    parseInt(p.month, 10) - 1,
    parseInt(p.day, 10),
    formattedHour,
    parseInt(p.minute, 10),
    parseInt(p.second, 10)
  );

  const offsetMs = formattedAsUtc - targetUtc;
  return new Date(targetUtc - offsetMs);
}

/**
 * Helper to get the next day's date string (YYYY-MM-DD) for Google Calendar all-day event end date (exclusive).
 */
function getNextDayStr(dateStr) {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split('T')[0];
}

/**
 * Sync a Road-sheet Gig (Bolo) to Google Calendar
 */
async function syncGig(gigId) {
  const calendar = getCalendarClient();
  if (!calendar) return { status: 'disabled', reason: 'no_credentials' };

  const db = getFirestoreAdmin();
  const docRef = db.collection('gigs').doc(gigId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.log(`Google Calendar Sync: Gig ${gigId} not found in database. Skipping.`);
    return { status: 'skipped', reason: 'not_found' };
  }

  const gig = docSnap.data();

  // If date is "a determinar", we delete the calendar event if it exists
  if (!gig.date || gig.date === 'a determinar') {
    if (gig.calendarEventId) {
      try {
        await calendar.events.delete({
          calendarId: CALENDAR_ID,
          eventId: gig.calendarEventId
        });
        await docRef.update({ calendarEventId: admin.firestore.FieldValue.delete() });
        console.log(`✅ Google Calendar: Deleted event for gig ${gigId} (date set to 'a determinar').`);
      } catch (err) {
        console.error(`Google Calendar Error deleting gig ${gigId}:`, err.message);
      }
    }
    return { status: 'deleted_due_to_tbd' };
  }

  // Construct Calendar Event fields
  const hasTime = gig.showTime && gig.showTime.trim() !== '' && gig.showTime !== 'a determinar' && gig.showTime.includes(':');
  const title = `${gig.title || ''}${gig.municipality ? ' - ' + gig.municipality : ''}${gig.showTime === 'a determinar' ? ' (Hora a determinar)' : ''}`;
  let location = '';
  if (gig.locationName && gig.address) {
    location = `${gig.locationName} (${gig.address})`;
  } else if (gig.locationName) {
    location = gig.locationName;
  } else if (gig.address) {
    location = gig.address;
  }
  
  let description = `🚐 LOGÍSTICA DE BOLO\n`;
  description += `---------------------------------\n`;
  description += `Espectacle: ${gig.title || 'Bolo'}\n`;
  description += `Municipi: ${gig.municipality || 'Sense especificar'}\n`;
  description += `Espai: ${gig.locationName || 'Sense especificar'}\n`;
  if (gig.address) description += `Adreça: ${gig.address}\n`;
  if (gig.contactPerson) description += `Persona Contacte: ${gig.contactPerson}\n`;
  if (gig.contactPhone) description += `Telèfon Contacte: ${gig.contactPhone}\n`;
  if (gig.scheduleDetails) {
    description += `\n⏰ HORARIS I DETALLS:\n${gig.scheduleDetails}\n`;
  }
  description += `---------------------------------\n`;
  description += `Bolo ID: ${gigId}\n`;
  description += `Estat de cobrament: ${gig.status || 'Pendent'}`;

  // Time details
  let start, end;
  if (hasTime) {
    const startDate = parseZonedDateTime(gig.date, gig.showTime.trim(), 'Europe/Madrid');
    
    // Add 2 hours duration by default
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    
    start = {
      dateTime: startDate.toISOString(),
      timeZone: 'Europe/Madrid'
    };
    end = {
      dateTime: endDate.toISOString(),
      timeZone: 'Europe/Madrid'
    };
  } else {
    // All-day event (Google Calendar API v3 requires end date to be exclusive, i.e. next day)
    start = {
      date: gig.date
    };
    end = {
      date: getNextDayStr(gig.date)
    };
  }

  const eventResource = {
    summary: title,
    location,
    description,
    start,
    end,
    colorId: '5', // Yellow for bolos
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 60 },
        { method: 'popup', minutes: 1440 } // 24 hours before
      ]
    }
  };

  try {
    if (gig.calendarEventId) {
      // Update existing event
      await calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: gig.calendarEventId,
        resource: eventResource
      });
      console.log(`✅ Google Calendar: Updated event ${gig.calendarEventId} for gig ${gigId}.`);
      return { status: 'updated', eventId: gig.calendarEventId };
    } else {
      // Create new event
      const res = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        resource: eventResource
      });
      const eventId = res.data.id;
      await docRef.update({ calendarEventId: eventId });
      console.log(`✅ Google Calendar: Created event ${eventId} for gig ${gigId}.`);
      return { status: 'created', eventId };
    }
  } catch (error) {
    console.error(`❌ Google Calendar Error syncing gig ${gigId}:`, error.message);
    return { status: 'error', message: error.message };
  }
}

/**
 * Delete a Gig (Bolo) from Google Calendar
 */
async function deleteGig(calendarEventId) {
  const calendar = getCalendarClient();
  if (!calendar || !calendarEventId) return { status: 'disabled' };

  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId: calendarEventId
    });
    console.log(`✅ Google Calendar: Deleted event ${calendarEventId}.`);
    return { status: 'deleted' };
  } catch (error) {
    console.error(`❌ Google Calendar Error deleting event ${calendarEventId}:`, error.message);
    return { status: 'error', message: error.message };
  }
}

/**
 * Sync a CRM Contact Reminder (Següent Acció) to Google Calendar
 */
async function syncReminder(contactId) {
  const calendar = getCalendarClient();
  if (!calendar) return { status: 'disabled', reason: 'no_credentials' };

  const db = getFirestoreAdmin();
  const docRef = db.collection('contacts').doc(contactId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.log(`Google Calendar Sync: Contact ${contactId} not found in database. Skipping.`);
    return { status: 'skipped', reason: 'not_found' };
  }

  const contact = docSnap.data();

  // If nextActionDate is empty, delete the calendar event if it exists
  if (!contact.nextActionDate) {
    if (contact.calendarEventId) {
      try {
        await calendar.events.delete({
          calendarId: CALENDAR_ID,
          eventId: contact.calendarEventId
        });
        await docRef.update({ calendarEventId: admin.firestore.FieldValue.delete() });
        console.log(`✅ Google Calendar: Deleted reminder event for contact ${contactId}.`);
      } catch (err) {
        console.error(`Google Calendar Error deleting reminder for contact ${contactId}:`, err.message);
      }
    }
    return { status: 'deleted_due_to_empty' };
  }

  // Construct Calendar Event fields
  const title = `🔔 CRM: ${contact.nextActionNotes || 'Seguiment'} - ${contact.municipality || ''}`;
  const location = contact.municipality || '';
  
  let description = `🔔 SEGUIMENT DE CRM (HEMIÒLIA)\n`;
  description += `---------------------------------\n`;
  description += `Municipi: ${contact.municipality || 'Sense especificar'}\n`;
  description += `Contacte: ${contact.name || 'Sense especificar'}\n`;
  if (contact.entity) description += `Entitat: ${contact.entity}\n`;
  if (contact.email) description += `Correu: ${contact.email}\n`;
  if (contact.phone) description += `Telèfon: ${contact.phone}\n`;
  description += `\n📝 ACCIÓ PROGRAMADA:\n${contact.nextActionNotes || 'Trucar/Enviar mail'}\n`;
  description += `---------------------------------\n`;
  description += `Contacte ID: ${contactId}\n`;
  description += `Accés al CRM: http://localhost:3000/dashboard/crm/${contactId}`;

  // All-day event on the reminder date
  const start = {
    date: contact.nextActionDate
  };
  const end = {
    date: getNextDayStr(contact.nextActionDate)
  };

  const eventResource = {
    summary: title,
    location,
    description,
    start,
    end,
    colorId: '6', // Tangerine/Orange for reminders
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 540 } // 9:00 AM on the day of reminder
      ]
    }
  };

  try {
    if (contact.calendarEventId) {
      // Update existing event
      await calendar.events.update({
        calendarId: CALENDAR_ID,
        eventId: contact.calendarEventId,
        resource: eventResource
      });
      console.log(`✅ Google Calendar: Updated reminder event ${contact.calendarEventId} for contact ${contactId}.`);
      return { status: 'updated', eventId: contact.calendarEventId };
    } else {
      // Create new event
      const res = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        resource: eventResource
      });
      const eventId = res.data.id;
      await docRef.update({ calendarEventId: eventId });
      console.log(`✅ Google Calendar: Created reminder event ${eventId} for contact ${contactId}.`);
      return { status: 'created', eventId };
    }
  } catch (error) {
    console.error(`❌ Google Calendar Error syncing reminder for contact ${contactId}:`, error.message);
    return { status: 'error', message: error.message };
  }
}

/**
 * Delete a Contact Reminder from Google Calendar
 */
async function deleteReminder(calendarEventId) {
  const calendar = getCalendarClient();
  if (!calendar || !calendarEventId) return { status: 'disabled' };

  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId: calendarEventId
    });
    console.log(`✅ Google Calendar: Deleted reminder event ${calendarEventId}.`);
    return { status: 'deleted' };
  } catch (error) {
    console.error(`❌ Google Calendar Error deleting reminder event ${calendarEventId}:`, error.message);
    return { status: 'error', message: error.message };
  }
}

module.exports = {
  syncGig,
  deleteGig,
  syncReminder,
  deleteReminder,
  hasCredentials
};
