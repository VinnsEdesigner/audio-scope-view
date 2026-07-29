import { gql } from "@apollo/client";

export const RECENT_SESSION_FIELDS = gql`
  fragment RecentSessionFields on RecentSessionOutput {
    id
    started_at
    recording_count
  }
`;

export const DASHBOARD_SUMMARY_FIELDS = gql`
  ${RECENT_SESSION_FIELDS}
  fragment DashboardSummaryFields on DashboardSummaryOutput {
    time_range
    generated_at
    total_sessions
    active_sessions
    total_captures
    total_waveforms
    total_samples
    average_peak_amplitude
    average_rms_amplitude
    recent_sessions {
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
