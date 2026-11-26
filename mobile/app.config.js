const { dirname, join } = require("node:path");
const { version } = require("./package.json");

// Fonts are embedded at build time; loading them at runtime silently fell back
// to the system font in release builds. File names become the family names.
const font = (pkg, file) =>
  join(dirname(require.resolve(`${pkg}/package.json`)), file);
const fonts = [
  font(
    "@expo-google-fonts/archivo-black",
    "400Regular/ArchivoBlack_400Regular.ttf",
  ),
  font(
    "@expo-google-fonts/jetbrains-mono",
    "400Regular/JetBrainsMono_400Regular.ttf",
  ),
  font(
    "@expo-google-fonts/jetbrains-mono",
    "700Bold/JetBrainsMono_700Bold.ttf",
  ),
];

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
    ["expo-font", { fonts }],
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
