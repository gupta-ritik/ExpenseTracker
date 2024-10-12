import HeaderBox from "@/components/HeaderBox";
import PaymentTransferForm from "@/components/PaymentTransferForm";
import { getAccounts } from "@/lib/actions/bank.actions";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import React from "react";

const Transfer = async () => {
  const loggedIn = await getLoggedInUser();

  // Check if user is logged in
  if (!loggedIn) {
    // Handle the case when no user is logged in
    return (
      <section className="payment-transfer">
        <HeaderBox
          title="Payment Transfer"
          subtext="You need to be logged in to make a transfer"
        />
      </section>
    );
  }

  // Proceed only if the user is logged in and has a valid $id
  const accounts = await getAccounts({
    userId: loggedIn.$id,
  });

  if (!accounts) {
    // Handle the case when there are no accounts
    return (
      <section className="payment-transfer">
        <HeaderBox
          title="Payment Transfer"
          subtext="No accounts available for this user"
        />
      </section>
    );
  }

  const accountsData = accounts?.data;

  return (
    <section className="payment-transfer">
      <HeaderBox
        title="Payment Transfer"
        subtext="Please provide any specific details or notes related to the payment transfer"
      />

      <section className="size-full pt-5">
        <PaymentTransferForm accounts={accountsData} />
      </section>
    </section>
  );
};

export default Transfer;
