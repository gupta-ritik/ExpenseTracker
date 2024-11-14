import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Link from "next/link";
import { Star, DollarSign, Info, Mail, LogIn, Menu } from "lucide-react"; // Import icons

export function SheetDemo() {
  return (
    <Sheet>
      <SheetTrigger asChild>
      <button>

            <Menu/> 
      </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>
            Use the links below to navigate through the site.
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col space-y-4 py-4 text-xl">
          <Link href="#features" passHref>
            <span className="flex items-center text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">
              <Star className="w-4 h-4 mr-2" /> Features
            </span>
          </Link>
          <Link href="#pricing" passHref>
            <span className="flex items-center text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">
              <DollarSign className="w-4 h-4 mr-2" /> Pricing
            </span>
          </Link>
          <Link href="#about" passHref>
            <span className="flex items-center text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">
              <Info className="w-4 h-4 mr-2" /> About
            </span>
          </Link>
          <Link href="#contact" passHref>
            <span className="flex items-center text-gray-700 hover:text-blue-500 transition duration-300 font-medium cursor-pointer">
              <Mail className="w-4 h-4 mr-2" /> Contact
            </span>
          </Link>
          <Link href="/sign-in" passHref>
            <button className="flex items-center bg-blue-500 text-white px-4 py-2 rounded font-medium transition duration-300 hover:bg-blue-600">
              <LogIn className="w-4 h-4 mr-2" /> Get Started
            </button>
          </Link>
        </nav>
        
      </SheetContent>
    </Sheet>
  );
}

export default SheetDemo;
