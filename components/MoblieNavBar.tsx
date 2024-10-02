"use client";
import React from "react";
import {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { sidebarLinks } from "@/constants";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
// import Footer from "./Footer";
const MoblieNavBar = ({ user }: MobileNavProps) => {
  const pathname = usePathname;

  return (
    <section className="w-full max-w-[264px]">
      <Sheet>
        <SheetTrigger>
          <Image
            src="/icons/hamburger.svg"
            width={30}
            height={30}
            alt="hamburger icon"
            className="cursor-pointer"
          />
        </SheetTrigger>
        <SheetContent side="left" className="border-none bg-white">
          <Link href="/" className=" cursor-pointer  flex items-center gap-1">
            <Image src="/icons/logo.svg" width={34} height={34} alt="logo" />
            <h1 className="text-26 font-ibm-plex-serif text-black-1 font-extrabold">
              Expense
            </h1>
          </Link>
          <div className="moblienav-sheet">
            <SheetClose asChild>
              <nav className="flex h-full flex-col gap-5 pt-16 text-white">
                {sidebarLinks.map((link) => {
                  const isActive =
                    pathname() === link.route ||
                    pathname().startsWith(`${link.route}/`);

                  // pathname === link.route || pathname.startsWith(`${link.route}/`);

                  return (
                    <SheetClose asChild key={link.route}>
                      <Link
                        href={link.route}
                        key={link.label}
                        className={cn("moblienav-sheet_close w-full", {
                          "bg-bank-gradient": isActive,
                        })}
                      >
                        <Image
                          src={link.imgURL}
                          alt={link.label}
                          width={20}
                          height={20}
                          className={cn({
                            "brightness-[3] invert-0": isActive,
                          })}
                        />

                        <p
                          className={cn("text-16 font-semibold text-black-2", {
                            "text-white": isActive,
                          })}
                        >
                          {link.label}
                        </p>
                      </Link>
                    </SheetClose>
                  );
                })}
                {/* user data is show in the  */}
              </nav>
            </SheetClose>
            {/* <Footer user={user} type="mobile" />  */}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
};

export default MoblieNavBar;
