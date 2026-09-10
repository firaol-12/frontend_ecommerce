"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import hero1 from "../assets/hero/1.png";
import hero2 from "../assets/hero/2.png";
import hero3 from "../assets/hero/3.png";
import hero4 from "../assets/hero/4.png";
import hero5 from "../assets/hero/5.png";
import hero6 from "../assets/hero/6.png";
import hero7 from "../assets/hero/7.png";

const slides = [
  {
    image: hero1,
    badge: "New season collection",
    heading: "Shop smart, live better.",
    text: "Discover premium essentials, trending gadgets, and everyday favorites curated for your lifestyle.",
  },
  {
    image: hero2,
    badge: "Featured favorites",
    heading: "Fresh picks, just for you.",
    text: "Hand-selected products from our newest arrivals, ready to ship today.",
  },
  {
    image: hero3,
    badge: "Trending now",
    heading: "Style that stands out.",
    text: "From must-have fashion to everyday carry — find your next favorite piece.",
  },
  {
    image: hero4,
    badge: "Big savings",
    heading: "Deals you don't want to miss.",
    text: "Exclusive offers and limited-time discounts on your favorite brands.",
  },
  {
    image: hero5,
    badge: "New arrivals",
    heading: "The latest, first.",
    text: "Be the first to shop our newest launches before they sell out.",
  },
  {
    image: hero6,
    badge: "Customer favorites",
    heading: "Loved by thousands.",
    text: "Top-rated products our community can't stop talking about.",
  },
  {
    image: hero7,
    badge: "For everyday life",
    heading: "Everything you need.",
    text: "Quality products for every moment — shop the collection today.",
  },
];

const AUTOPLAY_MS = 3000;

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((index: number) => {
    setCurrent((index + slides.length) % slides.length);
  }, []);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    if (paused) return;

    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [paused]);

  return (
    <section
      className="h-99/100 px-10 rounded-2xl mx-20  relative flex justify-between items-center overflow-hidden bg-slate-900 text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Background slides */}
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            index === current ? "opacity-100 z-0" : "opacity-0"
          }`}
        >
          <Image
            src={slide.image}
            alt={slide.heading}
            fill
            priority={index === 0}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/35" />
        </div>
      ))}

      {/* Left-side text that changes with the slide */}
      <div className="relative z-10 max-w-7xl px-6 py-24">
        <div className="max-w-xl">
          <p
            key={`badge-${current}`}
            className="mb-4 inline-block rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-slate-200"
          >
            {slides[current].badge}
          </p>
          <h1
            key={`heading-${current}`}
            className="hero-font text-4xl font-black leading-tight md:text-6xl"
          >
            {slides[current].heading}
          </h1>
          <p
            key={`text-${current}`}
            className="comfortaa mt-5 max-w-lg text-lg text-slate-300"
          >
            {slides[current].text}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/products"
              className="rounded-full bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Shop now
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/60 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Login
            </Link>
          </div>
        </div>
      </div>

      {/* Prev / next arrows (right side) */}
      <div className="absolute right-18 w-70 flex justify-between items-center bottom-6 z-20 flex gap-3">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous slide"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-xl text-black transition hover:bg-white"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next slide"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-xl text-black transition hover:bg-white"
        >
          ›
        </button>
      </div>

      {/* Dot indicators */}
      <div className="absolute right-37 bottom-9 z-20 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Go to slide ${index + 1}`}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              index === current ? "bg-white w-6" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </section>
  );
}