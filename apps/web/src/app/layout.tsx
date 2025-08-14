import "./globals.css";

export const metadata = {
  title: "PerpMate Dashboard",
  description: "AI-powered cross-chain trading dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
