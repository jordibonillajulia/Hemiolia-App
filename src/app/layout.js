import { Playfair_Display, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../lib/AuthContext";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata = {
  title: "Hemiòlia Produccions - Gestió",
  description: "Eina unificada de gestió per a Hemiòlia Produccions",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hemiòlia Gestió",
  },
  icons: {
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#1d1d1f",
  width: "device-width",
  initialScale: 1,
};



export default function RootLayout({ children }) {
  return (
    <html lang="ca" className={`${playfair.variable} ${outfit.variable}`}>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
