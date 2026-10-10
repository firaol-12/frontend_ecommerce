import Link from "next/link"

export default function Footer() {
  return (
    <footer className="mt-12 bg-black px-8 py-8 text-white">
      <div className="flex justify-around w-full">
        <div className="w-1/3">
          <h2 className="text-xl font-bold">MyShop</h2>
          <p className="mt-2 text-gray-400">
            Quality products for everyone.
          </p>
        </div>

        <div className="w-1/3 flex flex-col items-start">
          <h3 className="font-semibold">Quick Links</h3>
          <Link href="/products" className="mt-2 text-gray-400">
            Products
          </Link>
          <Link href="/" className="text-gray-400">
            Home
          </Link>
          <Link href="/contact" className="text-gray-400">
            Contact
          </Link>
        </div>
      </div>

      <div className="mt-8 border-t border-gray-700 pt-4 text-center text-gray-400">
        © 2026 MyShop. All rights reserved.
      </div>
    </footer>
  )
}