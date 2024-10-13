// import React from "react";

// type Transaction = {
//   id: string;
//   amount: number;
//   date: string;
//   description: string;
// };

// type TransactionsTableProps = {
//   transactions: Transaction[];
// };


// const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions }) => {
//   return <div>table</div>;
// };

// export default TransactionsTable;

import React, { ReactNode } from "react";

type Transaction = {
  category: string,
  id: string;
  amount: number;
  date: string;
  description: string;
};

type TransactionsTableProps = {
  transactions: Transaction[];
};

const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions }) => {
  if (transactions.length === 0) {
    return <p>No transactions found.</p>;
  }

  return (
    <table className="min-w-full table-auto bg-white shadow-md rounded my-6">
      <thead>
        <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
          <th className="py-3 px-6 text-left">Date</th>
          <th className="py-3 px-6 text-left">Description</th>
          <th className="py-3 px-6 text-right">Amount</th>
          <th className="py-3 px-6 text-left">Category</th>
        </tr>
      </thead>
      <tbody className="text-gray-600 text-sm font-light">
        {transactions.map((transaction) => (
          <tr key={transaction.id} className="border-b border-gray-200 hover:bg-gray-100">
            <td className="py-3 px-6 text-left whitespace-nowrap">
              {new Date(transaction.date).toLocaleDateString()}
            </td>
            <td className="py-3 px-6 text-left">{transaction.description}</td>
            <td className="py-3 px-6 text-right">${transaction.amount.toFixed(2)}</td>
            <td className="py-3 px-6 text-left">{transaction.category}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default TransactionsTable;
