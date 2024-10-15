"use client"

import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, DollarSign, PieChart, Wallet } from 'lucide-react'
import { Line, LineChart, Pie, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell } from 'recharts'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// Mock data
const expenseData = [
  { category: 'Rent', amount: 700, color: '#0179fe' },
  { category: 'Groceries', amount: 300, color: '#00c6ff' },
  { category: 'Entertainment', amount: 150, color: '#6dd5fa' },
  { category: 'Transportation', amount: 100, color: '#2196f3' },
  { category: 'Utilities', amount: 200, color: '#4facfe' },
]

const recentTransactions = [
  { date: '01 Oct 2024', category: 'Groceries', description: 'Supermarket', amount: -45 },
  { date: '30 Sep 2024', category: 'Salary', description: 'Monthly Salary', amount: 2800 },
  { date: '29 Sep 2024', category: 'Entertainment', description: 'Cinema', amount: -20 },
  { date: '28 Sep 2024', category: 'Utilities', description: 'Electricity Bill', amount: -80 },
  { date: '27 Sep 2024', category: 'Transportation', description: 'Fuel', amount: -50 },
]

const spendingTrends = [
  { month: 'Jan', income: 2500, expenses: 2000 },
  { month: 'Feb', income: 2700, expenses: 2200 },
  { month: 'Mar', income: 2600, expenses: 2100 },
  { month: 'Apr', income: 2800, expenses: 2300 },
  { month: 'May', income: 2900, expenses: 2400 },
  { month: 'Jun', income: 3000, expenses: 2500 },
]

export default function BasicExpenseTrackerDashboard() {
  const [dateRange, setDateRange] = useState('This Month')

  const totalExpenses = expenseData.reduce((sum, item) => sum + item.amount, 0)
  const totalIncome = 2800
  const netBalance = totalIncome - totalExpenses
  const budgetProgress = (totalExpenses / 2000) * 100 // Assuming budget is $2000

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Wallet className="h-8 w-8 text-[#0179fe]" />
            <h1 className="text-2xl font-bold text-gray-800">ExpenseTracker</h1>
          </div>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border-gray-300 text-gray-700">
                  {dateRange} <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setDateRange('This Month')}>This Month</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDateRange('Last Month')}>Last Month</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDateRange('Custom Range')}>Custom Range</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Guest</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Expenses</CardTitle>
              <DollarSign className="h-4 w-4 text-[#0179fe]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-800">${totalExpenses.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                2.5% from last month
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Income</CardTitle>
              <DollarSign className="h-4 w-4 text-[#0179fe]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-800">${totalIncome.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                5% from last month
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Net Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-[#0179fe]" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(netBalance).toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1 flex items-center">
                {netBalance >= 0 ? (
                  <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
                ) : (
                  <ArrowDown className="h-4 w-4 text-red-500 mr-1" />
                )}
                {netBalance >= 0 ? "You're doing great!" : "Time to cut back"}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Budget Progress</CardTitle>
              <PieChart className="h-4 w-4 text-[#0179fe]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-800">{budgetProgress.toFixed(0)}%</div>
              <p className="text-xs text-gray-500 mt-1">of your budget spent</p>
              <div className="mt-4 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${budgetProgress <= 80 ? 'bg-[#0179fe]' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-800">Expense Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseData}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {expenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-gray-800">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-gray-600">Date</TableHead>
                    <TableHead className="text-gray-600">Category</TableHead>
                    <TableHead className="text-gray-600">Description</TableHead>
                    <TableHead className="text-gray-600 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((transaction, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{transaction.date}</TableCell>
                      <TableCell>{transaction.category}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className={`text-right ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.abs(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300 mb-8">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-800">Income vs. Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={spendingTrends}>
                <XAxis dataKey="month" stroke="#718096" />
                <YAxis stroke="#718096" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="income" stroke="#0179fe" strokeWidth={2} />
                <Line type="monotone" dataKey="expenses" stroke="#f87171" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-800">Savings Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-gray-600">Vacation Fund</p>
                <p className="text-sm font-medium text-[#0179fe]">$500 / $2000</p>
              </div>
              <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#0179fe]" style={{ width: '25%' }}></div>
              </div>
              <p className="text-sm text-gray-500">You're 25% of the way to your goal. Keep it up!</p>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="bg-white border-t border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex space-x-4 mb-4 md:mb-0">
              <a href="#" className="text-sm text-gray-600 hover:text-[#0179fe] transition-colors duration-150">Settings</a>
              <a href="#" className="text-sm text-gray-600 hover:text-[#0179fe] transition-colors duration-150">Privacy Policy</a>
              <a href="#" className="text-sm text-gray-600 hover:text-[#0179fe] transition-colors duration-150">Support</a>
            </div>
            <div className="text-sm text-gray-600">
              © 2024 ExpenseTracker. All rights reserved.
            </div>
          </div>
        </div>
      
      </footer>
    </div>
  )
}