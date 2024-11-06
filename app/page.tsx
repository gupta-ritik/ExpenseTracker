'use client'

// pages/index.js
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { CardDemo } from './feature';
import Pricing from './plan';
import Footer from './footer';
import LocomotiveScroll from 'locomotive-scroll';
import Link from 'next/link';
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { motion } from 'framer-motion'
import SheetDemo from './sheet';
import { LogIn, Sheet } from 'lucide-react';

export default function Home() {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      const locomotiveScroll = new LocomotiveScroll({
        el: scrollRef.current,
        smooth: true,
        lerp: 0.1, // Adjust scroll speed, optional
        multiplier: 1.2, // Adjust scroll intensity, optional
      });

      return () => {
        locomotiveScroll.destroy();
      };
    }
  }, []);

  return (
    <div ref={scrollRef} data-scroll-container>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-md" data-scroll-section>
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Image
              src="/icons/logo.svg"
              width={34}
              height={34}
              alt="Horizon logo"
            />

            <span className="text-2xl font-bold text-gray-800">Expense Tracker</span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex space-x-6 items-center">
            <Link href="#features" passHref>
              <span className="text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">Features</span>
            </Link>
            <Link href="#pricing" passHref>
              <span className="text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">Pricing</span>
            </Link>
            <Link href="#about" passHref>
              <span className="text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">About</span>
            </Link>
            <Link href="#contact" passHref>
              <span className="text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">Contact</span>
            </Link>
            <Link href="/sign-in" passHref>
            <button className="flex items-center bg-blue-500 text-white px-4 py-2 rounded font-medium transition duration-300 hover:bg-blue-600">
              <LogIn className="w-4 h-4 mr-2" /> Get Started
            </button>
          </Link>
          </nav>
          <div className='md:hidden'>
           <SheetDemo/>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero py-5 flex items-center justify-center" data-scroll-section>
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-center text-center space-y-12 md:space-y-0 md:space-x-12">
          {/* Hero Content */}
          <div className="space-y-4 max-w-3xl" data-scroll>
            <div className="text-4xl md:text-6xl font-bold text-gray-800 leading-tight">
              <HeroHighlight>
                <motion.p
                  initial={{
                    opacity: 0,
                    y: 20,
                  }}
                  animate={{
                    opacity: 1,
                    y: [20, -5, 0],
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.4, 0.0, 0.2, 1],
                  }}
                  className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto "
                >

                  <Highlight className="text-black dark:text-white">
                    Track Your Expenses <span className="text-blue-500">Effortlessly</span>

                  </Highlight>
                </motion.p>
              </HeroHighlight>
            </div>
            <div >
              <p className="text-xl md:text text-gray-700 max-w-xl mx-auto">
                Discover a powerful, easy-to-use expense tracker designed to help you budget smarter and reach your financial goals faster.

              </p>
            </div>
            <div className="flex justify-center space-x-4 mt-6">
            <Link href="/sign-in" passHref>
            <button className="flex items-center bg-blue-500 text-white px-4 py-2 rounded font-medium transition duration-300 hover:bg-blue-600">
              <LogIn className="w-4 h-4 mr-2" /> Get Started
            </button>
          </Link>


            </div>
          </div>

          {/* Image */}
          <div className="">
            <div className="w-full  h-[40rem]   relative overflow-hidden bg-[url('/iphone.png')] bg-contain bg-center bg-no-repeat">
              <div className="absolute inset-0 bg-black opacity-20"></div> {/* Optional: Overlay for better text visibility */}
              <div className="relative py-24 text-center max-w-xs md:max-w-sm lg:max-w-md z-10">
                <div className="w-fit px-20 overflow-hidden ">
                  <Image
                    src="/Expense.jpg"
                    alt="expense"
                    width={500}
                    height={500}
                    className="w-full h-auto rounded mb-4"
                  />
                  <h2 className="text font-semibold mb-2 px-10">Expense Details</h2>
                  <p className="text-gray-700 px-2">
                    This expense was incurred for essential items needed for daily operations.
                    Careful tracking helps in budgeting effectively and understanding financial health.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CardDemo />
      <Pricing />

      <div className="border-t bg-gray-400" data-scroll-section>
        <Footer />
      </div>
    </div>
  );
} 