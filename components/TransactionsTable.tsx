import React from "react";

type Transaction = {
  id: string;
  amount: number;
  date: string;
  description: string;
};

type TransactionsTableProps = {
  transactions: Transaction[];
};


const TransactionsTable: React.FC<TransactionsTableProps> = ({ transactions }) => {
  return <div>table</div>;
};

export default TransactionsTable;
