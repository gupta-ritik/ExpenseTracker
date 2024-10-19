"use client";
import HeaderBox from "@/components/HeaderBox";
import PaymentTransferForm from "@/components/PaymentTransferForm";
import { getAccounts } from "@/lib/actions/bank.actions";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import { redirect } from "next/navigation";
import React, { useState } from "react";

const Transfer = async  () => {
  const loggedIn = await getLoggedInUser();

  if (!loggedIn) {
    // Redirect the user to the sign-up page if they are not logged in
    redirect("/sign-up");  // This handles the redirection server-side
  }

  const accountsData = accounts?.data;

  const [formData, setFormData] = useState({
    email: "",
    phoneNumber: "",
    amount: "",
    pin: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add transfer funds logic here
    console.log(formData);
    alert("Transfer initiated!");
  };

  return (
    <div className="flex gap-5 mt-20 justify-center ">
      <div className="mt-10 justify-center items-center w-[40vw]">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-lg w-full">
          <h2 className="text-3xl font-bold text-center text-gray-800">
            Transfer Funds
          </h2>
          <p className="text-center text-gray-600 mt-2 font-semibold">
            Securely transfer funds to a user
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Recipient's Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter recipient's email"
                required
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Phone Number Input */}
            <div>
              <label
                htmlFor="phoneNumber"
                className="block text-sm font-medium text-gray-700"
              >
                Phone Number
              </label>
              <input
                type="text"
                name="phoneNumber"
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Enter recipient's phone number"
                required
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Amount Input */}
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700"
              >
                Amount
              </label>
              <input
                type="number"
                name="amount"
                id="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="Enter the amount"
                required
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* PIN Input */}
            <div>
              <label
                htmlFor="pin"
                className="block text-sm font-medium text-gray-700"
              >
                PIN
              </label>
              <input
                type="password"
                name="pin"
                id="pin"
                value={formData.pin}
                onChange={handleChange}
                placeholder="Enter your 4-digit PIN"
                required
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            {/* Submit Button */}
            <div className="mt-6">
              <button
                type="submit"
                className="w-full px-6 py-3 bg-indigo-600 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Transfer Now
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="mt-8">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-6 rounded-lg shadow-lg max-w-lg w-full">
          <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
          <div className="flex justify-between items-center">
            {/* Card Details */}
            <div>
              <p className="text-sm">Card Type: <span className="font-semibold">Visa</span></p>
              <p className="text-sm mt-1">Card Number: <span className="font-semibold">**** **** **** 1234</span></p>
              <p className="text-sm mt-1">Cardholder Name: <span className="font-semibold">John Doe</span></p>
            </div>
            {/* Card Icon */}
            <div className="text-4xl">
              💳
            </div>
          </div>
          <button
            type="button"
            className="w-full mt-6 bg-white text-indigo-600 font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-gray-100"
          >
            Choose Another Card
          </button>
        </div>
      </div>
    </div>
  );
};

export default Transfer;
