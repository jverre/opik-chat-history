import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';  
import axios from 'axios';

interface SessionInfo {
  lastUploadId?: string;
  lastUploadTime?: Date;
}

interface ZencoderSession {
  id: string;
  title: string;
  updatedAt: number;
  isAgent: boolean;
}

interface Session {
  id: string;
  basePath: string;
  lastUploadId?: string;
  lastUploadTime?: Date;
  zencoderSession: ZencoderSession;
}

interface ZencoderMessage {
  id: string;
  role: string;
  rawContent: any;
  content: string[];
  context: any;
}

function getDefaultVSCodeUserDataPath(): string {
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

function getSessionInfo(context: vscode.ExtensionContext): Record<string, SessionInfo> {
  return context.globalState.get<Record<string, SessionInfo>>('sessionInfo', {});
}

function resetGlobalState(context: vscode.ExtensionContext) {
  context.globalState.update('sessionInfo', undefined);
}

function updateSessionInfo(context: vscode.ExtensionContext, sessionId: string, lastUploadId: string, lastUploadTime?: Date) {
  const sessionInfo = getSessionInfo(context);
  sessionInfo[sessionId] = { lastUploadTime, lastUploadId };
  context.globalState.update('sessionInfo', sessionInfo);
}

function findFolder(basePath: string, folderName: string): string[] {
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

function readJsonFile(filePath: string): any {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error(`Error reading or parsing ${filePath}:`, error);
    return null;
  }
}

function mergeTextMessages(messages: any[]) {
  let result: string[] = [];
  
  messages.map((message: any) => {
    if (message.type === 'text') {
      result.push(message.text);
    }
  })

  return result.join("\n");
}

function logUserAssistantPairs(conversationId: string, messages: ZencoderMessage[], lastUploadedId: string | undefined) {
  const results: any[] = [];
  let startAppending = false;

  for (let i = 0; i < messages.length - 1; i++) {
    const userMessage = messages[i];
    const assistantMessage = messages[i + 1];
    if (!lastUploadedId) {
      startAppending = true;
    } else if (userMessage.id === lastUploadedId) {
      startAppending = true;
      continue;
    }

    if (!startAppending) continue;

    if (userMessage.role === 'user' && assistantMessage.role === 'assistant') {
      results.push({
        "name": "zencoder-chat",
        "project_name": "Zencoder Chat",
        "start_time": (new Date()).toISOString(),
        "input": {"input": mergeTextMessages(userMessage.content)},
        "output": {"output": mergeTextMessages(assistantMessage.content)},
        "thread_id": conversationId
      });
    }
  }

  return results;
}

async function logTracesToOpik(apiKey: string, traces: any) {
  try {
    const response = await axios.post(
      "https://www.comet.com/opik/api/v1/private/traces/batch",
      {"traces": traces},
      {
      headers: {
        'Content-Type': 'application/json',
        'authorization': `${apiKey}`,
        'Comet-Workspace': 'jacques-comet'
      },
      timeout: 1000
    })
  } catch(error) {
    if (axios.isAxiosError(error)) {
      
      console.log('Error message:', error.message);
      console.log('Error:', error);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
    } else {
      console.error('Unexpected error:', error);
    }
  }
  

  // Use Opik here
}

function getSessions(zencoderChatPaths: string[], sessionInfo: Record<string, SessionInfo>) {
  let sessions : Session[] = [];

  for (const zencoderPath of zencoderChatPaths) {
    const zencoderSessions: ZencoderSession[] | null = readJsonFile(path.join(zencoderPath, "sessions.json"));
    if (!zencoderSessions) continue;
    
    for (const zencoderSession of zencoderSessions) {
      const lastUploadTime = sessionInfo[zencoderSession.id]?.lastUploadTime;
      const lastUploadId = sessionInfo[zencoderSession.id]?.lastUploadId;

      sessions.push({
        id: zencoderSession.id,
        lastUploadTime: lastUploadTime !== undefined ? lastUploadTime : undefined,
        lastUploadId: lastUploadId !== undefined ? lastUploadId : undefined,
        basePath: zencoderPath,
        zencoderSession: zencoderSession});  
    }
  }
  
  return sessions
}

export function activate(context: vscode.ExtensionContext) {
  resetGlobalState(context);
  console.log('Congratulations, your extension "opikHistory" is now active!');
  const apiKey: string | undefined = vscode.workspace.getConfiguration().get('opikHistory.apiKey');

  if (!apiKey) {
    console.log('API Key is not set.');
    return;
  }

  const userDataPath = vscode.workspace.getConfiguration().get<string>('myExtension.VSCodePath') || '';
  const VSInstallationPath = fs.existsSync(userDataPath) ? userDataPath : getDefaultVSCodeUserDataPath();

  
  const interval = setInterval(() => {
    let numberOfTracesLogged = 0;
    
    let sessionInfo = getSessionInfo(context);

    // Search for the zencoder-chat folder
    const zencoderChatPaths = findFolder(VSInstallationPath, 'zencoder-chat');
    const sessions = getSessions(zencoderChatPaths, sessionInfo);
    
    for (const session of sessions) {
      if (session.lastUploadTime && session.zencoderSession.updatedAt < session.lastUploadTime.getTime()) {
        continue;
      }

      const chatHistory = readJsonFile(path.join(session.basePath, "sessions", session.id + '.json' ))
      
      const tracesData = logUserAssistantPairs(chatHistory.id, chatHistory.messages, session.lastUploadId);
      updateSessionInfo(context, session.id, chatHistory.updatedAt);

      logTracesToOpik(apiKey, tracesData)
      numberOfTracesLogged += tracesData.length;

      updateSessionInfo(
        context,
        session.id,
        chatHistory.messages[chatHistory.messages.length - 1].id,
        chatHistory.updatedAt
      );
    }

    // Your code to upload data
    console.log(`Logged ${numberOfTracesLogged} traces`);
  }, 5000);

  context.subscriptions.push({
    dispose: () => clearInterval(interval)
  });
}

export function deactivate() {}