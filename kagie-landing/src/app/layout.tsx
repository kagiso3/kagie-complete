import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://kagie.app"),
  title: "Kagie | Your Future Starts With One Application",
  description: "Apply to South Africa’s universities, colleges, and TVET institutions from one powerful platform. Discover courses and keep your next chapter together with Kagie.",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kagie", statusBarStyle: "default" },
  openGraph: { title: "Your Future Starts With One Application | Kagie", description: "Your future. Our priority. Explore institutions, discover courses, and manage your application journey in one place.", url: "/", siteName: "Kagie", locale: "en_ZA", type: "website", images: [{ url: "/images/social-card.png", width: 1729, height: 910, alt: "Kagie student application platform" }] },
  twitter: { card: "summary_large_image", title: "Your Future Starts With One Application | Kagie", images: ["/images/social-card.png"] },
  icons: { icon: "/images/app-icon.png", apple: "/images/app-icon.png" },
};
export const viewport: Viewport = { themeColor: "#fd0505", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-ZA"><body>{children}</body></html>;
}
