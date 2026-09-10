import type { Metadata } from "next";
import Navbar from "./components/navbar";
import Footer from "./components/footer";
import { AuthProvider } from "./components/auth-provider";
import { WishlistProvider } from "./components/wishlist-provider";
import { CartProvider } from "./components/cart-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyShop",
  description: "Modern ecommerce website",
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
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}