import { useState, useEffect } from "react";
import { Brain, Send, Clock, ShoppingCart, DollarSign, Package, Receipt, Users, Lightbulb } from "lucide-react";
import { hindsight, type Memory } from "../lib/hindsight";
import { generateAIResponse } from "../lib/groq";
import { processUserMemory } from "../lib/memoryService";

export function AIMemoryAgent() {
  const [activeTab, setActiveTab] = useState<"chat" | "timeline">("chat");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>([
    { role: 'ai', content: "Hello! I'm RecycleMind AI. I remember your business and help you make better decisions." }
  ]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "timeline") {
      loadMemories();
    }
  }, [activeTab]);

  const loadMemories = async () => {
    const data = await hindsight.getRecentMemories(50);
    // Sort newest first
    data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setMemories(data);
  };

  const handleSend = async () => {
    if (!query.trim()) return;
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setQuery("");
    setLoading(true);

    try {
      // 1. Check if user wants to remember something
      const memoryResponse = await processUserMemory(userMsg);
      if (memoryResponse) {
        setMessages(prev => [...prev, { role: 'ai', content: memoryResponse }]);
        setLoading(false);
        return;
      }

      // 2. Extract Intent
      const { extractIntent } = await import("../lib/groq");
      const intents = await extractIntent(userMsg);

      // 3. Fetch structured context using business tools
      const { businessTools } = await import("../lib/businessTools");
      const context = await businessTools.fetchContext(intents, userMsg);
      
      // 4. Generate AI response
      const response = await generateAIResponse(userMsg, context);

      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (error: any) {
      console.error("AI Memory Agent Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: error.message || "An error occurred while generating the response." }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "Who has the highest pending payment?",
    "Which shop buys the most?",
    "Show today's collections.",
    "Which customer usually pays late?",
  ];

  const getMemoryIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'purchase': return <ShoppingCart className="w-6 h-6" />;
      case 'payment': return <DollarSign className="w-6 h-6" />;
      case 'sale': return <Package className="w-6 h-6" />;
      case 'expense': return <Receipt className="w-6 h-6" />;
      case 'attendance': return <Users className="w-6 h-6" />;
      case 'learned memory': return <Lightbulb className="w-6 h-6" />;
      default: return <Clock className="w-6 h-6" />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Brain className="w-8 h-8 text-emerald-500" />
        <h2 className="text-2xl font-bold">AI Memory Agent</h2>
      </div>

      <div className="flex space-x-2 border-b">
        <button
          className={`px-4 py-2 ${activeTab === 'chat' ? 'border-b-2 border-emerald-500 text-emerald-600 font-semibold' : 'text-gray-500'}`}
          onClick={() => setActiveTab("chat")}
        >
          AI Chat
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'timeline' ? 'border-b-2 border-emerald-500 text-emerald-600 font-semibold' : 'text-gray-500'}`}
          onClick={() => setActiveTab("timeline")}
        >
          Memory Timeline
        </button>
      </div>

      {activeTab === "chat" ? (
        <div className="flex flex-col flex-1 bg-white rounded-lg shadow-sm border p-4 space-y-4 overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-800 rounded-lg p-3 animate-pulse">
                  Thinking...
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setQuery(s)} className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors">
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything about your business..."
              className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleSend}
              disabled={loading}
              className="bg-emerald-600 text-white p-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-lg shadow-sm border p-4 overflow-y-auto">
          <div className="space-y-4">
            {memories.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No memories recorded yet.</p>
            ) : (
              memories.map((m) => (
                <div key={m.id} className="border rounded-lg p-4 flex gap-4 hover:border-emerald-200 transition-colors">
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-full h-fit flex items-center justify-center">
                    {getMemoryIcon(m.type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">{m.title}</h4>
                    <p className="text-gray-600 mt-1">{m.content}</p>
                    <div className="text-xs text-gray-400 mt-2 flex gap-2">
                      <span className="bg-gray-100 px-2 py-1 rounded">{m.type}</span>
                      <span className="py-1">{new Date(m.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
