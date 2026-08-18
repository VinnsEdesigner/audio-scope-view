import type { ApolloError } from "@apollo/client";

function sanitizeMessage(message: string): string {
  const urlStripped = message
    .replace(/https?:\/\/[^\s'"]+/gi, "")
    .replace(/wss?:\/\/[^\s'"]+/gi, "");
  const collapsed = urlStripped.replace(/\s+/g, " ").trim();
  if (/Failed to fetch|NetworkError|Load failed/i.test(collapsed)) {
    return "Network error: unable to reach the server. Check your connection and try again.";
  }
  return collapsed || message;
}


export function formatError(error: unknown, fallback = "Something went wrong"): string {
  if (!error) {
    return fallback;
  }

  if (typeof error === "string") {
    return sanitizeMessage(error) || fallback;
  }

  const apolloError = error as ApolloError | undefined;
  if (apolloError?.networkError) {
    const detail = apolloError.networkError.message || "Network error";
    return sanitizeMessage(`Network error: ${detail}`);
  }

  if (apolloError?.graphQLErrors && apolloError.graphQLErrors.length > 0) {
    const messages = apolloError.graphQLErrors
      .map((e) => sanitizeMessage(e.message || "GraphQL error"))
      .filter(Boolean);
    return messages.join("; ") || fallback;
  }

  if (error instanceof Error) {
    return sanitizeMessage(error.message) || fallback;
  }

  return fallback;
}
