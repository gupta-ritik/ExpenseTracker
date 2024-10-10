import { transferFunds } from "@/lib/actions/transferFunds.actions";
import { NextResponse, NextRequest } from "next/server";
import { getSession } from "next-auth/react";

export async function POST(req: NextRequest) {
  try {
    // Get the current session to ensure the user is authenticated
    const session = await getSession({ req });

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const { recipientId, amount } = await req.json();

    if (!recipientId || !amount || amount <= 0) {
      return NextResponse.json({ message: 'Invalid data' }, { status: 400 });
    }

    // Call the transfer logic
    const result = await transferFunds({
      senderId: session.user.id,
      recipientId,
      amount,
    });

    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error in transfer API:", error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'GET working fine' }, { status: 405 });
}
