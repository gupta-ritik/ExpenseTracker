'use client'
import React, { useEffect } from 'react';
import { gsap } from 'gsap';
import { UserPlus, DollarSign, PieChart, TrendingUp } from 'lucide-react'; // Import icons

function FeaturesSection() {
  useEffect(() => {
    // GSAP animations for feature cards
    gsap.fromTo(
      ".feature-card",
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1, stagger: 0.2 }
    );
  }, []);

  // Array to store features data with different background colors
  const features = [
    {
      title: 'Create an Account',
      description: 'Sign up in a few clicks to start tracking your expenses.',
      icon: <UserPlus className="h-12 w-12 text-primary mx-auto mb-4" />,
      bgColor: 'bg-blue-100' // Light blue background
    },
    {
      title: 'Add Your Transactions',
      description: 'Easily input your income and expenses from any device.',
      icon: <DollarSign className="h-12 w-12 text-primary mx-auto mb-4" />,
      bgColor: 'bg-green-100' // Light green background
    },
    {
      title: 'Monitor Your Budget',
      description: 'Set spending limits and get real-time insights into where your money is going.',
      icon: <PieChart className="h-12 w-12 text-primary mx-auto mb-4" />,
      bgColor: 'bg-yellow-100' // Light yellow background
    },
    {
      title: 'Achieve Financial Goals',
      description: 'Our intuitive dashboard gives you a clear view of your spending habits, helping you save more and spend wisely.',
      icon: <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />,
      bgColor: 'bg-pink-100' // Light pink background
    }
  ];

  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-8">
          How It Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Map through features array */}
          {features.map((feature, index) => (
            <article
              key={index}
              className={`feature-card shadow-sm border rounded p-6 text-center ${feature.bgColor}`} // Apply dynamic background color
            >
              {feature.icon} {/* Render icon */}
              <h3 className="text-2xl font-semibold mb-4">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </article>
          ))}

        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
