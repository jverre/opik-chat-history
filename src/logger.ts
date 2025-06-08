import {PostHog} from "posthog-node"

export function logBIAPIKeyNotFound(posthog: PostHog, uniqueId: string) {
posthog.capture({
    distinctId: uniqueId,
    event: 'Extension not configured with API key',
  })  
}

export function logBIExtensionStarted(posthog: PostHog, uniqueId: string) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'Extension started',
    })
}


export function logBIExtensionActivated(posthog: PostHog, uniqueId: string) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'Extension activated',
    })
}

export function logBINewTracesFound(posthog: PostHog, uniqueId: string, sessionId: string, tracesDataLength: number) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'New session traces found',
        properties: {
            extension: "zencoder",
            sessionId: sessionId,
            num_new_traces_found: tracesDataLength
        }
    });
}

// Enhanced error logging functions for debugging

export function logFileSystemError(posthog: PostHog, uniqueId: string, context: string, filePath: string, error: Error) {
    posthog.capture({
        distinctId: uniqueId,
        event: '$exception',
        properties: {
            $exception_type: error.name,
            $exception_message: error.message,
            $exception_stack: error.stack,
            error_type: 'filesystem_error',
            context: context,
            file_path: filePath,
            error_code: (error as any).code || 'unknown',
            error_errno: (error as any).errno || 'unknown'
        }
    });
}

export function logDatabaseError(posthog: PostHog, uniqueId: string, context: string, dbPath: string, error: Error) {
    posthog.capture({
        distinctId: uniqueId,
        event: '$exception',
        properties: {
            $exception_type: error.name,
            $exception_message: error.message,
            $exception_stack: error.stack,
            error_type: 'database_error',
            context: context,
            db_path: dbPath,
            error_message: error.message
        }
    });
}

export function logOpikApiError(posthog: PostHog, uniqueId: string, apiKey: string, error: Error, traceCount?: number) {
    posthog.capture({
        distinctId: uniqueId,
        event: '$exception',
        properties: {
            $exception_type: error.name,
            $exception_message: error.message,
            $exception_stack: error.stack,
            error_type: 'opik_api_error',
            api_key_length: apiKey ? apiKey.length : 0,
            api_key_configured: !!apiKey,
            trace_count: traceCount || 0,
            error_message: error.message,
            // Check if it's an HTTP error and log status code
            status_code: (error as any).response?.status || null
        }
    });
}

export function logSessionDiscoveryInfo(posthog: PostHog, uniqueId: string, platform: 'cursor' | 'zencoder', discoveryData: {
    vsInstallationPath: string;
    globalStoragePaths: string[];
    sessionCount: number;
    hasStateDb: boolean;
}) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'session_discovery_info',
        properties: {
            platform: platform,
            vs_installation_path_exists: !!discoveryData.vsInstallationPath,
            global_storage_paths_count: discoveryData.globalStoragePaths.length,
            session_count: discoveryData.sessionCount,
            has_state_db: discoveryData.hasStateDb
        }
    });
}

export function logConfigurationInfo(posthog: PostHog, uniqueId: string, config: {
    hasApiKey: boolean;
    zencoderProjectName: string;
    cursorProjectName: string;
    hasCustomVSCodePath: boolean;
}) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'configuration_info',
        properties: {
            has_api_key: config.hasApiKey,
            zencoder_project_name: config.zencoderProjectName,
            cursor_project_name: config.cursorProjectName,
            has_custom_vscode_path: config.hasCustomVSCodePath
        }
    });
}

// Enhanced error logging for conversation parsing
export function logConversationParsingError(posthog: PostHog, uniqueId: string, context: string, conversationId: string, error: Error, conversationMetadata?: any) {
    posthog.capture({
        distinctId: uniqueId,
        event: '$exception',
        properties: {
            $exception_type: error.name,
            $exception_message: error.message,
            $exception_stack: error.stack,
            error_type: 'conversation_parsing_error',
            context: context,
            conversation_id: conversationId,
            has_bubbles: conversationMetadata?.bubbles ? conversationMetadata.bubbles.length > 0 : false,
            bubble_count: conversationMetadata?.bubbles?.length || 0,
            conversation_created_at: conversationMetadata?.createdAt || null
        }
    });
}

export function logJsonParsingError(posthog: PostHog, uniqueId: string, context: string, filePath: string, error: Error, rawDataSample?: string) {
    posthog.capture({
        distinctId: uniqueId,
        event: '$exception',
        properties: {
            $exception_type: error.name,
            $exception_message: error.message,
            $exception_stack: error.stack,
            error_type: 'json_parsing_error',
            context: context,
            file_path: filePath,
            data_sample_length: rawDataSample ? rawDataSample.length : 0,
            // Only log first 100 chars of data for debugging, avoid sensitive content
            data_sample: rawDataSample ? rawDataSample.substring(0, 100) : null
        }
    });
}

export function logGitOperationError(posthog: PostHog, uniqueId: string, operation: string, error: Error, workingDirectory?: string) {
    posthog.capture({
        distinctId: uniqueId,
        event: '$exception',
        properties: {
            $exception_type: error.name,
            $exception_message: error.message,
            $exception_stack: error.stack,
            error_type: 'git_operation_error',
            git_operation: operation,
            working_directory_exists: workingDirectory ? true : false,
            error_code: (error as any).code || 'unknown'
        }
    });
}

export function logSqliteOperationError(posthog: PostHog, uniqueId: string, operation: string, dbPath: string, query: string, error: Error) {
    posthog.capture({
        distinctId: uniqueId,
        event: '$exception',
        properties: {
            $exception_type: error.name,
            $exception_message: error.message,
            $exception_stack: error.stack,
            error_type: 'sqlite_operation_error',
            db_path: dbPath,
            sql_operation: operation,
            // Log query but truncate to avoid logging sensitive data
            sql_query_sample: query.substring(0, 200),
            error_code: (error as any).code || 'unknown',
            error_errno: (error as any).errno || 'unknown'
        }
    });
}

export function logDataValidationError(posthog: PostHog, uniqueId: string, context: string, validationType: string, details: any) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'data_validation_error',
        properties: {
            error_type: 'data_validation_error',
            context: context,
            validation_type: validationType,
            validation_details: details
        }
    });
}

// Performance and timing logging
export function logProcessingPerformance(posthog: PostHog, uniqueId: string, operation: string, durationMs: number, metadata: any) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'processing_performance',
        properties: {
            operation: operation,
            duration_ms: durationMs,
            duration_seconds: Math.round(durationMs / 1000 * 100) / 100, // Round to 2 decimal places
            ...metadata
        }
    });
}

export function logConversationProcessingStats(posthog: PostHog, uniqueId: string, platform: 'cursor' | 'zencoder', stats: {
    totalConversations: number;
    processedConversations: number;
    totalBubbles: number;
    validTraces: number;
    invalidTraces: number;
    processingTimeMs: number;
}) {
    posthog.capture({
        distinctId: uniqueId,
        event: 'conversation_processing_stats',
        properties: {
            platform: platform,
            total_conversations: stats.totalConversations,
            processed_conversations: stats.processedConversations,
            total_bubbles: stats.totalBubbles,
            valid_traces: stats.validTraces,
            invalid_traces: stats.invalidTraces,
            processing_time_ms: stats.processingTimeMs,
            processing_time_seconds: Math.round(stats.processingTimeMs / 1000 * 100) / 100,
            conversations_per_second: stats.totalConversations > 0 ? Math.round((stats.totalConversations / (stats.processingTimeMs / 1000)) * 100) / 100 : 0
        }
    });
}