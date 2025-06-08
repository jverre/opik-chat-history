import * as path from 'path';
import * as vscode from 'vscode';

import { SessionInfo, Session } from "../interface";
import { readJsonFile, findFolder } from '../utils';

import { ZencoderSession} from "./interface";
import { convertToTraces } from './utils';


export function getSessions(zencoderChatPaths: string[], sessionInfo: Record<string, SessionInfo>) {
  let sessions : Session[] = [];

  for (const zencoderPath of zencoderChatPaths) {
    const zencoderSessions: ZencoderSession[] | null = readJsonFile(path.join(zencoderPath, "sessions.json"));
    if (!zencoderSessions) continue;
    
    for (const zencoderSession of zencoderSessions) {
      const lastUploadTime = sessionInfo[zencoderSession.id]?.lastUploadTime;
      const lastUploadId = sessionInfo[zencoderSession.id]?.lastUploadId;

      sessions.push({
        id: zencoderSession.id,
        lastUploadDate: lastUploadTime !== undefined ? new Date(lastUploadTime).toISOString() : undefined,
        lastUploadTime: lastUploadTime !== undefined ? lastUploadTime : undefined,
        lastUploadId: lastUploadId !== undefined ? lastUploadId : undefined,
        basePath: zencoderPath,
        zencoderSession: zencoderSession});  
    }
  }
  
  return sessions
}

export function* findAndReturnNewTraces(context: vscode.ExtensionContext, VSInstallationPath: string, sessionInfo: Record<string, SessionInfo>) {
    const opikProjectName: string = vscode.workspace.getConfiguration().get('opikHistory.projectNameZencoderChats') || 'default';
    
    // Search for the zencoder-chat folder
    const zencoderChatPaths = findFolder(VSInstallationPath, 'zencoder-chat');
    const sessions = getSessions(zencoderChatPaths, sessionInfo);
    
    for (const session of sessions) {
        if (session.lastUploadTime && session.zencoderSession && session.zencoderSession.updatedAt <= session.lastUploadTime) {
          continue;
        }
    
        const chatHistory = readJsonFile(path.join(session.basePath, "sessions", session.id + '.json' ));
        const {tracesData, lastMessageId, lastMessageTime} = convertToTraces(opikProjectName, session.id, chatHistory.messages, session.lastUploadId);
          
        yield {"sessionId": session.id, tracesData, lastMessageId, lastMessageTime}
    }
}