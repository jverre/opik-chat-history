export interface ZencoderSession {
    id: string;
    title: string;
    updatedAt: number;
    isAgent: boolean;
}

export interface ZencoderMessage {
    id: string;
    role: string;
    rawContent: any;
    content: string[];
    context: any;
    createdAt: number;
}
  