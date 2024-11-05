"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { sendPasswordResetEmail } from "@/lib/actions/user.actions";
import Link from "next/link";
import Image from "next/image";

const forgotPasswordSchema = z.object({
    email: z.string().email("Invalid email address"),
});

const ForgotPassword = () => {
    const [isLoading, setIsLoading] = useState(false);
    const form = useForm<z.infer<typeof forgotPasswordSchema>>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSubmit = async (data: z.infer<typeof forgotPasswordSchema>) => {
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(data.email);
            alert("Password reset email sent!");
        } catch (error) {
            console.error(error);
            alert("Failed to send password reset email.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="auth-form" style={{ marginLeft: "200px", marginRight: "200px" }}>
            <header className="flex flex-col gap-5 md:gap-8">
                <Link href="/" className="cursor-pointer flex items-center gap-1">
                    <Image
                        src="/icons/logo.svg"
                        width={34}
                        height={34}
                        alt="Horizon logo"
                    />
                    <h1 className="text-26 font-ibm-plex-serif font-bold text-black-1">
                        Horizon
                    </h1>
                </Link>

                <div className="flex flex-col gap-1 md:gap-3">
                    <h1 className="text-24 lg:text-36 font-semibold text-gray-900">
                        Forgot Password?
                        <p className="text-16 font-normal text-gray-600">
                            Enter your email address and we'll send you a link to reset your password.
                        </p>
                    </h1>
                </div>
            </header>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <Input {...field} placeholder="Enter your email" className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" disabled={isLoading} className="w-full py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {isLoading ? "Sending..." : "Send Password Reset Email"}
                    </Button>
                </form>
            </Form>
            <footer className="flex justify-center gap-1">
                <p className="text-14 font-normal text-gray-600">
                    Remember your password?
                </p>
                <Link href="/sign-in" className="form-link">
                    Sign in
                </Link>
            </footer>
        </section>
    );
};

export default ForgotPassword;