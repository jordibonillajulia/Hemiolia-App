import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request) {
  try {
    const { to, subject, text } = await request.json();

    // Configurem nodemailer amb les dades del servidor SMTP (ex: Gmail, hostalia, etc.)
    // Les credencials s'han de posar a l'arxiu .env.local
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Hemiòlia Produccions" <${process.env.SMTP_USER || 'info@hemiolia.cat'}>`,
      to,
      subject,
      text,
    };

    // Si no tenim configurat l'SMTP al .env.local, simplement fem un simulacre (mock) pel log
    if (!process.env.SMTP_USER) {
      console.log('--- SIMULACIÓ D\'ENVIAMENT DE CORREU ---');
      console.log(mailOptions);
      console.log('------------------------------------------');
      return NextResponse.json({ message: 'Simulació completada (falta config SMTP)' }, { status: 200 });
    }

    const info = await transporter.sendMail(mailOptions);
    return NextResponse.json({ message: 'Correu enviat correctament', infoId: info.messageId }, { status: 200 });
    
  } catch (error) {
    console.error('Error enviant el correu:', error);
    return NextResponse.json({ error: 'Error intern enviant el correu' }, { status: 500 });
  }
}
