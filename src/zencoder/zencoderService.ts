import * as vscode from 'vscode';
import { PostHog } from 'posthog-node';
import { findAndReturnNewTraces } from './sessionManager';
import { logTracesToOpik } from '../opik';
import { getSessionInfo, updateSessionInfo } from '../state';
import { logBINewTracesFound, logSessionDiscoveryInfo, logOpikApiError } from '../logger';

export class ZencoderService {
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
   * Process zencoder traces and log them to Opik
   */
  async processZencoderTraces(apiKey: string, vsInstallationPath: string): Promise<number> {
    // Prevent concurrent processing to avoid duplicates
    if (this.isProcessing) {
      console.log('⏳ Zencoder trace processing already in progress, skipping this cycle');
      return 0;
    }

    this.isProcessing = true;
    let numberOfTracesLogged = 0;
    let sessionInfo = getSessionInfo(this.context);
    
    try {
      const zencoderData = findAndReturnNewTraces(this.context, vsInstallationPath, sessionInfo);
      const zencoderDataArray = Array.from(zencoderData);
      
      // Log discovery info for debugging
      logSessionDiscoveryInfo(this.posthog, this.uniqueId, 'zencoder', {
        vsInstallationPath: vsInstallationPath,
        globalStoragePaths: [], // Will be populated in the zencoder implementation
        sessionCount: zencoderDataArray.length,
        hasStateDb: zencoderDataArray.length > 0
      });
      
      for (const { sessionId, tracesData, lastMessageId, lastMessageTime } of zencoderDataArray) {
        
        if (tracesData.length > 0) {
          logBINewTracesFound(this.posthog, this.uniqueId, sessionId, tracesData.length);
        }

        try {
          await logTracesToOpik(apiKey, tracesData);
        } catch (opikError) {
          logOpikApiError(this.posthog, this.uniqueId, apiKey, opikError as Error, tracesData.length);
          throw opikError;
        }

        if (!sessionInfo[sessionId]) {
          sessionInfo[sessionId] = {};
        }

        if (lastMessageId) {
          sessionInfo[sessionId].lastUploadId = lastMessageId;
        }
        if (lastMessageTime) {
          sessionInfo[sessionId].lastUploadTime = lastMessageTime;
        }

        numberOfTracesLogged += tracesData.length;
      }

      updateSessionInfo(this.context, sessionInfo);
    } catch (error) {
      console.error('Error processing zencoder traces:', error);
      this.posthog.capture({
        distinctId: this.uniqueId,
        event: 'zencoder_processing_error',
        properties: {
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error; // Re-throw to let the caller handle it
    } finally {
      // Always reset the processing flag, even if an error occurs
      this.isProcessing = false;
    }

    return numberOfTracesLogged;
  }

  /**
   * Get current session info
   */
  getSessionInfo() {
    return getSessionInfo(this.context);
  }

  /**
   * Update session info
   */
  updateSessionInfo(sessionInfo: any) {
    updateSessionInfo(this.context, sessionInfo);
  }
} 