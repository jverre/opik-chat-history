import { ZencoderMessage } from "./interface";
import { TraceData }  from "../interface";

function mergeTextMessages(messages: any[]) {
    let result: string[] = [];
    
    messages.map((message: any) => {
      if (message.type === 'text') {
        result.push(message.text);
      }
    })
  
    return result.join("\n");
}

export function convertToTraces(opikProjectName: string, conversationId: string, messages: ZencoderMessage[], lastUploadId: string | undefined) {
  const tracesData: TraceData[] = [];
  let startAppending = lastUploadId == undefined ? true : false; // Start appending if there's no lastUploadId
  let lastMessageId: string | undefined = undefined;
  let lastMessageTime: number | undefined = undefined;

  for (let i = 0; i < messages.length - 1; i++) {
      const userMessage = messages[i];
      const assistantMessage = messages[i + 1];

      if (!startAppending && assistantMessage.id === lastUploadId) {
          startAppending = true;
          continue; // Skip the message with lastUploadId
      }

      if (!startAppending) continue;

      if (userMessage.role === 'user' && assistantMessage.role === 'assistant') {
          lastMessageId = assistantMessage.id;
          lastMessageTime = assistantMessage.createdAt;

          tracesData.push({
              "name": "zencoder-chat",
              "project_name": opikProjectName,
              "start_time": (new Date(userMessage.createdAt)).toISOString(),
              "end_time": (new Date(assistantMessage.createdAt)).toISOString(),
              "input": {"input": mergeTextMessages(userMessage.content)},
              "output": {"output": mergeTextMessages(assistantMessage.content)},
              "thread_id": conversationId
          });
      }
  }

  return {tracesData, lastMessageId, lastMessageTime};
}
