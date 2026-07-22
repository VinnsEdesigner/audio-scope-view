import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const ErrorBoundaryRoot = styled(YStack, {
  backgroundColor: "$gray2",
  borderRadius: "$md",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$red9",
  borderLeftWidth: 4,
  borderLeftColor: "$red10",
  alignItems: "center",
  justifyContent: "center",
  gap: "$md",
});

export interface ErrorBoundaryProperties {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProperties, ErrorBoundaryState> {
  constructor(properties: ErrorBoundaryProperties) {
    super(properties);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorBoundaryRoot role="alert">
          <Text fontSize={16} fontWeight="600" color="$red10">
            Something went wrong
          </Text>
          <Text fontSize={14} color="$gray11" textAlign="center">
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
        </ErrorBoundaryRoot>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundaryRoot };
