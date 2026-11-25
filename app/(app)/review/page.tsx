import { PageHeading } from "../../../components/ledger/shared";
import { ReviewQueue } from "../../../components/ledger/review-queue";
import { requireUser } from "../../../lib/auth";
import { reviewQueue } from "../../../lib/capture/review";
import { getOptions } from "../../../lib/db/queries/ledger";

export const metadata = { title: "Review" };

export default async function ReviewPage() {
  const { id } = await requireUser();
  const [queue, options] = await Promise.all([
    reviewQueue(id, 200),
    getOptions(id),
  ]);
  return (
    <div className="stack">
      <PageHeading
        title="Review"
        label={`// ${queue.items.length}${queue.more ? "+" : ""} WAITING`}
      />
      <ReviewQueue
        items={queue.items}
        options={options}
        currency={options.currency}
      />
    </div>
  );
}
