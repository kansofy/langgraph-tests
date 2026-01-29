/**
 * MCP JSON-RPC Client for E2E Testing
 *
 * Handles MCP tool calls via the /rpc endpoint (stateless JSON-RPC)
 */

export interface ToolCallResult {
  isError: boolean;
  content: Array<{ type: string; text: string }>;
  _meta?: Record<string, unknown>;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: ToolCallResult;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export class MCPTestClient {
  private baseUrl: string;
  private accessToken: string;
  private requestId: number = 0;

  constructor(accessToken: string, baseUrl?: string) {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl || process.env.MCP_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      // HTTP-level error
      const errorText = await response.text();
      return {
        isError: true,
        content: [{ type: 'text', text: `HTTP ${response.status}: ${errorText}` }],
      };
    }

    const mcpResponse: MCPResponse = await response.json();

    if (mcpResponse.error) {
      // JSON-RPC level error
      return {
        isError: true,
        content: [{ type: 'text', text: mcpResponse.error.message }],
      };
    }

    return mcpResponse.result || {
      isError: true,
      content: [{ type: 'text', text: 'No result in response' }],
    };
  }

  /**
   * List available tools
   */
  async listTools(): Promise<Array<{ name: string; description: string }>> {
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method: 'tools/list',
    };

    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.status}`);
    }

    const mcpResponse: MCPResponse = await response.json();

    if (mcpResponse.error) {
      throw new Error(mcpResponse.error.message);
    }

    return (mcpResponse.result as unknown as { tools: Array<{ name: string; description: string }> }).tools || [];
  }

  /**
   * Check server health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Update access token (e.g., after refresh)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}

/**
 * Parse tool response content as JSON
 */
export function parseToolResponse<T>(result: ToolCallResult): T | null {
  if (result.isError) {
    return null;
  }

  const textContent = result.content.find(c => c.type === 'text');
  if (!textContent) {
    return null;
  }

  try {
    return JSON.parse(textContent.text) as T;
  } catch {
    return null;
  }
}

/**
 * Check if tool response indicates authorization denied
 */
export function isAuthorizationDenied(result: ToolCallResult): boolean {
  if (!result.isError) {
    return false;
  }

  const text = result.content[0]?.text?.toLowerCase() || '';
  return text.includes('access denied') ||
         text.includes('requires scope') ||
         text.includes('unauthorized') ||
         text.includes('forbidden');
}
