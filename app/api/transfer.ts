import { NextRequest, NextResponse } from 'next/server';
import { transferFunds } from '@/lib/actions/transferFunds.actions';

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { senderId, recipientId, amount } = await req.json();

    // Call the transfer logic
    const result = await transferFunds({
      senderId,
      recipientId,
      amount,
    });

    // Handle errors from the transfer logic
    if (result.error) {
      return NextResponse.json({ message: result.error }, { status: 400 });
    }

    // Success response
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in transfer API:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
