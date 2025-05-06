import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PostHog } from 'posthog-node';
import { getDefaultVSCodeUserDataPath, getOrCreateUUID } from './utils';
import { findAndReturnNewTraces } from './zencoder/sessionManager';
import { logTracesToOpik } from './opik';
import { updateSessionInfo, getSessionInfo, resetGlobalState } from './state';
import { logBIAPIKeyNotFound, logBIExtensionStarted, logBIExtensionActivated, logBINewTracesFound } from './logger';

export function activate(context: vscode.ExtensionContext) {
  resetGlobalState(context);

  const posthog = new PostHog(
    'phc_1Fv1j8C4NDCl9EVEoe204HNdt4eH3gbmpKv8LaT2on1',
    {
      host: 'https://eu.i.posthog.com',
      enableExceptionAutocapture: false
    }
  )
  const uniqueId = getOrCreateUUID(context);
  posthog.identify({
    distinctId: uniqueId
  });

  try {
    logBIExtensionStarted(posthog, uniqueId)

    console.log('Congratulations, your extension "opikHistory" is now active!');

    const userDataPath = vscode.workspace.getConfiguration().get<string>('myExtension.VSCodePath') || '';
    let VSInstallationPath = '';
    try {
      VSInstallationPath = fs.existsSync(userDataPath) ? userDataPath : getDefaultVSCodeUserDataPath();
    } catch (error) {
      console.error('Error getting VSCode user data path:', error);
      posthog.capture({
        distinctId: uniqueId,
        event: 'error',
        properties: {
          error: error instanceof Error ? error.message : String(error)
        }
      })
      vscode.window.showErrorMessage('Failed to get VSCode user data path. Please check your configuration.');
      return;
    }


    let showAPIKeyWarning = true;
    let logAPIKeyBIEvent = true;
    let sessionInfo = getSessionInfo(context);

    const interval = setInterval(() => {
      try {
        const apiKey: string | undefined = vscode.workspace.getConfiguration().get('opikHistory.apiKey');

      if (!apiKey && showAPIKeyWarning) {
        vscode.window.showErrorMessage(
          'To log Zencoder chat sessions to Opik you will need to set your Opik API Key.',
          'Open Settings'
        ).then(selection => {
          if (selection === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'opikHistory.apiKey');
          }
        });

        logBIAPIKeyNotFound(posthog, uniqueId)
        showAPIKeyWarning = false;
        return;
      } else if (!apiKey) {
        return;
      } else if (apiKey && logAPIKeyBIEvent) {
        vscode.window.showInformationMessage(
          'Your zencoder chat history will now be logged to Opik!'
        )
        logAPIKeyBIEvent = false;
        logBIExtensionActivated(posthog, uniqueId)
      }

      let numberOfTracesLogged = 0;

      let sessionInfo = getSessionInfo(context);
      const zencoderData = findAndReturnNewTraces(context, VSInstallationPath, sessionInfo)

      for (const { sessionId, tracesData, lastMessageId, lastMessageTime } of zencoderData) {
        if (tracesData.length > 0) {
          logBINewTracesFound(posthog, uniqueId, sessionId, tracesData.length)
        }

        logTracesToOpik(apiKey, tracesData);

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
      updateSessionInfo(context, sessionInfo);

      console.log(`Number of traces logged: ${numberOfTracesLogged}`);
      console.log('Finished loop');
      } catch (error) {
        console.error('Error logging extension started:', error);
        posthog.capture({
          distinctId: uniqueId,
          event: 'error',
          properties: {
            error: error instanceof Error ? error.message : String(error)
          }
        })
      }
    }, 5000);

    context.subscriptions.push({
      dispose: () => clearInterval(interval)
    });
  } catch (error) {
    console.error('Error logging extension started:', error);
    posthog.capture({
      distinctId: uniqueId,
      event: 'error',
      properties: {
        error: error instanceof Error ? error.message : String(error)
      }
    })
  }
}

export function deactivate() { }