/**
 * Streaming Support Utilities
 * Unified streaming interface, error handling, and reconnection logic
 */

import type {
  ChatRequest,
  StreamingChatResponse,
  StreamResponse,
  ProviderName,
  LLMCoreError,
} from "../types/index";
import { ResponseStandardizer } from "./response-standardizer";

export interface StreamOptions {
  // Reconnection settings
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectDelay?: number;

  // Buffer settings
  bufferSize?: number;
  bufferTimeout?: number;

  // Error handling
  ignoreErrors?: boolean;
  errorCallback?: (error: LLMCoreError) => void;

  // Debugging
  debug?: boolean;
  onChunk?: (chunk: StreamingChatResponse, index: number) => void;
}

export interface StreamMetrics {
  startTime: number;
  endTime?: number;
  totalChunks: number;
  totalBytes: number;
  avgChunkSize: number;
  reconnectAttempts: number;
  errors: number;
  latencies: number[];
}

export class StreamManager {
  private options: Required<StreamOptions>;
  private metrics: StreamMetrics;
  private abortController?: AbortController;
  private isActive = false;

  constructor(options: StreamOptions = {}) {
    this.options = {
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      reconnectBackoffMultiplier: 2,
      maxReconnectDelay: 30000,
      bufferSize: 1024 * 64, // 64KB
      bufferTimeout: 5000,
      ignoreErrors: false,
      debug: false,
      ...options,
      errorCallback: options.errorCallback || (() => {}),
      onChunk: options.onChunk || (() => {}),
    };

    this.metrics = {
      startTime: Date.now(),
      totalChunks: 0,
      totalBytes: 0,
      avgChunkSize: 0,
      reconnectAttempts: 0,
      errors: 0,
      latencies: [],
    };
  }

