import { gql } from "@apollo/client";

export const RECENT_SCOPE_FIELDS = gql`
  fragment RecentScopeFields on RecentScopeOutput {
    id
    name
    last_activity
    waveform_count
  }
`;

export const DASHBOARD_SUMMARY_FIELDS = gql`
  ${RECENT_SCOPE_FIELDS}
  fragment DashboardSummaryFields on DashboardSummaryOutput {
    time_range
    generated_at
    total_scopes
    active_scopes
    total_captures
    total_waveforms
    total_samples
    average_peak_amplitude
    average_rms_amplitude
    recent_scopes {
      ...RecentScopeFields
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

export const GET_RECENT_SCOPES = gql`
  ${RECENT_SCOPE_FIELDS}
  query GetRecentScopes($limit: Int) {
    recentScopes(limit: $limit) {
      ...RecentScopeFields
    }
  }
`;
