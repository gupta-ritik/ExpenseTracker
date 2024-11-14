import Image from 'next/image';
import React from 'react';

interface ExpenseFeatureCardProps {
    title: string;
    description: string;
    imageUrl: string;
    actionText: string;
}

const cardsData = [
    {
        title: 'Expense Tracker',
        description: 'Manage and track your expenses in real-time.',
        imageUrl: "/photo.jpeg",
        actionText: 'Get Started',
    },
    {
        title: 'Expense Tracker',
        description: 'Manage and track your expenses in real-time.',
        imageUrl: "/photo.jpeg",
        actionText: 'Get Started',
    },
    {
        title: 'Expense Tracker',
        description: 'Manage and track your expenses in real-time.',
        imageUrl: "/photo.jpeg",
        actionText: 'Get Started',
    },
    {
        title: 'Budget Planning',
        description: 'Set and monitor your budgets to stay on track.',
        imageUrl: "/photo.jpeg",
        actionText: 'Plan Now',
    },
    {
        title: 'Expense Reports',
        description: 'Generate detailed reports on your expenses.',
        imageUrl: "/photo.jpeg",
        actionText: 'View Reports',
    },
    {
        title: 'Recurring Expenses',
        description: 'Set up recurring expenses to manage your finances better.',
        imageUrl: "/photo.jpeg",
        actionText: 'Setup Recurring',
    },
];

const ExpenseFeatureCard = ({ title, description, imageUrl, actionText }: ExpenseFeatureCardProps) => {
    return (
        <div className="relative flex flex-col my-6 bg-white shadow-sm border border-slate-200 rounded-lg w-96">
            <div className="relative h-56 m-2.5 overflow-hidden rounded-md">
                <Image src={imageUrl} alt="card-image" className="w-full h-full object-cover" />
            </div>
            <div className="p-4">
                <h6 className="mb-2  text-xl ">
                    {title}
                </h6>
                <p className="  ">
                    {description}
                </p>
            </div>
            <div className="px-4 pb-4 pt-0 mt-2">
                <button className="rounded-md bg-slate-800 py-2 px-4 border border-transparent text-center text-sm text-white transition-all shadow-md hover:shadow-lg focus:bg-slate-700 focus:shadow-none active:bg-slate-700 hover:bg-slate-700 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none" type="button">
                    {actionText}
                </button>
            </div>
        </div>
    );
};

export const CardDemo = () => {
    return (
        <div>
            <div className="text-center py-8 bg-gradient-to-r from-blue-500 to-purple-600">
                <h1 className="text-5xl font-extrabold text-white tracking-wide drop-shadow-md">
                    Feature Highlights
                </h1>
                <p className="mt-4 text-lg text-white/90 max-w-xl mx-auto">
                    Explore our range of features designed to help you manage your finances effectively.
                </p>
            </div>
            <div className="py-8 flex space-x-3 flex-wrap justify-center items-start w-full h-full">
                {cardsData.map((card, index) => (
                    <ExpenseFeatureCard
                        key={index}
                        title={card.title}
                        description={card.description}
                        imageUrl={card.imageUrl}
                        actionText={card.actionText}
                    />
                ))}
            </div>
        </div>
    );
};

