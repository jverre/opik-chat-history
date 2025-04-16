import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';  
import { v4 as uuidv4 } from 'uuid';

export function getDefaultVSCodeUserDataPath(): string {
  const homeDir = os.homedir();
  let userDataPath = '';

  switch (process.platform) {
    case 'win32':
      userDataPath = path.join(homeDir, 'AppData', 'Roaming', 'Code');
      break;
    case 'darwin':
      userDataPath = path.join(homeDir, 'Library', 'Application Support', 'Code');
      break;
    case 'linux':
      userDataPath = path.join(homeDir, '.config', 'Code');
      break;
    default:
      throw new Error('Unsupported platform');
  }

  return userDataPath;
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