/**
 * Model Capability Detection Utilities
 */

import type { ModelName, ProviderName } from "../types/index";

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  json: boolean;
  maxTemperature: number;
  maxTopP: number;
  contextLength: number;
  maxTokens: number;
  multimodal: boolean;
  reasoning: boolean;
}

export class ModelCapabilityDetector {
  private static readonly CAPABILITIES: Record<
    ProviderName,
    Record<string, ModelCapabilities>
  > = {
    openai: {
      "gpt-4o": {
        streaming: true,
        tools: true,
        vision: true,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 128000,
        maxTokens: 4096,
        multimodal: true,
        reasoning: true,
      },
      "gpt-4o-mini": {
        streaming: true,
        tools: true,
        vision: true,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 128000,
        maxTokens: 4096,
        multimodal: true,
        reasoning: false,
      },
      default: {
        streaming: true,
        tools: true,
        vision: false,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 8192,
        maxTokens: 4096,
        multimodal: false,
        reasoning: false,
      },
    },
    claude: {
      "claude-3-opus-20240229": {
        streaming: true,
        tools: true,
        vision: true,
        json: true,
        maxTemperature: 1.0,
        maxTopP: 1.0,
        contextLength: 200000,
        maxTokens: 4096,
        multimodal: true,
        reasoning: true,
      },
      "claude-3-sonnet-20240229": {
        streaming: true,
        tools: true,
        vision: true,
        json: true,
        maxTemperature: 1.0,
        maxTopP: 1.0,
        contextLength: 200000,
        maxTokens: 4096,
        multimodal: true,
        reasoning: true,
      },
      "claude-3-haiku-20240307": {
        streaming: true,
        tools: true,
        vision: true,
        json: true,
        maxTemperature: 1.0,
        maxTopP: 1.0,
        contextLength: 200000,
        maxTokens: 4096,
        multimodal: true,
        reasoning: false,
      },
      default: {
        streaming: true,
        tools: true,
        vision: true,
        json: true,
        maxTemperature: 1.0,
        maxTopP: 1.0,
        contextLength: 200000,
        maxTokens: 4096,
        multimodal: true,
        reasoning: false,
      },
    },
    groq: {
      "llama-3.1-8b-instant": {
        streaming: true,
        tools: true,
        vision: false,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 8192,
        maxTokens: 2048,
        multimodal: false,
        reasoning: false,
      },
      "llama-3.1-70b-versatile": {
        streaming: true,
        tools: true,
        vision: false,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 8192,
        maxTokens: 2048,
        multimodal: false,
        reasoning: true,
      },
      default: {
        streaming: true,
        tools: false,
        vision: false,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 8192,
        maxTokens: 2048,
        multimodal: false,
        reasoning: false,
      },
    },
    grok: {
      "grok-beta": {
        streaming: true,
        tools: true,
        vision: false,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 131072,
        maxTokens: 4096,
        multimodal: false,
        reasoning: true,
      },
      default: {
        streaming: true,
        tools: true,
        vision: false,
        json: true,
        maxTemperature: 2.0,
        maxTopP: 1.0,
        contextLength: 131072,
        maxTokens: 4096,
        multimodal: false,
        reasoning: true,
      },
    },
  };

  static getCapabilities(
    model: ModelName,
    provider: ProviderName
  ): ModelCapabilities {
    const providerCaps = this.CAPABILITIES[provider];
    return providerCaps[model] || providerCaps["default"];
  }

  static supportsFeature(
    model: ModelName,
    provider: ProviderName,
    feature: keyof ModelCapabilities
  ): boolean {
    const caps = this.getCapabilities(model, provider);
    return !!caps[feature];
  }

  static findCompatibleModels(
    requiredFeatures: Array<keyof ModelCapabilities>,
    providers?: ProviderName[]
  ): Array<{
    model: ModelName;
    provider: ProviderName;
    capabilities: ModelCapabilities;
  }> {
    const searchProviders =
      providers || (["openai", "claude", "groq", "grok"] as ProviderName[]);
    const compatible = [];

    for (const provider of searchProviders) {
      const providerCaps = this.CAPABILITIES[provider];
      for (const [model, capabilities] of Object.entries(providerCaps)) {
        if (model === "default") continue;

        const hasAllFeatures = requiredFeatures.every(
          (feature) => capabilities[feature] === true
        );

        if (hasAllFeatures) {
          compatible.push({
            model: model as ModelName,
            provider,
            capabilities,
          });
        }
      }
    }

    return compatible;
  }
}
