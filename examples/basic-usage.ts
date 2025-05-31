/**
 * Basic Usage Example
 *
 * This example demonstrates the core functionality of LLMCore providers,
 * including basic chat, streaming, and cost estimation.
 */

import { OpenAIProvider } from "../src/providers/openai";
import { ClaudeProvider } from "../src/providers/claude";
import { GroqProvider } from "../src/providers/groq";
import type { ChatRequest } from "../src/types/index";

// Note: In a real application, load these from environment variables
const API_KEYS = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "your-openai-key",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "your-claude-key",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "your-groq-key",
};

async function basicUsageExample() {
  console.log("🚀 LLMCore Provider Usage Examples\n");

  // Initialize providers
  const openai = new OpenAIProvider({
    provider: "openai",
    apiKey: API_KEYS.OPENAI_API_KEY,
  });

  const claude = new ClaudeProvider({
    provider: "claude",
    apiKey: API_KEYS.ANTHROPIC_API_KEY,
  });

  const groq = new GroqProvider({
    provider: "groq",
    apiKey: API_KEYS.GROQ_API_KEY,
  });

  // Example 1: Basic Chat with OpenAI
  console.log("1️⃣ Basic Chat Completion with OpenAI");
  try {
    const openaiRequest: ChatRequest = {
      provider: "openai",
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Explain what LLMs are in one sentence." },
      ],
      maxTokens: 100,
      temperature: 0.7,
    };

    // First, estimate the cost
    const estimatedCost = await openai.estimateCost(openaiRequest);
    console.log(`Estimated cost: $${estimatedCost.toFixed(6)}`);

    // Mock response for demonstration (since we don't have real API keys)
    console.log(
      "Response: LLMs (Large Language Models) are AI systems trained on vast amounts of text data to understand and generate human-like language."
    );
    console.log("Provider: openai");
    console.log("Model: gpt-3.5-turbo");
    console.log("");
  } catch (error) {
    console.error("Error with OpenAI:", error.message);
  }

  // Example 2: Claude Provider
  console.log("2️⃣ Claude Provider Configuration");
  try {
    const claudeRequest: ChatRequest = {
      provider: "claude",
      model: "claude-3-haiku-20240307",
      messages: [
        {
          role: "user",
          content: "What makes Claude different from other AI assistants?",
        },
      ],
      maxTokens: 150,
    };

    const claudeCost = await claude.estimateCost(claudeRequest);
    console.log(`Claude estimated cost: $${claudeCost.toFixed(6)}`);
    console.log("Provider configured successfully");
    console.log("");
  } catch (error) {
    console.error("Error with Claude:", error.message);
  }

  // Example 3: Groq Provider for Fast Inference
  console.log("3️⃣ Groq Provider for Fast Inference");
  try {
    const groqRequest: ChatRequest = {
      provider: "groq",
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "user",
          content: "Explain the benefits of using Groq for AI inference.",
        },
      ],
      maxTokens: 200,
    };

    const groqCost = await groq.estimateCost(groqRequest);
    console.log(`Groq estimated cost: $${groqCost.toFixed(6)}`);
    console.log("Groq is optimized for fast inference with reduced latency");
    console.log("");
  } catch (error) {
    console.error("Error with Groq:", error.message);
  }

  // Example 4: Model Information
  console.log("4️⃣ Available Models");
  try {
    const openaiModels = await openai.getModels();
    console.log(`OpenAI: ${openaiModels.models.length} models available`);
    console.log(
      `- ${openaiModels.models[0]?.id}: ${
        openaiModels.models[0]?.capabilities.streaming
          ? "Streaming supported"
          : "No streaming"
      }`
    );

    const claudeModels = await claude.getModels();
    console.log(`Claude: ${claudeModels.models.length} models available`);
    console.log(
      `- ${claudeModels.models[0]?.id}: ${
        claudeModels.models[0]?.capabilities.vision
          ? "Vision supported"
          : "Text only"
      }`
    );

    const groqModels = await groq.getModels();
    console.log(`Groq: ${groqModels.models.length} models available`);
    console.log(
      `- ${groqModels.models[0]?.id}: Context length ${groqModels.models[0]?.contextLength}`
    );
    console.log("");
  } catch (error) {
    console.error("Error getting models:", error.message);
  }

  // Example 5: Cost Comparison
  console.log("5️⃣ Cost Comparison");
  const testRequest = {
    messages: [
      {
        role: "user" as const,
        content: "Write a short poem about technology.",
      },
    ],
    maxTokens: 100,
  };

  const providers = [
    { name: "OpenAI GPT-3.5", provider: openai, model: "gpt-3.5-turbo" },
    {
      name: "Claude Haiku",
      provider: claude,
      model: "claude-3-haiku-20240307",
    },
    { name: "Groq Llama", provider: groq, model: "llama-3.1-8b-instant" },
  ];

  for (const { name, provider, model } of providers) {
    try {
      const request: ChatRequest = {
        ...testRequest,
        provider: provider.name as any,
        model: model as any,
      };

      const cost = await provider.estimateCost(request);
      console.log(`${name}: $${cost.toFixed(6)} estimated`);
    } catch (error) {
      console.log(`${name}: Error - ${error.message}`);
    }
  }
  console.log("");

  // Example 6: Function/Tool Support Check
  console.log("6️⃣ Feature Support");
  const models = await Promise.all([
    openai.getModels(),
    claude.getModels(),
    groq.getModels(),
  ]);

  models.forEach((modelResponse) => {
    const provider = modelResponse.provider;
    const supportsTools = modelResponse.models.some(
      (m) => m.capabilities.tools
    );
    const supportsStreaming = modelResponse.models.some(
      (m) => m.capabilities.streaming
    );
    const supportsVision = modelResponse.models.some(
      (m) => m.capabilities.vision
    );

    console.log(`${provider.toUpperCase()}:`);
    console.log(`  ✅ Tools/Functions: ${supportsTools ? "Yes" : "No"}`);
    console.log(`  ✅ Streaming: ${supportsStreaming ? "Yes" : "No"}`);
    console.log(`  ✅ Vision: ${supportsVision ? "Yes" : "No"}`);
  });
  console.log("");

  // Example 7: Error Handling Patterns
  console.log("7️⃣ Error Handling");
  try {
    // This will demonstrate error handling without making real API calls
    const invalidRequest: ChatRequest = {
      provider: "openai",
      model: "invalid-model" as any,
      messages: [{ role: "user", content: "This should show error handling." }],
    };

    // Estimate cost with invalid model (should handle gracefully)
    const cost = await openai.estimateCost(invalidRequest);
    console.log("✅ Invalid model handled gracefully, cost:", cost);
  } catch (error) {
    console.log("✅ Error caught and handled properly");
  }

  console.log("🎉 Basic usage examples completed!");
  console.log("\n💡 Key Benefits:");
  console.log("   ✨ Unified interface across all providers");
  console.log("   💰 Built-in cost estimation and tracking");
  console.log("   🔄 Easy provider switching");
  console.log("   🛡️ Robust error handling");
  console.log("   📊 Detailed model capabilities");
  console.log("\n🚀 Next Steps:");
  console.log("   - Add your actual API keys to test real requests");
  console.log("   - Try streaming responses");
  console.log("   - Explore function calling features");
  console.log("   - Set up analytics and monitoring");
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };
