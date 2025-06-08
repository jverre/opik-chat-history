import * as vscode from 'vscode';
import * as fs from 'fs';
import { PostHog } from 'posthog-node';
import { getDefaultVSCodeUserDataPath, getOrCreateUUID } from './utils';
import { resetGlobalState } from './state';
import { logBIAPIKeyNotFound, logBIExtensionStarted, logBIExtensionActivated, logConfigurationInfo, logFileSystemError } from './logger';
import { ZencoderService } from './zencoder/zencoderService';
import { CursorService } from './cursor/cursorService';


export function activate(context: vscode.ExtensionContext) {
  //resetGlobalState(context);

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

    // Log configuration info for debugging
    const config = vscode.workspace.getConfiguration();
    const apiKey: string | undefined = config.get('opikHistory.apiKey');
    const zencoderProjectName: string = config.get('opikHistory.projectNameZencoderChats') || 'zencoder';
    const cursorProjectName: string = config.get('opikHistory.projectNameCursorChats') || 'cursor';
    const customVSCodePath: string = config.get('opikHistory.VSCodePath') || '';
    
    logConfigurationInfo(posthog, uniqueId, {
      hasApiKey: !!apiKey,
      zencoderProjectName: zencoderProjectName,
      cursorProjectName: cursorProjectName,
      hasCustomVSCodePath: !!customVSCodePath
    });

    const userDataPath = vscode.workspace.getConfiguration().get<string>('opikHistory.VSCodePath') || '';
    let VSInstallationPath = '';
    try {
      VSInstallationPath = fs.existsSync(userDataPath) ? userDataPath : getDefaultVSCodeUserDataPath(context);
    } catch (error) {
      console.error('Error getting VSCode user data path:', error);
      logFileSystemError(posthog, uniqueId, 'get_vscode_user_data_path', userDataPath, error as Error);
      vscode.window.showErrorMessage('Failed to get VSCode user data path. Please check your configuration.');
      return;
    }


    let showAPIKeyWarning = true;
    let logAPIKeyBIEvent = true;
    const zencoderService = new ZencoderService(context, posthog, uniqueId);
    const cursorService = new CursorService(context, posthog, uniqueId);

    const interval = setInterval(async () => {
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

        const numberOfZencoderTracesLogged = await zencoderService.processZencoderTraces(apiKey, VSInstallationPath);
        const numberOfCursorTracesLogged = await cursorService.processCursorTraces(apiKey, VSInstallationPath);

        console.log(`Number of Zencoder traces logged: ${numberOfZencoderTracesLogged}`);
        console.log(`Number of Cursor traces logged: ${numberOfCursorTracesLogged}`);
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