/**
 * Groq Provider Adapter for LLMCore package
 */

import axios, { type AxiosInstance } from "axios";
import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  StreamResponse,
  ModelsResponse,
  GroqConfig,
  GroqModel,
  Message,
  UsageMetrics,
  LLMCoreError,
} from "../types/index";
import { AbstractProvider } from "./base";

// Groq uses OpenAI-compatible API interfaces
interface GroqMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
}

interface GroqToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface GroqRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: GroqTool[];
  tool_choice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; function: { name: string } };
  seed?: number;
  user?: string;
  n?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

interface GroqTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface GroqResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: GroqChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    queue_time?: number;
    prompt_time?: number;
    completion_time?: number;
    total_time?: number;
  };
  system_fingerprint?: string;
}

interface GroqChoice {
  index: number;
  message: GroqMessage;
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter";
}

interface GroqStreamResponse {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: null | "stop" | "length" | "tool_calls" | "content_filter";
  }>;
}

interface GroqModelsResponse {
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    created: number;
    owned_by: string;
  }>;
}

export class GroqProvider extends AbstractProvider {
  readonly name = "groq";
  readonly displayName = "Groq";

  private client: AxiosInstance;

  // Groq model pricing (per 1M tokens) as of 2024
  private static readonly MODEL_PRICING: Record<
    string,
    { input: number; output: number }
  > = {
    "llama-3.1-70b-versatile": { input: 0.59, output: 0.79 },
    "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
    "mixtral-8x7b-32768": { input: 0.24, output: 0.24 },
    "gemma-7b-it": { input: 0.07, output: 0.07 },
    "gemma2-9b-it": { input: 0.2, output: 0.2 },
  };

  private static readonly SUPPORTED_MODELS: GroqModel[] = [
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma-7b-it",
    "gemma2-9b-it",
  ];

  constructor(config: GroqConfig) {
    super(config);

    const baseURL = config.baseURL || "https://api.groq.com/openai/v1";

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
      const groqRequest = this.convertRequest(request);

      const response = await this.client.post<GroqResponse>(
        "/chat/completions",
        groqRequest
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
    const groqRequest = this.convertRequest(request);
    groqRequest.stream = true;

    const controller = new AbortController();

    try {
      const response = await this.client.post(
        "/chat/completions",
        groqRequest,
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
          requestId: `groq-${Date.now()}`,
          provider: "groq",
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
    try {
      const response = await this.client.get<GroqModelsResponse>("/models");

      const supportedModels = response.data.data
        .filter((model) =>
          GroqProvider.SUPPORTED_MODELS.includes(model.id as GroqModel)
        )
        .filter((model) => GroqProvider.MODEL_PRICING[model.id]) // Only include models with pricing
        .map((model) => {
          const pricing = GroqProvider.MODEL_PRICING[model.id]!; // Non-null assertion since we filtered
          return {
            id: model.id,
            name: model.id,
            contextLength: this.getModelContextLength(model.id as GroqModel),
            maxTokens: this.getModelMaxTokens(model.id as GroqModel),
            pricing: {
              promptTokens: pricing.input,
              completionTokens: pricing.output,
              currency: "USD",
              unit: "per_1m_tokens",
            },
            capabilities: {
              streaming: true,
              tools: true,
              vision: false,
              json: true,
              maxTemperature: 2,
              maxTopP: 1,
              contextLength: this.getModelContextLength(model.id as GroqModel),
              maxTokens: this.getModelMaxTokens(model.id as GroqModel),
              multimodal: false,
              reasoning: model.id.includes("70b"),
            },
            status: "active" as const,
          };
        });

      return {
        provider: "groq",
        models: supportedModels,
        timestamp: Date.now(),
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleAxiosError(error);
      }
      throw this.handleError(error);
    }
  }

  override async estimateCost(request: ChatRequest): Promise<number> {
    const model = request.model as GroqModel;
    const pricing = GroqProvider.MODEL_PRICING[model];

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

  private convertRequest(request: ChatRequest): GroqRequest {
    return {
      model: request.model,
      messages: request.messages.map(this.convertMessage),
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
      ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
      ...(request.topP !== undefined && { top_p: request.topP }),
      ...(request.frequencyPenalty !== undefined && {
        frequency_penalty: request.frequencyPenalty,
      }),
      ...(request.presencePenalty !== undefined && {
        presence_penalty: request.presencePenalty,
      }),
      ...(request.stop !== undefined && { stop: request.stop }),
      ...(request.seed !== undefined && { seed: request.seed }),
      ...(request.user !== undefined && { user: request.user }),
      ...(request.tools && {
        tools: request.tools.map((tool) => ({
          type: "function" as const,
          function: tool.function,
        })),
      }),
      ...(request.toolChoice && { tool_choice: request.toolChoice }),
    };
  }

  private convertMessage(message: Message): GroqMessage {
    const baseMessage: GroqMessage = {
      role: message.role,
      content: message.content,
      ...(message.name && { name: message.name }),
    };

    if (
      message.role === "assistant" &&
      "toolCalls" in message &&
      message.toolCalls
    ) {
      baseMessage.tool_calls = message.toolCalls.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: {
          name: call.function.name,
          arguments: call.function.arguments,
        },
      }));
    }

    if (message.role === "tool" && "toolCallId" in message) {
      baseMessage.tool_call_id = message.toolCallId;
    }

    return baseMessage;
  }

  private convertResponse(
    response: GroqResponse,
    request: ChatRequest
  ): ChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw this.createError("parsing", "NO_CHOICES", "No choices in response");
    }

