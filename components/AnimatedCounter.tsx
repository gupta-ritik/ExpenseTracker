"use client";
import React from "react";
import CountUp from "react-countup";
const AnimatedCounter = ({ amount }: { amount: number }) => {
  return (
    <div>
      <CountUp
        prefix="$"
        decimal="."
        end={amount}
        duration={2}
        separator=","
        decimals={2}
      />
    </div>
  );
};

export default AnimatedCounter;
