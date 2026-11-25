"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main id="main" className="standalone">
    <section className="panel stack"><h1>Something went wrong</h1><p>We couldn?t load this screen.</p>
      <button className="button primary" onClick={reset}>Try again</button></section>
  </main>;
}
