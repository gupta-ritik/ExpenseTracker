const { version } = require("./package.json");

const apiBaseUrl =
  process.env.EXPENSE_TRACKER_DEV_API_URL ||
  "https://expense-tracker-stmh.vercel.app";

module.exports = {
  name: "Expense Tracker",
  slug: "expense-tracker",
  version,
  scheme: "expensetracker",
  platforms: ["android"],
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  android: {
    package: "com.guptaritik.expensetracker",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#D4FF00",
    },
    versionCode: version
      .split(".")
      .map(Number)
      .reduce((code, part) => code * 1000 + part, 0),
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        imageWidth: 156,
        backgroundColor: "#F2EFE6",
        dark: { backgroundColor: "#0A0A0A" },
      },
    ],
    [
      "./plugins/with-android-release",
      { localHttp: apiBaseUrl.startsWith("http:") },
    ],
  ],
  extra: { apiBaseUrl },
};
