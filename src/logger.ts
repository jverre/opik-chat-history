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