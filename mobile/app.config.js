const { version } = require("./package.json");

module.exports = {
  name: "Expense Tracker",
  slug: "expense-tracker",
  version,
  scheme: "expensetracker",
  platforms: ["android"],
  userInterfaceStyle: "automatic",
  android: { package: "com.guptaritik.expensetracker" },
  plugins: ["expo-router", "expo-secure-store"],
  extra: {
    apiBaseUrl:
      process.env.EXPENSE_TRACKER_DEV_API_URL ||
      "https://expense-tracker-stmh.vercel.app",
  },
};
