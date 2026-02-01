import { NextRequest, NextResponse } from "next/server";

// Mock responses that simulate an AI assistant
const mockResponses = [
  "That's a great question! Let me think about that for a moment. Based on my understanding, I'd say the key considerations here are context, purpose, and execution.",
  "I appreciate you sharing that with me. From what you've described, it sounds like you're on the right track. Would you like me to elaborate on any specific aspect?",
  "Interesting perspective! There are several ways to approach this. The most effective strategy often depends on your specific goals and constraints.",
  "Thanks for asking! I'd be happy to help with that. Here's what I think would work best in your situation...",
  "That's a thoughtful observation. In my experience, the best outcomes come from balancing multiple factors. Let me break this down for you.",
  "Great point! This is something that comes up often. The short answer is that it depends on several variables, but let me give you some general guidance.",
  "I understand what you're looking for. While there are many approaches to consider, I'd recommend starting with the fundamentals and building from there.",
  "Absolutely! This is an area where clarity really matters. Let me explain the key concepts and how they connect to your question.",
  "You've touched on something important there. The relationship between these elements is nuanced, but I can help you understand the main dynamics at play.",
  "That makes sense. Given what you've shared, I think the most practical approach would be to focus on incremental progress while keeping the bigger picture in mind.",
];

function getRandomResponse(): string {
  const randomIndex = Math.floor(Math.random() * mockResponses.length);
  return mockResponses[randomIndex];
}

// Simulate network delay for realism
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Simulate API latency (500-1500ms)
    await delay(500 + Math.random() * 1000);

    const response = getRandomResponse();

    return NextResponse.json({ response });
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
