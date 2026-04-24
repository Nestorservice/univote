import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UNI-VOTE — Plateforme de Vote Institutionnelle",
  description:
    "Votez pour vos candidats préférés aux élections de votre université. Miss/Master Campus, Délégués, Awards et plus encore.",
  keywords: [
    "vote",
    "université",
    "cameroun",
    "élections",
    "campus",
    "miss",
    "master",
  ],
  authors: [{ name: "UNI-VOTE" }],
  openGraph: {
    title: "UNI-VOTE — Plateforme de Vote Institutionnelle",
    description:
      "Votez pour vos candidats préférés aux élections de votre université.",
    type: "website",
    locale: "fr_CM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
