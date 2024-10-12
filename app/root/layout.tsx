import MoblieNavBar from "@/components/MoblieNavBar";
import SideBar from "@/components/SideBar";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import Image from "next/image";
import React from "react";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const loggedIn = await getLoggedInUser();
  return (
    <main className="flex h-screen w-full font-inter">
      <SideBar user={loggedIn} />

      <div className="flex size-full flex-col">
        <div className="root-layout">
          <Image
            src="/icons/logo.svg"
            width={30}
            height={30}
            alt="logo image of the bank"
          />
          <div>
            <MoblieNavBar user={loggedIn} />
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
