import React from "react";

const Pricing = () => {
    return (
        <section className="relative z-10 overflow-hidden border-t bg-slate-40 pb-12 pt-20 dark:bg-dark lg:pb-[90px] lg:pt-[120px]">
            <div className="container mx-auto">
                <div className="-mx-4 flex flex-wrap">
                    <div className="w-full px-4">
                        <div className="mx-auto mb-[60px] max-w-[510px] text-center">
                       
                            <h2 className="mb-3 text-3xl font-bold leading-[1.208] text-dark dark:text-white sm:text-4xl md:text-[40px]">
                                Our Pricing Plan
                            </h2>
                            <p className="text-base text-body-color dark:text-dark-6">
                                There are many variations of passages of Lorem Ipsum available
                                but the majority have suffered alteration in some form.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="-mx-4 flex flex-wrap justify-center">
                    <div className="-mx-4 flex flex-wrap">
                        <PricingCard
                            type="Personal"
                            price="$59"
                            subscription="year"
                            description="Perfect for using in a personal website or a client project."
                            buttonText="Choose Personal"
                        >
                            <List>1 User</List>
                            <List>All UI components</List>
                            <List>Lifetime access</List>
                            <List>Free updates</List>
                            <List>Use on 1 (one) project</List>
                            <List>3 Months support</List>
                        </PricingCard>
                        <PricingCard
                            type="Business"
                            price="$199"
                            subscription="year"
                            description="Perfect for small teams and growing businesses."
                            buttonText="Choose Business"
                            active
                        >
                            <List>5 Users</List>
                            <List>All UI components</List>
                            <List>Lifetime access</List>
                            <List>Free updates</List>
                            <List>Use on 3 (three) projects</List>
                            <List>4 Months support</List>
                        </PricingCard>
                        <PricingCard
                            type="Professional"
                            price="$256"
                            subscription="year"
                            description="Ideal for larger teams and organizations."
                            buttonText="Choose Professional"
                        >
                            <List>Unlimited Users</List>
                            <List>All UI components</List>
                            <List>Lifetime access</List>
                            <List>Free updates</List>
                            <List>Unlimited projects</List>
                            <List>12 Months support</List>
                        </PricingCard>
                    </div>
                </div>
            </div>
        </section>
    );
};

const PricingCard = ({
    children,
    description,
    price,
    type,
    subscription,
    buttonText,
    active,
}: any) => {
    return (
        <div className="w-full px-4 md:w-1/2 lg:w-1/3">
            <div className={`relative z-10 mb-10 overflow-hidden rounded-[10px] border  border-stroke  px-8 py-10 shadow-pricing dark:border-dark-3 dark:bg-dark-2 sm:p-12 lg:px-6 lg:py-10 xl:p-[50px] ${active ? '' : ''}`}>
                <span className="mb-3 block text-lg font-semibold text-primary">
                    {type}
                </span>
                <h2 className="mb-5 text-[42px] font-bold text-dark ">
                    {price}
                    <span className="text-base font-medium text-body-color ">
                        / {subscription}
                    </span>
                </h2>
                <p className="mb-8 border-b border-stroke pb-8 text-base text-body-color dark:border-dark-3 dark:text-dark-6">
                    {description}
                </p>
                <div className="mb-9 flex flex-col gap-[14px]">{children}</div>
                <a
                    href="/#"
                    className={`block bg-blue-500 w-full rounded-md border border-stroke p-3 text-center text-base font-medium transition ${active ? "bg-blue-500 text-white" : "bg-blue-500 text-white hover:bg-primary hover:text-blue-950 dark:border-dark-3"}`}
                >
                    {buttonText}
                </a>
                <div>
                    <span className="absolute right-0 top-7 z-[-1]">
                        <svg
                            width={77}
                            height={172}
                            viewBox="0 0 77 172"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle cx={86} cy={86} r={86} fill="url(#paint0_linear)" />
                            <defs>
                                <linearGradient
                                    id="paint0_linear"
                                    x1={86}
                                    y1={0}
                                    x2={86}
                                    y2={172}
                                    gradientUnits="userSpaceOnUse"
                                >
                                    <stop stopColor="#3056D3" stopOpacity="0.09" />
                                    <stop offset={1} stopColor="#C4C4C4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                        </svg>
                    </span>
                    <span className="absolute right-4 top-4 z-[-1]">
                        <svg
                            width={41}
                            height={89}
                            viewBox="0 0 41 89"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            {/* Add the circle elements as in your original code */}
                        </svg>
                    </span>
                </div>
            </div>
        </div>
    );
};

// Sample List component
const List = ({ children }: any) => (
    <div className="flex items-center">
        <span className="mr-2 text-primary">✓</span>
        <span className="text-body-color">{children}</span>
    </div>
);

export default Pricing;
