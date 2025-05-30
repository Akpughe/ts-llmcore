/**
 * Grok Provider Adapter for LLMCore package
 */

import axios, { type AxiosInstance } from "axios";
import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  StreamResponse,
  ModelsResponse,
  GrokConfig,
  GrokModel,
  Message,
  UsageMetrics,
  LLMCoreError,
} from "../types/index";
import { AbstractProvider } from "./base";

// Grok uses similar API structure to OpenAI
interface GrokMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

interface GrokRequest {
  model: string;
  messages: GrokMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
  seed?: number;
  user?: string;
}

interface GrokResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: GrokChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

interface GrokChoice {
  index: number;
  message: GrokMessage;
  finish_reason: "stop" | "length" | "content_filter";
}

interface GrokStreamResponse {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: null | "stop" | "length" | "content_filter";
  }>;
}

interface GrokModelsResponse {
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    created: number;
    owned_by: string;
  }>;
}

export class GrokProvider extends AbstractProvider {
  readonly name = "grok";
  readonly displayName = "Grok (xAI)";

  private client: AxiosInstance;

  // Grok model pricing (estimated, per 1M tokens) as of 2024
  private static readonly MODEL_PRICING: Record<
    string,
    { input: number; output: number }
  > = {
    "grok-beta": { input: 5.0, output: 15.0 },
    "grok-vision-beta": { input: 5.0, output: 15.0 },
  };

  private static readonly SUPPORTED_MODELS: GrokModel[] = [
    "grok-beta",
    "grok-vision-beta",
  ];