    const message: Message = {
      role: choice.message.role as any,
      content: choice.message.content || "",
      ...(choice.message.tool_calls && {
        toolCalls: choice.message.tool_calls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        })),
      }),
    };

    const usage: UsageMetrics = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      ...(response.usage.prompt_time && {
        requestDuration: response.usage.total_time,
      }),
      ...(response.usage.queue_time && {
        queueTime: response.usage.queue_time,
      }),
      ...(response.usage.completion_time && {
        processingTime: response.usage.completion_time,
      }),
    };

    const cost = this.calculateCost(usage, request.model as GroqModel);

    return {
      id: response.id,
      provider: "groq",
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
            const parsed: GroqStreamResponse = JSON.parse(data);
            const choice = parsed.choices[0];

            if (
              choice &&
              (choice.delta.content ||
                choice.delta.role ||
                choice.delta.tool_calls)
            ) {
              yield {
                id: parsed.id,
                provider: "groq",
                model: request.model,
                created: parsed.created,
                delta: {
                  ...(choice.delta.role && { role: choice.delta.role }),
                  ...(choice.delta.content && {
                    content: choice.delta.content,
                  }),
                  ...(choice.delta.tool_calls && {
                    toolCalls: choice.delta.tool_calls
                      .filter((call) => call.id || call.function?.name)
                      .map((call) => ({
                        index: call.index,
                        ...(call.id && { id: call.id }),
                        ...(call.type && { type: call.type }),
                        ...(call.function && { function: call.function }),
                      })),
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
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
      default:
        return "error";
    }
  }

  private calculateCost(usage: UsageMetrics, model: GroqModel) {
    const pricing = GroqProvider.MODEL_PRICING[model];
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

  private getModelContextLength(model: GroqModel): number {
    const contextLengths: Record<GroqModel, number> = {
      "llama-3.1-70b-versatile": 131072,
      "llama-3.1-8b-instant": 131072,
      "mixtral-8x7b-32768": 32768,
      "gemma-7b-it": 8192,
      "gemma2-9b-it": 8192,
    };
    return contextLengths[model] || 8192;
  }

  private getModelMaxTokens(model: GroqModel): number {
    const maxTokens: Record<GroqModel, number> = {
      "llama-3.1-70b-versatile": 8000,
      "llama-3.1-8b-instant": 8000,
      "mixtral-8x7b-32768": 32000,
      "gemma-7b-it": 8000,
      "gemma2-9b-it": 8000,
    };
    return maxTokens[model] || 8000;
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
        "Groq server error",
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
