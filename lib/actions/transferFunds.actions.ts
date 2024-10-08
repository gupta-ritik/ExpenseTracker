import { createAdminClient } from "../appwrite";
import { ID, Query } from "node-appwrite";
import { parseStringify } from "../utils";
import { getUserInfo } from "./user.actions";


const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
} = process.env;

export const transferFunds = async ({ senderId, recipientId, amount }) => {
  try {
    const { database } = await createAdminClient();

    // 1. Fetch sender and recipient user data
    const sender = await getUserInfo({ userId: senderId });
    const recipient = await getUserInfo({ userId: recipientId });

    if (!sender || !recipient) {
      throw new Error("Sender or recipient not found.");
    }

    // 2. Ensure the sender has sufficient balance
    if (sender.balance < amount) {
      throw new Error("Insufficient balance.");
    }

    // 3. Update both sender’s and recipient’s balances using database transactions
    await database.updateDocument(DATABASE_ID!, USER_COLLECTION_ID!, sender.$id, {
      balance: sender.balance - amount,
    });

    await database.updateDocument(DATABASE_ID!, USER_COLLECTION_ID!, recipient.$id, {
      balance: recipient.balance + amount,
    });

    // 4. Log the transaction in the transaction collection
    await database.createDocument(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      ID.unique(),
      {
        senderId: sender.$id,
        recipientId: recipient.$id,
        amount,
        timestamp: new Date().toISOString(),
      }
    );

    return parseStringify({ message: "Transfer successful" });
  } catch (error) {
    console.error("Error transferring funds:", error);
    return { error: error.message };
  }
};
