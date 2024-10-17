// import HeaderBox from "@/components/HeaderBox";
// import Pagination from "@/components/Pagination";
// import TransactionsTable from "@/components/TransactionsTable";
// import { getAccount, getAccounts } from "@/lib/actions/bank.actions";
// import { getLoggedInUser } from "@/lib/actions/user.actions";
// import { formatAmount } from "@/lib/utils";
// import React from "react";

// const TransactionHistory = async ({
//   searchParams: { id, page },
// }: SearchParamProps) => {
//   const currentPage = Number(page as string) || 1;

//   // Fetch logged-in user data
//   const loggedIn = await getLoggedInUser();

//   // Check if the user is logged in
//   if (!loggedIn) {
//     return (
//       <div className="transactions">
//         <HeaderBox
//           title="Transaction History"
//           subtext="You need to be logged in to view transaction history."
//         />
//       </div>
//     );
//   }

//   // Fetch accounts using the logged-in user's ID
//   const accounts = await getAccounts({
//     userId: loggedIn.$id,
//   });

//   // Check if accounts were fetched successfully
//   if (!accounts || accounts.data.length === 0) {
//     return (
//       <div className="transactions">
//         <HeaderBox
//           title="Transaction History"
//           subtext="No accounts found for this user."
//         />
//       </div>
//     );
//   }

//   const accountsData = accounts?.data;
//   const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;

//   // Fetch specific account details
//   const account = await getAccount({ appwriteItemId });

//   const rowsPerPage = 10;
//   const totalPages = Math.ceil(account?.transactions.length / rowsPerPage);

//   const indexOfLastTransaction = currentPage * rowsPerPage;
//   const indexOfFirstTransaction = indexOfLastTransaction - rowsPerPage;

//   const currentTransactions = account?.transactions.slice(
//     indexOfFirstTransaction,
//     indexOfLastTransaction
//   );

//   return (
//     <div className="transactions">
//       <div className="transactions-header">
//         <HeaderBox
//           title="Transaction History"
//           subtext="See your bank details and transactions."
//         />
//       </div>

//       <div className="space-y-6">
//         <div className="transactions-account">
//           <div className="flex flex-col gap-2">
//             <h2 className="text-18 font-bold text-white">
//               {account?.data.name}
//             </h2>
//             <p className="text-14 text-blue-25">{account?.data.officialName}</p>
//             <p className="text-14 font-semibold tracking-[1.1px] text-white">
//               ●●●● ●●●● ●●●● {account?.data.mask}
//             </p>
//           </div>

//           <div className="transactions-account-balance">
//             <p className="text-14">Current balance</p>
//             <p className="text-24 text-center font-bold">
//               {formatAmount(account?.data.currentBalance)}
//             </p>
//           </div>
//         </div>

//         <section className="flex w-full flex-col gap-6">
//           <TransactionsTable transactions={currentTransactions} />
//           {totalPages > 1 && (
//             <div className="my-4 w-full">
//               <Pagination totalPages={totalPages} page={currentPage} />
//             </div>
//           )}
//         </section>
//       </div>
//     </div>
//   );
// };

// export default TransactionHistory;
import HeaderBox from "@/components/HeaderBox";
// import Pagination from "@/components/Pagination";
import { Pagination } from "@/components/Pagination";
import TransactionsTable from "@/components/TransactionsTable";
import TransactionFilter from "@/components/TransactionFilter"; // Adding the filter component
import { getAccount, getAccounts } from "@/lib/actions/bank.actions";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import { formatAmount } from "@/lib/utils";
import React, { useState, useEffect } from "react";

// Handle search parameters for filtering and pagination
interface SearchParamProps {
  searchParams: {
    id: string;
    page: string;
  };
}
const TransactionHistory = async ({ searchParams: { id, page } }: SearchParamProps) => {
  const currentPage = Number(page as string) || 1;

  // Fetch logged-in user data
  const loggedIn = await getLoggedInUser();

  if (!loggedIn) {
    return (
      <div className="transactions">
        <HeaderBox
          title="Transaction History"
          subtext="You need to be logged in to view transaction history."
        />
      </div>
    );
  }

  // Fetch all user accounts
  const accounts = await getAccounts({ userId: loggedIn.$id });

  if (!accounts || accounts.data.length === 0) {
    return (
      <div className="transactions">
        <HeaderBox
          title="Transaction History"
          subtext="No accounts found for this user."
        />
      </div>
    );
  }

  const accountsData = accounts?.data;
  const appwriteItemId = (id as string) || accountsData[0]?.appwriteItemId;

  // Fetch specific account details with transactions
  const account = await getAccount({ appwriteItemId });

  const rowsPerPage = 10;
  const totalPages = Math.ceil(account?.transactions.length / rowsPerPage);

  const indexOfLastTransaction = currentPage * rowsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - rowsPerPage;

  const currentTransactions = account?.transactions.slice(
    indexOfFirstTransaction,
    indexOfLastTransaction
  );
  const [filter, setFilter] = useState({});
  return (
    <div className="transactions">
      <div className="transactions-header">
        <HeaderBox
          title="Transaction History"
          subtext="See your bank details and transactions."
        />
      </div>

      <div className="space-y-6">
        <div className="transactions-account">
          <div className="flex flex-col gap-2">
            <h2 className="text-18 font-bold text-white">
              {account?.data.name}
            </h2>
            <p className="text-14 text-blue-25">{account?.data.officialName}</p>
            <p className="text-14 font-semibold tracking-[1.1px] text-white">
              ●●●● ●●●● ●●●● {account?.data.mask}
            </p>
          </div>

          <div className="transactions-account-balance">
            <p className="text-14">Current balance</p>
            <p className="text-24 text-center font-bold">
              {formatAmount(account?.data.currentBalance)}
            </p>
          </div>
        </div>
       
        <section className="flex w-full flex-col gap-6">
          <TransactionFilter setFilter={setFilter} /> {/* New Filter Component */}
          <TransactionsTable transactions={currentTransactions} />
          {totalPages > 1 && (
            <div className="my-4 w-full">
              <Pagination totalPages={totalPages} page={currentPage} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TransactionHistory;


