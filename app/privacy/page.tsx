import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "SMS privacy" };

export default function Privacy() {
  return (
    <>
      <header className="nav landing-nav wrap">
        <Link href="/" className="brand">
          <span aria-hidden>₹</span> ExpenseTracker
        </Link>
      </header>
      <main className="wrap stack" id="main">
        <h1>SMS privacy</h1>
        <section className="panel stack">
          <h2>What the app reads</h2>
          <p>
            With your permission, the Android app checks incoming sender IDs on
            your phone and reads matching bank and payment alerts. It checks
            inbox senders only when you start an import. You can also paste an
            alert without granting SMS permissions.
          </p>
          <h2>What is sent and stored</h2>
          <p>
            The app discards verification messages, masks account and card
            numbers to their last four digits, and removes phone numbers, PAN
            and other identifiers. It keeps payment references for duplicate
            detection.
          </p>
          <p>
            Only masked alerts, their bank sender IDs and timestamps are queued
            on your phone and sent to the ExpenseTracker server. The server
            stores parsed transactions. Your device credential is encrypted on
            Android. Alerts leave the queue after successful delivery.
          </p>
          <h2>How to turn off SMS access</h2>
          <p>
            Revoke the SMS permission in Android app settings to stop automatic
            capture and inbox access. Revoke the device in ExpenseTracker
            Settings to stop delivery, and use Clear queue in the app to delete
            pending alerts. Previously imported transactions can be deleted in
            ExpenseTracker.
          </p>
        </section>
      </main>
    </>
  );
}
