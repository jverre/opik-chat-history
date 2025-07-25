import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';  
import { v4 as uuidv4 } from 'uuid';

// Create output channel for logging
let outputChannel: vscode.OutputChannel;

export function initializeLogging() {
  outputChannel = vscode.window.createOutputChannel('Cursor DB Finder');
  outputChannel.show(); // This will show the output panel automatically
}

export function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Log to both console and VS Code output channel
  console.log(logMessage);
  if (outputChannel) {
    outputChannel.appendLine(logMessage);
  }
}

export function getDefaultVSCodeUserDataPath(context?: vscode.ExtensionContext): string {
  if (context && context.globalStorageUri) {
    // Move to the right parent directory as we are in <.../Cursor/User/globalStorage>
    const parentPath = path.join(context.globalStorageUri.fsPath, '..', '..', '..');
    return parentPath;
  } else {
    throw new Error('Unsupported platform');
  }
}

export function findFolder(basePath: string, folderName: string): string[] {
  let results: string[] = [];
  const files = fs.readdirSync(basePath);

  for (const file of files) {
    const fullPath = path.join(basePath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (file === folderName) {
        results.push(fullPath);
      } else {
        results = results.concat(findFolder(fullPath, folderName));
      }
    }
  }

  return results;
}


export function readJsonFile(filePath: string): any {
    try {
      const fileContents = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContents);
    } catch (error) {
      console.error(`Error reading or parsing ${filePath}:`, error);
      // Note: Enhanced error logging would be added here if PostHog context was available
      // This error will be caught and logged by the calling service
      return null;
    }
  }

export function getOrCreateUUID(context: vscode.ExtensionContext): string {
    // Check if there's an existing UUID stored in global state
    let uniqueId = context.globalState.get<string>('uniqueId');
  
    // If not, generate a new UUID and store it
    if (!uniqueId) {
        uniqueId = uuidv4();
        context.globalState.update('uniqueId', uniqueId);
        console.log(`Generated new UUID: ${uniqueId}`);
    } else {
        console.log(`Existing UUID: ${uniqueId}`);
    }
    return uniqueId;
}
