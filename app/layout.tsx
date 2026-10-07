import type { Metadata, Viewport } from "next";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import PwaRegister from "./components/pwa-register";
import { AuthProvider } from "./components/auth-provider";
import { WishlistProvider } from "./components/wishlist-provider";
import { CartProvider } from "./components/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Yayo",
    template: "%s | Yayo",
  },
  description: "Modern ecommerce website",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Yayo",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Navbar />
              <main className="min-h-screen">{children}</main>
              <Footer />
              <PwaRegister />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}