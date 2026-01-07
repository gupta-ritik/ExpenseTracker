# AI Chatbot Feature Documentation

## Overview

The ExpenseTracker now includes an AI-powered chatbot assistant that helps users manage their expenses more effectively. The chatbot provides personalized advice, identifies spending patterns, and suggests tips to optimize savings.

## Features

### 💬 Interactive Chat Interface
- **Floating Button**: A convenient blue circular button appears in the bottom-right corner of the dashboard
- **Chat Window**: Click the button to open a clean, modern chat interface
- **Real-time Responses**: Get instant advice and tips from the AI assistant
- **Chat History**: View your entire conversation within the session

### 🎯 Capabilities

The AI chatbot can help you with:

1. **Spending Analysis**
   - Understand spending patterns across different categories
   - Identify trends and seasonal variations
   - Spot unusual transactions

2. **Budget Planning**
   - Create SMART financial goals
   - Implement the 50/30/20 budgeting rule
   - Track and adjust budgets regularly

3. **Savings Strategies**
   - Get personalized tips to increase savings
   - Learn about debt management
   - Discover ways to reduce unnecessary expenses

4. **Category Management**
   - Organize expenses into logical categories
   - Create custom categories for your lifestyle
   - Optimize expense tracking

5. **Financial Advice**
   - General best practices for financial health
   - Investment considerations
   - Transaction management tips

## How to Use

### Accessing the Chatbot

1. **Log in** to your ExpenseTracker account
2. Navigate to any page within the dashboard
3. Look for the **blue circular button** with a chat icon in the bottom-right corner
4. **Click the button** to open the chat window

### Asking Questions

The chatbot understands natural language queries. Here are some example questions:

- "How can I reduce my spending?"
- "What are my spending patterns?"
- "Give me budget planning tips"
- "How should I categorize my expenses?"
- "What's the 50/30/20 rule?"
- "How can I save more money?"

### Sample Conversations

**User**: "Hi, how can you help me?"

**AI**: "Hello! I'm here to help you manage your expenses better. You can ask me about spending analysis, budget optimization, saving strategies, and more!"

---

**User**: "Give me some savings tips"

**AI**: "Here are some personalized tips to optimize your savings:
- 💰 Follow the 50/30/20 Rule
- 📊 Track and cancel unused subscriptions
- 🛒 Use price comparison tools
- 🍽️ Reduce dining out by meal planning
- 💳 Pay off high-interest debts first"

## Technical Details

### Architecture

- **Frontend Component**: `components/AIChatbot.tsx`
  - React component with state management
  - Responsive design with Tailwind CSS
  - Smooth animations and transitions

- **Backend API**: `app/api/chatbot/route.ts`
  - Next.js API route handling chatbot requests
  - Pattern-matching response generation
  - Extensible for future AI integrations

- **UI Components**: Built with Radix UI and custom styling
  - Dialog components for modal functionality
  - Button components for interactions
  - Input components for message entry

### Customization

The chatbot responses can be enhanced by:

1. **Integrating Real AI**: Replace the pattern-matching logic with actual AI services (OpenAI, Anthropic, etc.)
2. **User Data Analysis**: Connect to actual expense data for personalized insights
3. **Custom Prompts**: Modify response patterns in `app/api/chatbot/route.ts`

### Future Enhancements

Potential improvements for the chatbot:

- 🔗 **Live Data Integration**: Analyze actual user transactions and expenses
- 📊 **Visual Reports**: Generate charts and graphs within chat responses
- 🔔 **Proactive Alerts**: Send notifications about unusual spending or budget limits
- 🌐 **Multi-language Support**: Provide assistance in multiple languages
- 📱 **Voice Input**: Enable voice-based queries
- 💾 **Conversation History**: Save chat history across sessions

## Privacy & Security

- Chat conversations are processed in real-time
- No conversation data is stored permanently (currently)
- All communication happens over secure HTTPS
- The chatbot only appears for authenticated users

## Troubleshooting

### Chatbot button not appearing
- Ensure you're logged into your account
- The chatbot only appears on authenticated pages (not on the landing page)
- Try refreshing the page

### Chatbot not responding
- Check your internet connection
- Ensure the API endpoint is accessible
- Check browser console for any error messages

### Getting generic responses
- Try being more specific with your questions
- Use keywords like "spending", "savings", "budget", "categories"
- The current version uses pattern matching; future versions will have better context understanding

## Support

For issues or questions about the AI chatbot:
- Open an issue on GitHub
- Contact the development team
- Refer to the main ExpenseTracker documentation

---

**Note**: The current implementation provides simulated AI responses based on common expense management queries. For production use with real AI capabilities, you would need to integrate with AI service providers and add appropriate API keys to your environment configuration.
