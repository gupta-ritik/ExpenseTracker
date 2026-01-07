'use client'
import { useState, useEffect } from 'react';

function ProgressBar({ title, percentage, color }: { title: string; percentage: number; color: string }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <span>{title}</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

export default function BudgetTracker() {
  const [budgets, setBudgets] = useState([
    { title: 'Groceries', percentage: 75, color: 'bg-green-500' },
    { title: 'Bills', percentage: 50, color: 'bg-yellow-500' },
    { title: 'Entertainment', percentage: 40, color: 'bg-pink-500' },
  ]);

  return (
    <section className="py-8 bg-gray-50">
      <h3 className="text-3xl font-bold text-center mb-6">Track Your Budget</h3>
      <div className="max-w-md mx-auto">
        {budgets.map((budget, index) => (
          <ProgressBar key={index} {...budget} />
        ))}
      </div>
    </section>
  );
}
