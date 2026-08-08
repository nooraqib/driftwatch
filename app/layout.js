import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata = {
  title: "Driftwatch",
  description: "Dependabot for every API you depend on.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col font-sans bg-mkt-bg text-mkt-text"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
