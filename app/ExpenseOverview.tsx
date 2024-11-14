'use client'
import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';

function ExpenseOverview() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-gray-100 h-screen">
      {/* Left Side: Animated Image */}
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full md:w-1/2 mb-8 md:mb-0"
      >
        <Image
          src="/Expense.jpg" // Replace with an actual image URL
          alt="Expense Tracking"
         
        />
      </motion.div>

      {/* Right Side: Text Content */}
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full md:w-1/2 text-center md:text-left"
      >
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          Manage Your Expenses Effectively
        </h1>
        <p className="text-lg text-gray-600">
          Track your spending habits, save money, and stay on top of your finances with our
          easy-to-use expense management tools. Plan your budget, monitor expenses, and achieve
          your financial goals effortlessly.
        </p>
      </motion.div>
    </div>
  );
}

export default ExpenseOverview;
