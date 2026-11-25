module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: { colors: { paper: "#F2EFE6", ink: "#0A0A0A", acid: "#D4FF00" } },
  },
};
