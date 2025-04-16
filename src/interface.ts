import { ZencoderSession } from './zencoder/interface';

export interface SessionInfo {
    lastUploadId?: string;
    lastUploadTime?: number;
}
  
export interface Session {
    id: string;
    basePath: string;
    lastUploadId?: string;
    lastUploadDate?: string;
    lastUploadTime?: number;
    zencoderSession: ZencoderSession;
}

export interface TraceData {
    name: string;
    project_name?: string;
    start_time: string; // ISO 8601 format
    end_time?: string; // ISO 8601 format
    input: any;
    output: any;
    thread_id?: string;
}