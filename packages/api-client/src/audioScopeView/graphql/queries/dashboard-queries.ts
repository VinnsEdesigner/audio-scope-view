import { gql } from "@apollo/client";

export const RECENT_SESSION_FIELDS = gql`
  fragment RecentSessionFields on RecentScopeOutput {
    id
    name
    lastActivity
    waveformCount
  }
`;

export const DASHBOARD_SUMMARY_FIELDS = gql`
  ${RECENT_SESSION_FIELDS}
  fragment DashboardSummaryFields on DashboardSummaryOutput {
    timeRange
    generatedAt
    totalSessions
    activeSessions
    totalCaptures
    totalWaveforms
    totalSamples
    averagePeakAmplitude
    averageRmsAmplitude
    recentSessions {
      ...RecentSessionFields
    }
  }
`;

export const GET_DASHBOARD_SUMMARY = gql`
  ${DASHBOARD_SUMMARY_FIELDS}
  query GetDashboardSummary($timeRange: String) {
    dashboardSummary(timeRange: $timeRange) {
      ...DashboardSummaryFields
    }
  }
`;

export const GET_RECENT_SESSIONS = gql`
  ${RECENT_SESSION_FIELDS}
  query GetRecentSessions($limit: Int) {
    recentSessions(limit: $limit) {
      ...RecentSessionFields
    }
  }
`;
