import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import clientPromise from '@/lib/mongodb'
import { signJWT } from '@/lib/jwt'

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address1: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().length(2, "State must be a 2-letter code"),
  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid postal code"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
  ssn: z.string().regex(/^\d{4}$/, "SSN must be the last 4 digits"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { firstName, lastName, address1, city, state, postalCode, dateOfBirth, ssn, email, password } = signupSchema.parse(body)

    const client = await clientPromise
    const db = client.db("auth_db")

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email })
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the user
    const result = await db.collection("users").insertOne({
      firstName,
      lastName,
      address1,
      city,
      state,
      postalCode,
      dateOfBirth,
      ssn,
      email,
      password: hashedPassword,
    })

    // Generate JWT
    const token = signJWT({ userId: result.insertedId.toString(), email })

    return NextResponse.json({ token }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error(error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}