  /**
   * Create a unified streaming interface
   */
  async *createStream<T extends StreamingChatResponse>(
    request: ChatRequest,
    provider: ProviderName,
    streamFunction: (
      req: ChatRequest,
      signal?: AbortSignal
    ) => Promise<StreamResponse<T>>
  ): AsyncGenerator<T, void, unknown> {
    this.isActive = true;
    this.metrics.startTime = Date.now();
    let chunkIndex = 0;
    let reconnectAttempts = 0;

    while (
      this.isActive &&
      reconnectAttempts <= this.options.maxReconnectAttempts
    ) {
      try {
        this.abortController = new AbortController();
        const streamResponse = await streamFunction(
          request,
          this.abortController.signal
        );

        for await (const chunk of streamResponse.stream) {
          if (!this.isActive) break;

          try {
            // Record metrics
            const chunkSize = JSON.stringify(chunk).length;
            this.updateMetrics(chunkSize, chunkIndex);

            // Standardize chunk
            const standardizedChunk = ResponseStandardizer.standardizeStream(
              chunk,
              chunkIndex,
              this.metrics.startTime
            ) as unknown as T;

            // Debug callback
            this.options.onChunk(chunk, chunkIndex);

            // Yield the chunk
            yield standardizedChunk;

            chunkIndex++;

            // Check for completion
            if (chunk.isComplete) {
              this.debug(`Stream completed after ${chunkIndex} chunks`);
              break;
            }
          } catch (chunkError) {
            this.handleChunkError(chunkError as Error, chunkIndex);
            if (!this.options.ignoreErrors) {
              throw chunkError;
            }
          }
        }

        // Stream completed successfully
        break;
      } catch (error) {
        const streamError = error as Error;
        this.debug(`Stream error: ${streamError.message}`);

        if (this.shouldReconnect(streamError, reconnectAttempts)) {
          reconnectAttempts++;
          this.metrics.reconnectAttempts++;

          const delay = Math.min(
            this.options.reconnectDelay *
              Math.pow(
                this.options.reconnectBackoffMultiplier,
                reconnectAttempts - 1
              ),
            this.options.maxReconnectDelay
          );

          this.debug(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${this.options.maxReconnectAttempts})`
          );
          await this.delay(delay);
          continue;
        }

        // Create standardized error
        const llmError = ResponseStandardizer.standardizeError(
          streamError,
          provider,
          {
            type: "streaming",
            chunkIndex,
            reconnectAttempts,
          }
        );

        this.options.errorCallback(llmError);
        throw llmError;
      }
    }

    this.metrics.endTime = Date.now();
    this.isActive = false;
  }

  /**
   * Create a buffered stream with automatic batching
   */
  async *createBufferedStream<T extends StreamingChatResponse>(
    request: ChatRequest,
    provider: ProviderName,
    streamFunction: (
      req: ChatRequest,
      signal?: AbortSignal
    ) => Promise<StreamResponse<T>>
  ): AsyncGenerator<T[], void, unknown> {
    const buffer: T[] = [];
    let bufferTimer: NodeJS.Timeout | undefined;

    const flushBuffer = () => {
      if (buffer.length > 0) {
        const batch = [...buffer];
        buffer.length = 0;
        return batch;
      }
      return null;
    };

    const scheduleFlush = () => {
      if (bufferTimer) clearTimeout(bufferTimer);
      bufferTimer = setTimeout(() => {
        const batch = flushBuffer();
        if (batch) {
          // Note: This would need to be handled differently in a real async generator
          this.debug(`Flushing buffer with ${batch.length} chunks`);
        }
      }, this.options.bufferTimeout);
    };

    try {
      for await (const chunk of this.createStream(
        request,
        provider,
        streamFunction
      )) {
        buffer.push(chunk);

        // Flush buffer when size limit reached
        if (buffer.length >= this.options.bufferSize / 1024) {
          // Rough chunk count estimate
          if (bufferTimer) clearTimeout(bufferTimer);
          const batch = flushBuffer();
          if (batch) yield batch;
        } else {
          scheduleFlush();
        }

        // Flush on completion
        if (chunk.isComplete) {
          if (bufferTimer) clearTimeout(bufferTimer);
          const batch = flushBuffer();
          if (batch) yield batch;
          break;
        }
      }
    } finally {
      if (bufferTimer) clearTimeout(bufferTimer);
      // Final flush
      const batch = flushBuffer();
      if (batch && batch.length > 0) yield batch;
    }
  }

  /**
   * Abort the current stream
   */
  abort(): void {
    this.debug("Aborting stream");
    this.isActive = false;
    this.abortController?.abort();
  }

  /**
   * Get streaming metrics
   */
  getMetrics(): StreamMetrics {
    return {
      ...this.metrics,
      avgChunkSize:
        this.metrics.totalChunks > 0
          ? this.metrics.totalBytes / this.metrics.totalChunks
          : 0,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      startTime: Date.now(),
      totalChunks: 0,
      totalBytes: 0,
      avgChunkSize: 0,
      reconnectAttempts: 0,
      errors: 0,
      latencies: [],
    };
  }

  private updateMetrics(chunkSize: number, chunkIndex: number): void {
    this.metrics.totalChunks++;
    this.metrics.totalBytes += chunkSize;

    // Track latency for this chunk
    const now = Date.now();
    const latency = now - this.metrics.startTime - chunkIndex * 50; // Rough estimate
    this.metrics.latencies.push(latency);

    // Keep only last 100 latencies
    if (this.metrics.latencies.length > 100) {
      this.metrics.latencies.shift();
    }
  }

  private handleChunkError(error: Error, chunkIndex: number): void {
    this.metrics.errors++;
    this.debug(`Chunk error at index ${chunkIndex}: ${error.message}`);

    const llmError: LLMCoreError = {
      name: "LLMCoreError",
      type: "server_error",
      code: "CHUNK_ERROR",
      message: `Error processing chunk ${chunkIndex}: ${error.message}`,
      provider: "stream" as any,
      retryable: true,
      timestamp: Date.now(),
      details: { chunkIndex, originalError: error.message },
    };

    this.options.errorCallback(llmError);
  }

  private shouldReconnect(error: Error, attemptCount: number): boolean {
    if (attemptCount >= this.options.maxReconnectAttempts) return false;

    // Don't reconnect on abort
    if (error.name === "AbortError") return false;

    // Reconnect on network errors, timeouts, and 5xx server errors
    const retryableErrors = [
      "NetworkError",
      "TimeoutError",
      "ECONNRESET",
      "ECONNREFUSED",
      "ETIMEDOUT",
    ];

    const isRetryableError = retryableErrors.some(
      (errorType) =>
        error.message.includes(errorType) || error.name.includes(errorType)
    );

    // Check for HTTP 5xx errors
    const isServerError =
      error.message.includes("5") && error.message.includes("server");

    return isRetryableError || isServerError;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private debug(message: string): void {
    if (this.options.debug) {
      console.debug(`[StreamManager] ${message}`);
    }
  }
}

/**
 * Utility functions for stream processing
 */
export class StreamUtils {
  /**
   * Combine multiple streams into one
   */
  static async *combineStreams<T>(
    ...streams: AsyncIterable<T>[]
  ): AsyncGenerator<T, void, unknown> {
    const promises = streams.map(async (stream, index) => {
      const results: { value: T; index: number }[] = [];
      for await (const value of stream) {
        results.push({ value, index });
      }
      return results;
    });

    const allResults = await Promise.all(promises);

    // Flatten and sort by some criteria if needed
    for (const results of allResults) {
      for (const { value } of results) {
        yield value;
      }
    }
  }

  /**
   * Transform stream chunks
   */
  static async *transformStream<T, U>(
    stream: AsyncIterable<T>,
    transformer: (chunk: T, index: number) => U | Promise<U>
  ): AsyncGenerator<U, void, unknown> {
    let index = 0;
    for await (const chunk of stream) {
      yield await transformer(chunk, index++);
    }
  }

  /**
   * Filter stream chunks
   */
  static async *filterStream<T>(
    stream: AsyncIterable<T>,
    predicate: (chunk: T, index: number) => boolean | Promise<boolean>
  ): AsyncGenerator<T, void, unknown> {
    let index = 0;
    for await (const chunk of stream) {
      if (await predicate(chunk, index++)) {
        yield chunk;
      }
    }
  }

  /**
   * Take only first N chunks from stream
   */
  static async *takeStream<T>(
    stream: AsyncIterable<T>,
    count: number
  ): AsyncGenerator<T, void, unknown> {
    let taken = 0;
    for await (const chunk of stream) {
      if (taken >= count) break;
      yield chunk;
      taken++;
    }
  }

  /**
   * Collect all chunks from stream into array
   */
  static async collectStream<T>(stream: AsyncIterable<T>): Promise<T[]> {
    const chunks: T[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * Convert stream to string (for text streams)
   */
  static async streamToString(
    stream: AsyncIterable<StreamingChatResponse>
  ): Promise<string> {
    let result = "";
    for await (const chunk of stream) {
      if (chunk.delta.content) {
        result += chunk.delta.content;
      }
    }
    return result;
  }

  /**
   * Monitor stream health and performance
   */
  static monitorStream<T extends StreamingChatResponse>(
    stream: AsyncIterable<T>,
    onMetrics?: (metrics: {
      chunksReceived: number;
      totalTime: number;
      avgLatency: number;
    }) => void
  ): AsyncIterable<T> {
    return (async function* () {
      const startTime = Date.now();
      let chunksReceived = 0;
      const latencies: number[] = [];

      for await (const chunk of stream) {
        const chunkTime = Date.now();
        const latency = chunkTime - startTime;
        latencies.push(latency);
        chunksReceived++;

        if (onMetrics) {
          const avgLatency =
            latencies.reduce((a, b) => a + b, 0) / latencies.length;
          onMetrics({
            chunksReceived,
            totalTime: chunkTime - startTime,
            avgLatency,
          });
        }

        yield chunk;
      }
    })();
  }
}
