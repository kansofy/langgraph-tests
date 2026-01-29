/**
 * JSON Recording Utility for E2E Testing
 *
 * Records every tool call with comprehensive metadata for analysis
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { ToolCallResult } from './mcp-client';

export interface TestRecord {
  timestamp: string;
  tool: string;
  user: string;
  userScopes: string[];
  input: Record<string, unknown>;
  output: {
    success: boolean;
    content: Array<{ type: string; text: string }>;
    duration: number;
  };
  authorization: {
    expected: 'allowed' | 'denied';
    actual: 'allowed' | 'denied';
    match: boolean;
  };
  dataValidation?: {
    checks: Array<{
      name: string;
      expected: unknown;
      actual: unknown;
      passed: boolean;
    }>;
    allPassed: boolean;
  };
}

export interface TestSession {
  sessionId: string;
  testSuite: string;
  startedAt: string;
  completedAt?: string;
  environment: {
    mcpVersion: string;
    baseUrl: string;
    nodeVersion: string;
  };
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    authorizationFailures: number;
    dataValidationFailures: number;
  };
  records: TestRecord[];
}

export class TestRecorder {
  private session: TestSession;
  private recordingsDir: string;

  constructor(testSuite: string, baseUrl: string) {
    const sessionId = `${testSuite}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.recordingsDir = join(process.cwd(), 'recordings');

    // Ensure recordings directory exists
    if (!existsSync(this.recordingsDir)) {
      mkdirSync(this.recordingsDir, { recursive: true });
    }

    this.session = {
      sessionId,
      testSuite,
      startedAt: new Date().toISOString(),
      environment: {
        mcpVersion: '2.0.0',
        baseUrl,
        nodeVersion: process.version,
      },
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        authorizationFailures: 0,
        dataValidationFailures: 0,
      },
      records: [],
    };
  }

  /**
   * Record a tool call with all metadata
   */
  record(params: {
    tool: string;
    user: string;
    userScopes: string[];
    input: Record<string, unknown>;
    result: ToolCallResult;
    duration: number;
    expectedAuthorization: 'allowed' | 'denied';
    dataValidation?: TestRecord['dataValidation'];
  }): TestRecord {
    const actual: 'allowed' | 'denied' = params.result.isError ? 'denied' : 'allowed';
    const authMatch = actual === params.expectedAuthorization;

    const record: TestRecord = {
      timestamp: new Date().toISOString(),
      tool: params.tool,
      user: params.user,
      userScopes: params.userScopes,
      input: params.input,
      output: {
        success: !params.result.isError,
        content: params.result.content,
        duration: params.duration,
      },
      authorization: {
        expected: params.expectedAuthorization,
        actual,
        match: authMatch,
      },
      dataValidation: params.dataValidation,
    };

    this.session.records.push(record);
    this.session.summary.totalTests++;

    // Update summary counts
    const passed = authMatch && (!params.dataValidation || params.dataValidation.allPassed);
    if (passed) {
      this.session.summary.passed++;
    } else {
      this.session.summary.failed++;
      if (!authMatch) {
        this.session.summary.authorizationFailures++;
      }
      if (params.dataValidation && !params.dataValidation.allPassed) {
        this.session.summary.dataValidationFailures++;
      }
    }

    return record;
  }

  /**
   * Helper to record a successful tool call
   */
  recordSuccess(params: {
    tool: string;
    user: string;
    userScopes: string[];
    input: Record<string, unknown>;
    result: ToolCallResult;
    duration: number;
    dataValidation?: TestRecord['dataValidation'];
  }): TestRecord {
    return this.record({
      ...params,
      expectedAuthorization: 'allowed',
    });
  }

  /**
   * Helper to record an expected denial
   */
  recordDenial(params: {
    tool: string;
    user: string;
    userScopes: string[];
    input: Record<string, unknown>;
    result: ToolCallResult;
    duration: number;
  }): TestRecord {
    return this.record({
      ...params,
      expectedAuthorization: 'denied',
    });
  }

  /**
   * Create data validation result
   */
  createDataValidation(
    checks: Array<{ name: string; expected: unknown; actual: unknown }>
  ): TestRecord['dataValidation'] {
    const results = checks.map((check) => ({
      ...check,
      passed: this.valuesMatch(check.expected, check.actual),
    }));

    return {
      checks: results,
      allPassed: results.every((r) => r.passed),
    };
  }

  /**
   * Compare expected vs actual values with tolerance for numbers
   */
  private valuesMatch(expected: unknown, actual: unknown): boolean {
    // Range check for numbers
    if (
      typeof expected === 'object' &&
      expected !== null &&
      'min' in expected &&
      'max' in expected
    ) {
      const range = expected as { min: number; max: number };
      const value = actual as number;
      return value >= range.min && value <= range.max;
    }

    // Exact match
    if (typeof expected === 'number' && typeof actual === 'number') {
      // Allow 5% tolerance for numeric comparisons
      const tolerance = Math.abs(expected * 0.05);
      return Math.abs(expected - actual) <= tolerance;
    }

    return expected === actual;
  }

  /**
   * Get current session data
   */
  getSession(): TestSession {
    return { ...this.session };
  }

  /**
   * Get summary statistics
   */
  getSummary(): TestSession['summary'] {
    return { ...this.session.summary };
  }

  /**
   * Finalize and save the recording
   */
  finalize(): string {
    this.session.completedAt = new Date().toISOString();
    const filename = `${this.session.sessionId}.json`;
    const filepath = join(this.recordingsDir, filename);

    writeFileSync(filepath, JSON.stringify(this.session, null, 2));

    return filepath;
  }

  /**
   * Print summary to console
   */
  printSummary(): void {
    const { summary, sessionId } = this.session;
    console.log('\n' + '='.repeat(60));
    console.log('Test Recording Summary');
    console.log('='.repeat(60));
    console.log(`Session: ${sessionId}`);
    console.log(`Total: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passed}`);
    console.log(`Failed: ${summary.failed}`);
    if (summary.authorizationFailures > 0) {
      console.log(`  - Authorization failures: ${summary.authorizationFailures}`);
    }
    if (summary.dataValidationFailures > 0) {
      console.log(`  - Data validation failures: ${summary.dataValidationFailures}`);
    }
    console.log('='.repeat(60) + '\n');
  }
}

/**
 * Singleton recorder instance for the current test run
 */
let currentRecorder: TestRecorder | null = null;

export function initRecorder(testSuite: string, baseUrl: string): TestRecorder {
  currentRecorder = new TestRecorder(testSuite, baseUrl);
  return currentRecorder;
}

export function getRecorder(): TestRecorder {
  if (!currentRecorder) {
    throw new Error('Recorder not initialized. Call initRecorder() first.');
  }
  return currentRecorder;
}

export function finalizeRecorder(): string | null {
  if (!currentRecorder) {
    return null;
  }
  const filepath = currentRecorder.finalize();
  currentRecorder.printSummary();
  currentRecorder = null;
  return filepath;
}