  constructor(config: GrokConfig) {
    super(config);

    const baseURL = config.baseURL || "https://api.x.ai/v1";

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: config.timeout || 30000,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const grokRequest = this.convertRequest(request);

      const response = await this.client.post<GrokResponse>(
        "/chat/completions",
        grokRequest
      );

      return this.convertResponse(response.data, request);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleAxiosError(error);
      }
      throw this.handleError(error);
    }
  }

  async chatStream(
    request: ChatRequest
  ): Promise<StreamResponse<StreamingChatResponse>> {
    const grokRequest = this.convertRequest(request);
    grokRequest.stream = true;

    const controller = new AbortController();

    try {
      const response = await this.client.post(
        "/chat/completions",
        grokRequest,
        {
          responseType: "stream",
          signal: controller.signal,
        }
      );

      const stream = this.createStreamingResponse(response.data, request);

      return {
        stream,
        controller: {
          abort: () => controller.abort(),
          signal: {
            aborted: controller.signal.aborted,
            addEventListener: (type: string, listener: () => void) => {
              controller.signal.addEventListener(type, listener);
            },
            removeEventListener: (type: string, listener: () => void) => {
              controller.signal.removeEventListener(type, listener);
            },
          },
        },
        metadata: {
          requestId: `grok-${Date.now()}`,
          provider: "grok",
          model: request.model,
          startTime: Date.now(),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleAxiosError(error);
      }
      throw this.handleError(error);
    }
  }

  async getModels(): Promise<ModelsResponse> {
    // Return our supported models as Grok may not have a public models endpoint
    const supportedModels = GrokProvider.SUPPORTED_MODELS.map((modelId) => {
      const pricing = GrokProvider.MODEL_PRICING[modelId]!; // All supported models have pricing
      return {
        id: modelId,
        name: modelId,
        contextLength: this.getModelContextLength(modelId),
        maxTokens: this.getModelMaxTokens(modelId),
        pricing: {
          promptTokens: pricing.input,
          completionTokens: pricing.output,
          currency: "USD",
          unit: "per_1m_tokens",
        },
        capabilities: {
          streaming: true,
          tools: false,
          vision: modelId.includes("vision"),
          json: true,
          maxTemperature: 2,
          maxTopP: 1,
        },
        status: "active" as const,
      };
    });

    return {
      provider: "grok",
      models: supportedModels,
      timestamp: Date.now(),
    };
  }

  override async estimateCost(request: ChatRequest): Promise<number> {
    const model = request.model as GrokModel;
    const pricing = GrokProvider.MODEL_PRICING[model];

    if (!pricing) {
      return super.estimateCost(request);
    }

    const inputTokens = this.estimateTokens(
      request.messages.map((m) => m.content).join(" ")
    );
    const outputTokens = request.maxTokens || 150;

    const inputCost = (inputTokens / 1000000) * pricing.input;
    const outputCost = (outputTokens / 1000000) * pricing.output;

    return inputCost + outputCost;
  }

  private convertRequest(request: ChatRequest): GrokRequest {
    return {
      model: request.model,
      messages: request.messages.map(this.convertMessage),
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
      ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
      ...(request.topP !== undefined && { top_p: request.topP }),
      ...(request.stop !== undefined && { stop: request.stop }),
      ...(request.seed !== undefined && { seed: request.seed }),
      ...(request.user !== undefined && { user: request.user }),
    };
  }

  private convertMessage(message: Message): GrokMessage {
    return {
      role: message.role === "tool" ? "user" : message.role,
      content:
        message.role === "tool"
          ? `Tool result: ${message.content}`
          : message.content,
      ...(message.name && { name: message.name }),
    };
  }

  private convertResponse(
    response: GrokResponse,
    request: ChatRequest
  ): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw this.createError("parsing", "NO_CHOICES", "No choices in response");
    }

    const message: Message = {
      role: choice.message.role as any,
      content: choice.message.content || "",
    };

    const usage: UsageMetrics = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };

    const cost = this.calculateCost(usage, request.model as GrokModel);

    return {
      id: response.id,
      provider: "grok",
      model: request.model,
      created: response.created,
      message,
      finishReason: this.convertFinishReason(choice.finish_reason),
      usage,
      ...(cost && { cost }),
      ...(response.system_fingerprint && {
        metadata: {
          systemFingerprint: response.system_fingerprint,
        },
      }),
    };
  }

  private async *createStreamingResponse(
    stream: any,
    request: ChatRequest
  ): AsyncGenerator<StreamingChatResponse> {
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            return;
          }

          try {
            const parsed: GrokStreamResponse = JSON.parse(data);
            const choice = parsed.choices[0];

            if (choice && (choice.delta.content || choice.delta.role)) {
              yield {
                id: parsed.id,
                provider: "grok",
                model: request.model,
                created: parsed.created,
                delta: {
                  ...(choice.delta.role && { role: choice.delta.role }),
                  ...(choice.delta.content && {
                    content: choice.delta.content,
                  }),
                },
                ...(choice.finish_reason && {
                  finishReason: this.convertFinishReason(choice.finish_reason),
                }),
                isComplete: choice.finish_reason !== null,
              };
            }
          } catch (error) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    }
  }

  private convertFinishReason(
    reason: string
  ): "stop" | "length" | "tool_calls" | "content_filter" | "error" {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "content_filter":
        return "content_filter";
      default:
        return "error";
    }
  }

  private calculateCost(usage: UsageMetrics, model: GrokModel) {
    const pricing = GrokProvider.MODEL_PRICING[model];
    if (!pricing) return undefined;

    const promptCost = (usage.promptTokens / 1000000) * pricing.input;
    const completionCost = (usage.completionTokens / 1000000) * pricing.output;

    return {
      promptCost,
      completionCost,
      totalCost: promptCost + completionCost,
      currency: "USD",
    };
  }

  private getModelContextLength(model: GrokModel): number {
    const contextLengths: Record<GrokModel, number> = {
      "grok-beta": 128000,
      "grok-vision-beta": 128000,
    };
    return contextLengths[model] || 128000;
  }

  private getModelMaxTokens(model: GrokModel): number {
    const maxTokens: Record<GrokModel, number> = {
      "grok-beta": 4096,
      "grok-vision-beta": 4096,
    };
    return maxTokens[model] || 4096;
  }

  private handleAxiosError(error: any): LLMCoreError {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      return this.createError(
        "authentication",
        "INVALID_API_KEY",
        "Invalid API key provided",
        401,
        { originalError: data }
      );
    }

    if (status === 429) {
      return this.createError(
        "rate_limit",
        "RATE_LIMIT_EXCEEDED",
        "Rate limit exceeded",
        429,
        {
          originalError: data,
          retryAfter: error.response?.headers?.["retry-after"],
        }
      );
    }

    if (status === 400) {
      return this.createError(
        "validation",
        "INVALID_REQUEST",
        data?.error?.message || "Invalid request",
        400,
        { originalError: data }
      );
    }

    if (status && status >= 500) {
      return this.createError(
        "server_error",
        "SERVER_ERROR",
        "Grok server error",
        status,
        { originalError: data }
      );
    }

    return this.createError(
      "network",
      "REQUEST_FAILED",
      error.message || "Request failed",
      status,
      { originalError: data }
    );
  }
}
