/**
 * Message type definitions for LLMCore package
 */

// Message roles (standardized across all providers)
export type MessageRole = "system" | "user" | "assistant" | "tool";

// Base message interface
export interface BaseMessage {
  role: MessageRole;
  content: string;
  name?: string;
  timestamp?: Date;
}

// System message for setting context/instructions
export interface SystemMessage extends BaseMessage {
  role: "system";
}

// User message from human input
export interface UserMessage extends BaseMessage {
  role: "user";
  attachments?: MessageAttachment[];
}

// Assistant message from AI
export interface AssistantMessage extends BaseMessage {
  role: "assistant";
  toolCalls?: ToolCall[];
  finishReason?: FinishReason;
}

// Tool message for function responses
export interface ToolMessage extends BaseMessage {
  role: "tool";
  toolCallId: string;
}

// Union type for all message types
export type Message =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage;

// Message attachment (for multimodal support)
export interface MessageAttachment {
  type: "image" | "file" | "audio" | "video";
  url?: string;
  data?: string; // base64 encoded
  mimeType?: string;
  filename?: string;
  size?: number;
}

// Tool call definition
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

// Function tool definition
export interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

// Tool definition union
export type Tool = FunctionTool;

// Finish reason for message completion
export type FinishReason =
  | "stop" // Natural completion
  | "length" // Max tokens reached
  | "tool_calls" // Tool/function call made
  | "content_filter" // Content filtered
  | "error"; // Error occurred

// Conversation metadata
export interface ConversationMetadata {
  id?: string;
  title?: string;
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
  customData?: Record<string, unknown>;
}

// Message context for advanced features
export interface MessageContext {
  conversationId?: string;
  parentMessageId?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

// Message with full context
export type ContextualMessage = Message & {
  id?: string;
  context?: MessageContext;
};

// Conversation structure
export interface Conversation {
  id: string;
  messages: ContextualMessage[];
  metadata?: ConversationMetadata;
  totalTokens?: number;
  cost?: number;
}

// Message validation result
export interface MessageValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
