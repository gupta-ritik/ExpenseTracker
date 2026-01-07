import { NextRequest, NextResponse } from 'next/server';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Simulated AI responses based on common expense-related queries
function generateResponse(userMessage: string, history: Message[]): string {
  const lowerMessage = userMessage.toLowerCase();

  // Greeting responses
  if (lowerMessage.match(/\b(hi|hello|hey|greetings)\b/)) {
    return "Hello! I'm here to help you manage your expenses better. You can ask me about:\n\n• Spending analysis and patterns\n• Budget optimization tips\n• Saving strategies\n• Expense categorization advice\n• Financial planning suggestions\n\nWhat would you like to know?";
  }

  // Spending pattern queries
  if (lowerMessage.match(/\b(spending|spend|pattern|habit|track)\b/)) {
    return "To analyze your spending patterns effectively, I recommend:\n\n1. **Review by Category**: Check which categories consume most of your budget (dining, shopping, utilities, etc.)\n2. **Monthly Trends**: Compare your spending month-over-month to identify increases or seasonal variations\n3. **Identify Outliers**: Look for unusual transactions that might be one-time expenses\n4. **Set Alerts**: Configure notifications for when you approach category limits\n\nWould you like specific advice on any category?";
  }

  // Savings tips
  if (lowerMessage.match(/\b(save|saving|savings|budget|reduce|cut)\b/)) {
    return "Here are some personalized tips to optimize your savings:\n\n💰 **50/30/20 Rule**: Allocate 50% to needs, 30% to wants, and 20% to savings\n📊 **Track Subscriptions**: Review recurring payments and cancel unused services\n🛒 **Smart Shopping**: Use price comparison and wait for sales on non-urgent purchases\n🍽️ **Meal Planning**: Reduce dining out by preparing meals at home\n💳 **Debt Management**: Pay off high-interest debts first\n\nImplementing even a few of these can significantly boost your savings!";
  }

  // Category advice
  if (lowerMessage.match(/\b(category|categorize|organize|group)\b/)) {
    return "Proper expense categorization is crucial for financial clarity:\n\n📌 **Common Categories**:\n• Housing (rent, mortgage, utilities)\n• Transportation (fuel, maintenance, public transit)\n• Food (groceries, dining out)\n• Healthcare (insurance, medical bills)\n• Entertainment (streaming, hobbies)\n• Personal (clothing, grooming)\n• Savings & Investments\n\n**Pro Tip**: Create custom categories that match your lifestyle for more accurate tracking!";
  }

  // Budget planning
  if (lowerMessage.match(/\b(budget|plan|financial|goal)\b/)) {
    return "Let's create a solid financial plan:\n\n🎯 **Set SMART Goals**:\n• Specific: Define exact amounts and purposes\n• Measurable: Track progress regularly\n• Achievable: Set realistic targets\n• Relevant: Align with your priorities\n• Time-bound: Set deadlines\n\n📈 **Action Steps**:\n1. Calculate your total monthly income\n2. List all fixed expenses (rent, subscriptions, etc.)\n3. Determine variable expenses average\n4. Allocate remainder to savings/debt payment\n5. Review and adjust monthly\n\nStart small and build momentum!";
  }

  // Investment queries
  if (lowerMessage.match(/\b(invest|investment|stock|fund)\b/)) {
    return "Investment considerations for expense management:\n\n💼 **Build Emergency Fund First**: Save 3-6 months of expenses before investing\n📊 **Start Simple**: Consider index funds or ETFs for beginners\n⚖️ **Diversify**: Don't put all eggs in one basket\n🎓 **Educate Yourself**: Learn about different investment options\n⚠️ **Risk Assessment**: Match investments to your risk tolerance\n\n*Note: This is general advice. Consult a financial advisor for personalized investment strategies.*";
  }

  // Transaction queries
  if (lowerMessage.match(/\b(transaction|payment|transfer|history)\b/)) {
    return "Managing your transactions effectively:\n\n🔍 **Review Regularly**: Check transactions weekly to catch errors or fraud\n🏷️ **Tag Important Ones**: Mark business expenses, tax-deductible items, etc.\n📱 **Digital Receipts**: Save receipts for major purchases\n🔒 **Security**: Report suspicious transactions immediately\n📊 **Export Data**: Download transaction history for tax purposes\n\nKeeping organized transaction records helps with budgeting and tax filing!";
  }

  // Thank you responses
  if (lowerMessage.match(/\b(thank|thanks|appreciate)\b/)) {
    return "You're welcome! I'm always here to help you achieve your financial goals. Feel free to ask me anything about expense management, budgeting, or saving strategies. 😊";
  }

  // General financial advice
  if (lowerMessage.match(/\b(advice|tip|help|suggest|recommend)\b/)) {
    return "Here are some general financial best practices:\n\n✅ **Track Every Expense**: Awareness is the first step to control\n✅ **Automate Savings**: Set up automatic transfers to savings accounts\n✅ **Review Monthly**: Analyze spending patterns each month\n✅ **Avoid Impulse Buying**: Wait 24 hours before non-essential purchases\n✅ **Use Cash for Discretionary Spending**: Helps limit overspending\n✅ **Build Credit Wisely**: Pay credit cards in full each month\n\nWhat specific aspect would you like to explore further?";
  }

  // Default response
  return "I understand you're asking about expense management. I can help you with:\n\n• **Spending Analysis**: Understand where your money goes\n• **Budget Planning**: Create and stick to a budget\n• **Savings Strategies**: Tips to increase your savings\n• **Category Management**: Organize your expenses effectively\n• **Financial Goals**: Plan and achieve your objectives\n\nCould you please provide more details about what you'd like to know?";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // Generate response based on the user's message
    const responseMessage = generateResponse(message, history || []);

    return NextResponse.json({
      message: responseMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Chatbot API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
