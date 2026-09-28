import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('VITE_GROQ_API_KEY');

const groq = new Groq({
  apiKey: apiKey || 'dummy-key',
  dangerouslyAllowBrowser: true,
});

export async function extractIntent(query: string): Promise<string[]> {
  if (!apiKey) return ["purchases", "sales", "attendance", "expenses", "stock", "memory"];
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Given the user's query about a business ERP, reply ONLY with a comma-separated list of tables needed to answer it. Choose from: purchases, sales, attendance, expenses, stock, memory. Example: sales, memory"
        },
        {
          role: "user",
          content: query
        }
      ],
      model: "openai/gpt-oss-20b",
    });
    const result = response.choices[0]?.message?.content || "";
    return result.split(',').map(s => s.trim().toLowerCase());
  } catch (e) {
    return ["purchases", "sales", "attendance", "expenses", "stock", "memory"];
  }
}

export async function generateAIResponse(prompt: string, context: string): Promise<string> {
  if (!apiKey) {
    return "Groq API key not configured. Please add VITE_GROQ_API_KEY to your .env file.";
  }
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an AI ERP Analyst for Siva Durga Traders. Provide conversational, rich, and natural answers using the provided analyzed ERP data context. Merge memories naturally. Keep your response short and human (2 to 6 lines max unless the user asks for details). Do not use large markdown tables. Use bullets only when necessary."
        },
        {
          role: "user",
          content: `Analyzed Data:\n${context}\n\nUser Question: ${prompt}`
        }
      ],
      model: "openai/gpt-oss-20b",
    });

    return response.choices[0]?.message?.content || "No response generated.";
  } catch (error: any) {
    console.error("Groq generation error:", error.message || error);
    return `Groq API Error: ${error.message || "Failed to generate response."}`;
  }
}

export async function generateInsights(context: string): Promise<string[]> {
  if (!apiKey) return ["Missing API Key"];
  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are RecycleMind AI. Generate 3 short bullet point insights about the business based on the context. Return ONLY the 3 bullet points separated by newlines."
        },
        {
          role: "user",
          content: `Context:\n${context}`
        }
      ],
      model: "openai/gpt-oss-20b",
    });

    const content = response.choices[0]?.message?.content || "";
    return content.split('\n').filter(line => line.trim().length > 0).slice(0, 3);
  } catch (error) {
    console.error("Groq generation error:", error);
    return ["Failed to load insights"];
  }
}
