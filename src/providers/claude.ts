/**
 * Claude Provider Adapter for LLMCore package
 */

import axios, { type AxiosInstance, type AxiosError } from "axios";
import type {
  ChatRequest,
  ChatResponse,
  StreamingChatResponse,
  StreamResponse,
  ModelsResponse,
  ClaudeConfig,
  ClaudeModel,
  Message,
  UsageMetrics,
  LLMCoreError,
} from "../types/index";
import { AbstractProvider } from "./base";

// Claude API interfaces
interface ClaudeMessage {
  role: "user" | "assistant";
  content:
    | string
    | Array<{
        type: "text" | "image" | "tool_use" | "tool_result";
        text?: string;
        source?: {
          type: "base64";
          media_type: string;
          data: string;
        };
        tool_use_id?: string;
        content?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
}

interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string;
  tools?: ClaudeTool[];
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
}

interface ClaudeTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "tool_use";
        id: string;
        name: string;
        input: Record<string, unknown>;
      }
  >;
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ClaudeStreamResponse {
  type:
    | "message_start"
    | "content_block_start"
    | "ping"
    | "content_block_delta"
    | "content_block_stop"
    | "message_delta"
    | "message_stop";
  message?: {
    id: string;
    type: "message";
    role: "assistant";
    content: any[];
    model: string;
    stop_reason?: string;
    stop_sequence?: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  index?: number;
  content_block?: {
    type: "text" | "tool_use";
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  delta?: {
    type: "text_delta" | "input_json_delta";
    text?: string;
    partial_json?: string;
    stop_reason?: string;
    stop_sequence?: string;
  };
  usage?: {
    output_tokens: number;
  };
}

export class ClaudeProvider extends AbstractProvider {
  readonly name = "claude";
  readonly displayName = "Claude (Anthropic)";

  private client: AxiosInstance;

  // Claude model pricing (per 1M tokens) as of 2024
  private static readonly MODEL_PRICING: Record<
    string,
    { input: number; output: number }
  > = {
    "claude-3-5-sonnet-20241022": { input: 3.0, output: 15.0 },
    "claude-3-opus-20240229": { input: 15.0, output: 75.0 },
    "claude-3-sonnet-20240229": { input: 3.0, output: 15.0 },
    "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  };

  private static readonly SUPPORTED_MODELS: ClaudeModel[] = [
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
  ];

  constructor(config: ClaudeConfig) {
    super(config);

    const baseURL = config.baseURL || "https://api.anthropic.com";

    this.client = axios.create({
      baseURL,
      headers: {
        "x-api-key": config.apiKey,
        "Content-Type": "application/json",
        "anthropic-version": config.version || "2023-06-01",
      },
      timeout: config.timeout || 30000,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const claudeRequest = this.convertRequest(request);

      const response = await this.client.post<ClaudeResponse>(
        "/v1/messages",
        claudeRequest
      );

      return this.convertResponse(response.data, request);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleAxiosError(error as AxiosError);
      }
      throw this.handleError(error);
    }
  }

  async chatStream(
    request: ChatRequest
  ): Promise<StreamResponse<StreamingChatResponse>> {
    const claudeRequest = this.convertRequest(request);
    claudeRequest.stream = true;

    const controller = new AbortController();

    try {
      const response = await this.client.post("/v1/messages", claudeRequest, {
        responseType: "stream",
        signal: controller.signal,
        headers: {
          Accept: "text/event-stream",
        },
      });

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
          requestId: `claude-${Date.now()}`,
          provider: "claude",
          model: request.model,
          startTime: Date.now(),
        },
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleAxiosError(error as AxiosError);
      }
      throw this.handleError(error);
    }
  }

  async getModels(): Promise<ModelsResponse> {
    // Claude doesn't provide a public models endpoint, so we return our supported models
    const supportedModels = ClaudeProvider.SUPPORTED_MODELS.map((modelId) => {
      const pricing = ClaudeProvider.MODEL_PRICING[modelId];
      if (!pricing) {
        throw new Error(`Missing pricing for model ${modelId}`);
      }
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
          tools: true,
          vision: modelId.includes("opus") || modelId.includes("sonnet"),
          json: true,
          maxTemperature: 1,
          maxTopP: 1,
          contextLength: this.getModelContextLength(modelId),
          maxTokens: this.getModelMaxTokens(modelId),
          multimodal: true,
          reasoning: modelId.includes("opus") || modelId.includes("sonnet"),
        },
        status: "active" as const,
      };
    });

    return {
      provider: "claude",
      models: supportedModels,
      timestamp: Date.now(),
    };
  }

  override async estimateCost(request: ChatRequest): Promise<number> {
    const model = request.model as ClaudeModel;
    const pricing = ClaudeProvider.MODEL_PRICING[model];

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

  private convertRequest(request: ChatRequest): ClaudeRequest {
    const messages = this.convertMessages(request.messages);
    const systemMessage = request.messages.find((m) => m.role === "system");

    return {
      model: request.model,
      messages: messages,
      max_tokens: request.maxTokens || 4096,
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
      ...(request.topP !== undefined && { top_p: request.topP }),
      ...(request.stop && {
        stop_sequences: Array.isArray(request.stop)
          ? request.stop
          : [request.stop],
      }),
      ...(systemMessage && { system: systemMessage.content }),
      ...(request.tools && {
        tools: request.tools.map((tool) => ({
          name: tool.function.name,
          ...(tool.function.description && {
            description: tool.function.description,
          }),
          input_schema: tool.function.parameters,
        })),
      }),
    };
  }

  private convertMessages(messages: Message[]): ClaudeMessage[] {
    return messages
      .filter((m) => m.role !== "system")
      .map((message) => {
        if (message.role === "tool") {
          // Convert tool messages to user messages for Claude
          return {
            role: "user" as const,
            content: `Tool result: ${message.content}`,
          };
        }

        return {
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        };
      });
  }

  private convertResponse(
    response: ClaudeResponse,
    request: ChatRequest
  ): ChatResponse {
    const textContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? block.text : ""))
      .join("");

    const toolCalls = response.content
      .filter((block) => block.type === "tool_use")
      .map((block) => {
        if ("id" in block && "name" in block && "input" in block) {
          return {
            id: block.id,
            type: "function" as const,
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          };
        }
        return null;
      })
      .filter((call): call is NonNullable<typeof call> => call !== null);

    const message: Message = {
      role: "assistant",
      content: textContent,
      ...(toolCalls.length > 0 && { toolCalls }),
    };

    const usage: UsageMetrics = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    const cost = this.calculateCost(usage, request.model as ClaudeModel);

    return {
      id: response.id,
      provider: "claude",
      model: request.model,
      created: Date.now(),
      message,
      finishReason: this.convertFinishReason(response.stop_reason),
      usage,
      ...(cost && { cost }),
    };
  }

  private async *createStreamingResponse(
    stream: ReadableStream<Uint8Array>,
    request: ChatRequest
  ): AsyncGenerator<StreamingChatResponse> {
    const decoder = new TextDecoder();
    let buffer = "";
    let messageId = "";

    for await (const chunk of stream) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          try {
            const parsed: ClaudeStreamResponse = JSON.parse(data);

            if (parsed.type === "message_start" && parsed.message) {
              messageId = parsed.message.id;
            }

            if (parsed.type === "content_block_delta" && parsed.delta?.text) {
              yield {
                id: messageId,
                provider: "claude",
                model: request.model,
                created: Date.now(),
                delta: {
                  content: parsed.delta.text,
                },
                isComplete: false,
              };
            }

            if (parsed.type === "message_stop") {
              yield {
                id: messageId,
                provider: "claude",
                model: request.model,
                created: Date.now(),
                delta: {
                  content: "",
                },
                finishReason: "stop",
                isComplete: true,
              };
              return;
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
      case "end_turn":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_calls";
      case "stop_sequence":
        return "stop";
      default:
        return "error";
    }
  }

  private calculateCost(
    usage: UsageMetrics,
    model: ClaudeModel
  ):
    | {
        promptCost: number;
        completionCost: number;
        totalCost: number;
        currency: string;
      }
    | undefined {
    const pricing = ClaudeProvider.MODEL_PRICING[model];
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

  private getModelContextLength(model: ClaudeModel): number {
    const contextLengths: Record<ClaudeModel, number> = {
      "claude-3-5-sonnet-20241022": 200000,
      "claude-3-opus-20240229": 200000,
      "claude-3-sonnet-20240229": 200000,
      "claude-3-haiku-20240307": 200000,
    };
    return contextLengths[model] || 200000;
  }

  private getModelMaxTokens(model: ClaudeModel): number {
    const maxTokens: Record<ClaudeModel, number> = {
      "claude-3-5-sonnet-20241022": 8192,
      "claude-3-opus-20240229": 4096,
      "claude-3-sonnet-20240229": 4096,
      "claude-3-haiku-20240307": 4096,
    };
    return maxTokens[model] || 4096;
  }

  private handleAxiosError(error: AxiosError): LLMCoreError {
    const status = error.response?.status;
    const data = error.response?.data as {
      error?: { message?: string; type?: string };
    };

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
        "Claude server error",
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
