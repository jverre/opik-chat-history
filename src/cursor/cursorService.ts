import * as vscode from 'vscode';
import { PostHog } from 'posthog-node';
import { findAndReturnNewTraces } from './sessionManager';
import { logTracesToOpik } from '../opik';
import { getSessionInfo, updateSessionInfo } from '../state';
import { logBINewTracesFound, logSessionDiscoveryInfo, logOpikApiError, logDatabaseError, logDataValidationError, logProcessingPerformance, logConversationProcessingStats } from '../logger';

export class CursorService {
  private context: vscode.ExtensionContext;
  private posthog: PostHog;
  private uniqueId: string;
  private isProcessing: boolean = false;

  constructor(context: vscode.ExtensionContext, posthog: PostHog, uniqueId: string) {
    this.context = context;
    this.posthog = posthog;
    this.uniqueId = uniqueId;
  }

  /**
   * Process cursor traces and log them to Opik
   */
  async processCursorTraces(apiKey: string, vsInstallationPath: string): Promise<number> {
    // Prevent concurrent processing to avoid duplicates
    if (this.isProcessing) {
      console.log('⏳ Cursor trace processing already in progress, skipping this cycle');
      return 0;
    }

    this.isProcessing = true;
    let numberOfTracesLogged = 0;
    let sessionInfo = getSessionInfo(this.context);
    const startTime = Date.now();
    
    try {
      const cursorResult = await findAndReturnNewTraces(this.context, vsInstallationPath, sessionInfo);
      
      if (cursorResult && cursorResult.tracesData) {
        const { tracesData, updatedSessionInfo } = cursorResult;
        
        // Log discovery info for debugging
        logSessionDiscoveryInfo(this.posthog, this.uniqueId, 'cursor', {
          vsInstallationPath: vsInstallationPath,
          globalStoragePaths: [], // Will be populated in findAndReturnNewTraces
          sessionCount: Object.keys(updatedSessionInfo).length,
          hasStateDb: true
        });
        
        // Validate trace data quality
        const invalidTraces = tracesData.filter(trace => 
          !trace.input?.input || 
          !trace.output?.output || 
          !trace.thread_id ||
          !trace.project_name
        );
        
        if (invalidTraces.length > 0) {
          logDataValidationError(this.posthog, this.uniqueId, 'cursor_trace_validation', 'invalid_trace_structure', {
            total_traces: tracesData.length,
            invalid_traces: invalidTraces.length,
            invalid_trace_issues: invalidTraces.map(trace => ({
              missing_input: !trace.input?.input,
              missing_output: !trace.output?.output,
              missing_thread_id: !trace.thread_id,
              missing_project_name: !trace.project_name
            }))
          });
        }
        
        if (tracesData.length > 0) {
          console.log(`📤 Logging ${tracesData.length} cursor traces to Opik`);
          
          // Use a generic session ID for BI logging since we now have multiple composer sessions
          const biSessionId = 'cursor-multi-session';
          logBINewTracesFound(this.posthog, this.uniqueId, biSessionId, tracesData.length);
          
          try {
            await logTracesToOpik(apiKey, tracesData);
          } catch (opikError) {
            logOpikApiError(this.posthog, this.uniqueId, apiKey, opikError as Error, tracesData.length);
            throw opikError;
          }
          
          // Update session info for each composer session
          Object.entries(updatedSessionInfo).forEach(([sessionId, sessionData]) => {
            try {
              if (!sessionInfo[sessionId]) {
                sessionInfo[sessionId] = {};
              }

              if (sessionData.lastMessageId) {
                sessionInfo[sessionId].lastUploadId = sessionData.lastMessageId;
              }
              if (sessionData.lastMessageTime) {
                sessionInfo[sessionId].lastUploadTime = sessionData.lastMessageTime;
              }
            } catch (sessionError) {
              console.error(`Error updating session ${sessionId}:`, sessionError);
              // Continue with other sessions even if one fails
            }
          });

          numberOfTracesLogged += tracesData.length;
          console.log(`✅ Successfully logged ${numberOfTracesLogged} cursor traces across ${Object.keys(updatedSessionInfo).length} composer sessions`);
        } else {
          console.log(`ℹ️ No new cursor traces to log`);
        }

        updateSessionInfo(this.context, sessionInfo);
        
        // Log processing performance and stats
        const processingTime = Date.now() - startTime;
        logProcessingPerformance(this.posthog, this.uniqueId, 'cursor_trace_processing', processingTime, {
          traces_processed: tracesData.length,
          sessions_updated: Object.keys(updatedSessionInfo).length
        });
        
        // Count total bubbles for stats
        const totalBubbles = tracesData.reduce((sum, trace) => {
          return sum + (trace.metadata?.totalBubbles || 0);
        }, 0);
        
        logConversationProcessingStats(this.posthog, this.uniqueId, 'cursor', {
          totalConversations: Object.keys(updatedSessionInfo).length,
          processedConversations: Object.keys(updatedSessionInfo).length,
          totalBubbles: totalBubbles,
          validTraces: tracesData.length - invalidTraces.length,
          invalidTraces: invalidTraces.length,
          processingTimeMs: processingTime
        });
      } else {
        console.log(`⚠️ No cursor data returned`);
        
        // Log discovery info even when no data is found
        logSessionDiscoveryInfo(this.posthog, this.uniqueId, 'cursor', {
          vsInstallationPath: vsInstallationPath,
          globalStoragePaths: [],
          sessionCount: 0,
          hasStateDb: false
        });
        
        // Log performance even when no data found
        const processingTime = Date.now() - startTime;
        logProcessingPerformance(this.posthog, this.uniqueId, 'cursor_trace_processing_no_data', processingTime, {
          vs_installation_path: vsInstallationPath
        });
      }
    } catch (error) {
      console.error('Error processing cursor traces:', error);
      
      // Enhanced error logging based on error type
      if (error instanceof Error) {
        if (error.message.includes('SQLITE') || error.message.includes('database')) {
          logDatabaseError(this.posthog, this.uniqueId, 'cursor_trace_processing', vsInstallationPath, error);
        } else {
          this.posthog.capture({
            distinctId: this.uniqueId,
            event: '$exception',
            properties: {
              $exception_type: error.name,
              $exception_message: error.message,
              $exception_stack: error.stack,
              error_type: 'cursor_processing_error',
              vs_installation_path: vsInstallationPath
            }
          });
        }
      } else {
        this.posthog.capture({
          distinctId: this.uniqueId,
          event: 'cursor_processing_error',
          properties: {
            error: String(error),
            vs_installation_path: vsInstallationPath
          }
        });
      }
      
      throw error; // Re-throw to let the caller handle it
    } finally {
      // Always reset the processing flag, even if an error occurs
      this.isProcessing = false;
    }

    return numberOfTracesLogged;
  }
} 