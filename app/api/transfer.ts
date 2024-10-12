import { transferFunds } from "@/lib/actions/transferFunds.actions";

export default async function handler(req:Request , res:Request) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get the current session to ensure the user is authenticated
    const session = await getSession({req})

    if (!session) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientId, amount } = req.body;

    if (!recipientId || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid data' });
    }

    // Call the transfer logic
    const result = await transferFunds({
      senderId: session.user.id,
      recipientId,
      amount,
    });

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in transfer API:", error);
    return res.status(500).json({ message: 'Server error' });
  }
}
