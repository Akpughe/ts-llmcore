/**
 * OpenAI Provider Adapter for LLMCore package
 */

import axios, { type AxiosInstance } from "axios";
import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  StreamResponse,
  ModelsResponse,
  OpenAIConfig,
  OpenAIModel,
  Message,
  UsageMetrics,
  LLMCoreError,
} from "../types/index";
import { AbstractProvider } from "./base";

// OpenAI API interfaces
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?:
    | "auto"
    | "none"
    | "required"
    | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
  seed?: number;
  user?: string;
  n?: number;
  logprobs?: boolean;
  top_logprobs?: number;
}

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason:
    | "stop"
    | "length"
    | "function_call"
    | "tool_calls"
    | "content_filter";
  logprobs?: {
    content: Array<{
      token: string;
      logprob: number;
      bytes: number[];
      top_logprobs: Array<{
        token: string;
        logprob: number;
        bytes: number[];
      }>;
    }>;
  };
}

interface OpenAIStreamResponse {
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
    finish_reason:
      | null
      | "stop"
      | "length"
      | "function_call"
      | "tool_calls"
      | "content_filter";
  }>;
}

interface OpenAIModelsResponse {
  object: "list";
  data: Array<{
    id: string;
    object: "model";
    created: number;
    owned_by: string;
  }>;
}

export class OpenAIProvider extends AbstractProvider {
  readonly name = "openai";
  readonly displayName = "OpenAI";

  private client: AxiosInstance;

  // OpenAI model pricing (per 1K tokens) as of 2024
  private static readonly MODEL_PRICING: Record<
    string,
    { input: number; output: number }
  > = {
    "gpt-4": { input: 0.03, output: 0.06 },
    "gpt-4-turbo-preview": { input: 0.01, output: 0.03 },
    "gpt-4-0125-preview": { input: 0.01, output: 0.03 },
    "gpt-4o": { input: 0.005, output: 0.015 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
    "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
    "gpt-3.5-turbo-16k": { input: 0.003, output: 0.004 },
  };

  private static readonly SUPPORTED_MODELS: OpenAIModel[] = [
    "gpt-4",
    "gpt-4-turbo-preview",
    "gpt-4-0125-preview",
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-16k",
  ];

  constructor(config: OpenAIConfig) {
    super(config);

    const baseURL = config.baseURL || "https://api.openai.com/v1";

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        ...(config.organization && {
          "OpenAI-Organization": config.organization,
        }),
        ...(config.project && { "OpenAI-Project": config.project }),
      },
      timeout: config.timeout || 30000,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const openaiRequest = this.convertRequest(request);

      const response = await this.client.post<OpenAIResponse>(
        "/chat/completions",
        openaiRequest
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
    const openaiRequest = this.convertRequest(request);
    openaiRequest.stream = true;

    const controller = new AbortController();

    try {
      const response = await this.client.post(
        "/chat/completions",
        openaiRequest,
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
          requestId: `openai-${Date.now()}`,
          provider: "openai",
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
      const response = await this.client.get<OpenAIModelsResponse>("/models");

      const supportedModels = response.data.data
        .filter((model) =>
          OpenAIProvider.SUPPORTED_MODELS.includes(model.id as OpenAIModel)
        )
        .filter((model) => OpenAIProvider.MODEL_PRICING[model.id]) // Only include models with pricing
        .map((model) => {
          const pricing = OpenAIProvider.MODEL_PRICING[model.id]!; // Non-null assertion since we filtered
          return {
            id: model.id,
            name: model.id,
            contextLength: this.getModelContextLength(model.id as OpenAIModel),
            maxTokens: this.getModelMaxTokens(model.id as OpenAIModel),
            pricing: {
              promptTokens: pricing.input,
              completionTokens: pricing.output,
              currency: "USD",
              unit: "per_1k_tokens",
            },
            capabilities: {
              streaming: true,
              tools: true,
              vision: model.id.includes("vision") || model.id.includes("4o"),
              json: true,
              maxTemperature: 2,
              maxTopP: 1,
            },
            status: "active" as const,
          };
        });

      return {
        provider: "openai",
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
    const model = request.model as OpenAIModel;
    const pricing = OpenAIProvider.MODEL_PRICING[model];

    if (!pricing) {
      return super.estimateCost(request);
    }

    const inputTokens = this.estimateTokens(
      request.messages.map((m) => m.content).join(" ")
    );
    const outputTokens = request.maxTokens || 150;

    const inputCost = (inputTokens / 1000) * pricing.input;
    const outputCost = (outputTokens / 1000) * pricing.output;

    return inputCost + outputCost;
  }

  private convertRequest(request: ChatRequest): OpenAIRequest {
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
      ...(request.responseFormat && {
        response_format: { type: request.responseFormat.type },
      }),
    };
  }

  private convertMessage(message: Message): OpenAIMessage {
    const baseMessage: OpenAIMessage = {
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
    response: OpenAIResponse,
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
    };

    const cost = this.calculateCost(usage, request.model as OpenAIModel);

    return {
      id: response.id,
      provider: "openai",
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
            const parsed: OpenAIStreamResponse = JSON.parse(data);
            const choice = parsed.choices[0];

            if (
              choice &&
              (choice.delta.content ||
                choice.delta.role ||
                choice.delta.tool_calls)
            ) {
              yield {
                id: parsed.id,
                provider: "openai",
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
      case "function_call":
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
      default:
        return "error";
    }
  }

  private calculateCost(usage: UsageMetrics, model: OpenAIModel) {
    const pricing = OpenAIProvider.MODEL_PRICING[model];
    if (!pricing) return undefined;

    const promptCost = (usage.promptTokens / 1000) * pricing.input;
    const completionCost = (usage.completionTokens / 1000) * pricing.output;

    return {
      promptCost,
      completionCost,
      totalCost: promptCost + completionCost,
      currency: "USD",
    };
  }

  private getModelContextLength(model: OpenAIModel): number {
    const contextLengths: Record<OpenAIModel, number> = {
      "gpt-4": 8192,
      "gpt-4-turbo-preview": 128000,
      "gpt-4-0125-preview": 128000,
      "gpt-4o": 128000,
      "gpt-4o-mini": 128000,
      "gpt-3.5-turbo": 4096,
      "gpt-3.5-turbo-16k": 16384,
    };
    return contextLengths[model] || 4096;
  }

  private getModelMaxTokens(model: OpenAIModel): number {
    const maxTokens: Record<OpenAIModel, number> = {
      "gpt-4": 4096,
      "gpt-4-turbo-preview": 4096,
      "gpt-4-0125-preview": 4096,
      "gpt-4o": 4096,
      "gpt-4o-mini": 16384,
      "gpt-3.5-turbo": 4096,
      "gpt-3.5-turbo-16k": 4096,
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
        "OpenAI server error",
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
