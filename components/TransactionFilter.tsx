import React, { useState } from "react";

interface Filter {
    dateRange: string;
    category: string;
  }
const TransactionFilter = ({ setFilter }: { setFilter: (filter: Filter) => void }) => {
  const [dateRange, setDateRange] = useState("");
  const [category, setCategory] = useState("");

  const applyFilter = () => {
    setFilter({
      dateRange,
      category,
    });
  };

  return (
    <div className="flex gap-4 mb-6">
      <input
        type="date"
        className="border rounded p-2"
        value={dateRange}
        onChange={(e) => setDateRange(e.target.value)}
      />
      <select
        className="border rounded p-2"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="">All Categories</option>
        <option value="food">Food</option>
        <option value="transport">Transport</option>
        {/* Add more categories */}
      </select>
      <button
        className="bg-blue-500 text-white rounded p-2"
        onClick={applyFilter}
      >
        Apply Filter
      </button>
    </div>
  );
};

export default TransactionFilter;
