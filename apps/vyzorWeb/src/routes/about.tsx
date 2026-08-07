import * as React from "react";
import { useHeader } from "@/contexts/header-context";
import { APP_VERSION } from "@audio-scope-view/api-client";
import {
  useAboutInfo,
  useFeatures,
  useChangelog,
  useSessionStatusCounts,
  useRecordingStats,
} from "@/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/hooks";

const FEATURE_ICONS: Record<string, { gradient: string; shadow: string }> = {
  oscilloscope: {
    gradient: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
    shadow: "0 4px 12px rgba(225, 29, 72, 0.3)",
  },
  sessions: {
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    shadow: "0 4px 12px rgba(217, 119, 6, 0.3)",
  },
  export: {
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    shadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
  },
  database: {
    gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    shadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
  },
  spectrum: {
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    shadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
  },
  radio: {
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    shadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
  },
  storage: {
    gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
    shadow: "0 4px 12px rgba(8, 145, 178, 0.3)",
  },
};

const STAT_ICONS = [
  {
    id: "sessions",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    shadow: "0 4px 12px rgba(217, 119, 6, 0.3)",
    barColor: "#f59e0b",
  },
  {
    id: "live",
    gradient: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    shadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
    barColor: "#22c55e",
  },
  {
    id: "recordings",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)",
    shadow: "0 4px 12px rgba(225, 29, 72, 0.3)",
    barColor: "#f43f5e",
  },
  {
    id: "storage",
    gradient: "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
    shadow: "0 4px 12px rgba(8, 145, 178, 0.3)",
    barColor: "#06b6d4",
  },
  {
    id: "time",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    shadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
    barColor: "#8b5cf6",
  },
];

function StatIcon({ id, index }: { id: string; index: number }): React.ReactElement {
  const config = STAT_ICONS[index] ?? STAT_ICONS[0];

  const renderIcon = () => {
    switch (id) {
      case "sessions": {
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="3"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path d="M3 9h18" stroke="white" strokeWidth="2" />
            <rect x="7" y="12" width="4" height="5" rx="1" fill="white" opacity="0.9" />
            <rect x="13" y="12" width="4" height="3" rx="1" fill="white" opacity="0.6" />
          </svg>
        );
      }
      case "live": {
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" fill="white" />
            <circle
              cx="12"
              cy="12"
              r="7"
              stroke="white"
              strokeWidth="2"
              fill="none"
              opacity="0.6"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="white"
              strokeWidth="1.5"
              fill="none"
              opacity="0.3"
            />
          </svg>
        );
      }
      case "recordings": {
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2C10.34 2 9 3.34 9 5v6c0 1.66 1.34 3 3 3s3-1.34 3-3V5c0-1.66-1.34-3-3-3z"
              fill="white"
            />
            <path
              d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5h-2c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
              fill="white"
              opacity="0.9"
            />
          </svg>
        );
      }
      case "storage": {
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <ellipse cx="12" cy="6" rx="8" ry="3" stroke="white" strokeWidth="2" fill="none" />
            <path
              d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <ellipse
              cx="12"
              cy="12"
              rx="8"
              ry="3"
              stroke="white"
              strokeWidth="2"
              fill="none"
              opacity="0.5"
            />
          </svg>
        );
      }
      case "time": {
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" fill="none" />
            <path
              d="M12 6v6l4 2"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="12" cy="12" r="2" fill="white" />
          </svg>
        );
      }
      default: {
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
          </svg>
        );
      }
    }
  };

  return (
    <div className="stat-icon" style={{ background: config.gradient, boxShadow: config.shadow }}>
      {renderIcon()}
    </div>
  );
}

function FeatureIcon({ id }: { id: string }): React.ReactElement {
  const config = FEATURE_ICONS[id] ?? {
    gradient: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    shadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
  };

  return (
    <div className="feature-icon" style={{ background: config.gradient, boxShadow: config.shadow }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
        {id === "oscilloscope" && <path d="M2 12 Q 6 6, 10 12 T 18 12 T 22 12" />}
        {id === "sessions" && <path d="M4 4h16v16H4z M4 9h16 M9 4v16" />}
        {id === "export" && (
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12" />
        )}
        {id === "database" && (
          <path d="M12 2C6.48 2 2 4.69 2 7v10c0 2.31 4.48 5 10 5s10-2.69 10-5V7c0-2.31-4.48-5-10-5z" />
        )}
        {id === "spectrum" && (
          <>
            <rect x="2" y="12" width="4" height="8" rx="1" />
            <rect x="8" y="8" width="4" height="12" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
            <rect x="20" y="10" width="2" height="10" rx="1" />
          </>
        )}
        {id === "radio" && (
          <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9 M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5 M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5 M19.1 4.9C23 8.8 23 15.1 19.1 19" />
        )}
        {id === "storage" && <path d="M22 12h-6l-2 3h-4l-2-3H2 M12 2v20 M8 6l4-4 4 4" />}
      </svg>
    </div>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <Skeleton className="w-40 h-16 mx-auto" />
        <Skeleton className="w-48 h-6 mx-auto" />
        <Skeleton className="w-32 h-8 mx-auto rounded-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-full h-32 rounded-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="w-32 h-4" />
        <div className="space-y-2">
          <Skeleton className="w-full h-16 rounded-xl" />
          <Skeleton className="w-full h-16 rounded-xl" />
          <Skeleton className="w-full h-16 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function About(): React.ReactElement {
  const { setContent } = useHeader();
  const { data: aboutData, loading: aboutLoading } = useAboutInfo();
  const { data: featuresData, loading: featuresLoading } = useFeatures();
  const { data: changelogData, loading: changelogLoading } = useChangelog();
  const { data: sessionCounts } = useSessionStatusCounts();
  const { data: recordingStats } = useRecordingStats();

  React.useEffect(() => {
    setContent({
      title: "About",
    });
  }, [setContent]);

  const loading = aboutLoading || featuresLoading || changelogLoading;
  const description = aboutData?.aboutInfo?.description;
  const features = featuresData?.features ?? [];
  const changelog = changelogData?.changelog ?? [];

  // Calculate max values for progress bar percentages
  const maxSessions = Math.max(sessionCounts?.sessionStatusCounts.total ?? 0, 10);
  const maxLive = Math.max(sessionCounts?.sessionStatusCounts.liveCount ?? 0, 5);
  const maxRecordings = Math.max(recordingStats?.recordingStats.totalRecordings ?? 0, 20);
  const maxStorageBytes = Math.max(recordingStats?.recordingStats.totalSizeBytes ?? 0, 1e9); // 1GB default max
  const maxDurationMs = Math.max(recordingStats?.recordingStats.totalDurationMs ?? 0, 3_600_000); // 1hr default max

  const stats = [
    {
      label: "Total Sessions",
      value: sessionCounts?.sessionStatusCounts.total ?? 0,
      icon: "sessions",
      maxValue: maxSessions,
      rawValue: sessionCounts?.sessionStatusCounts.total ?? 0,
    },
    {
      label: "Live Sessions",
      value: sessionCounts?.sessionStatusCounts.liveCount ?? 0,
      icon: "live",
      maxValue: maxLive,
      rawValue: sessionCounts?.sessionStatusCounts.liveCount ?? 0,
    },
    {
      label: "Total Recordings",
      value: recordingStats?.recordingStats.totalRecordings ?? 0,
      icon: "recordings",
      maxValue: maxRecordings,
      rawValue: recordingStats?.recordingStats.totalRecordings ?? 0,
    },
    {
      label: "Storage Used",
      value: formatBytes(recordingStats?.recordingStats.totalSizeBytes ?? 0),
      icon: "storage",
      maxValue: maxStorageBytes,
      rawValue: recordingStats?.recordingStats.totalSizeBytes ?? 0,
    },
    {
      label: "Recording Time",
      value: formatDuration(recordingStats?.recordingStats.totalDurationMs ?? 0),
      icon: "time",
      maxValue: maxDurationMs,
      rawValue: recordingStats?.recordingStats.totalDurationMs ?? 0,
    },
  ];

  return (
    <div className="page-container">
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <header className="page-header">
            <div className="logo-large">
              <svg
                width="180"
                height="72"
                viewBox="0 0 300 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="mx-auto"
              >
                <text
                  x="10"
                  y="100"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize="100"
                  fontWeight="900"
                  fill="#e11d48"
                >
                  A
                </text>
                <path
                  d="M 25 55 Q 40 45, 55 55 T 85 55"
                  stroke="#ffffff"
                  strokeWidth="3"
                  fill="none"
                />
                <text
                  x="100"
                  y="100"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize="100"
                  fontWeight="900"
                  fill="#ffffff"
                >
                  S
                </text>
                <text
                  x="185"
                  y="100"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize="100"
                  fontWeight="900"
                  fill="#ffffff"
                >
                  V
                </text>
              </svg>
            </div>
            <p className="app-tagline text-[18px] text-[--color-text-secondary] mb-4">
              Real-time Audio Analysis & Recording
            </p>
            <div className="version-badge">
              <span className="dot w-2 h-2 bg-green-500 rounded-full" />
              <span>Version {APP_VERSION}</span>
            </div>
          </header>

          <section className="section">
            <h2 className="section-title">Activity</h2>
            <div className="card p-0">
              <div className="stats-list">
                {stats.map((stat, index) => {
                  const iconConfig = STAT_ICONS[index] ?? STAT_ICONS[0];
                  const percentage = stat.maxValue > 0 ? (stat.rawValue / stat.maxValue) * 100 : 0;
                  const hasData = stat.rawValue > 0;
                  const barColor = hasData ? iconConfig.barColor : "#6b7280";
                  const barWidth = hasData ? `${Math.min(percentage, 100)}%` : "100%";
                  const barOpacity = hasData ? 1 : 0.3;

                  return (
                    <div key={stat.label} className="stat-row">
                      <StatIcon id={stat.icon} index={index} />
                      <div className="stat-info">
                        <div className="stat-header">
                          <span className="stat-label">{stat.label}</span>
                          <span className="stat-value">{stat.value}</span>
                        </div>
                        <div className="stat-bar-container">
                          <div
                            className="stat-bar"
                            style={{
                              width: barWidth,
                              backgroundColor: barColor,
                              opacity: barOpacity,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">About</h2>
            <div className="card p-6">
              <div
                className="text-[15px] leading-relaxed text-left [&_strong]:text-[--color-foreground]"
                dangerouslySetInnerHTML={{ __html: description ?? "" }}
              />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Features</h2>
            <div className="feature-list">
              {features.map((feature) => (
                <div key={feature.id} className="feature-item">
                  <FeatureIcon id={feature.id} />
                  <div className="feature-content">
                    <div className="feature-title">{feature.title}</div>
                    <div className="feature-desc text-[13px] text-[--color-text-tertiary]">
                      {feature.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">WHAT'S NEW</h2>
            <div className="space-y-4">
              {changelog.map((release) => (
                <div key={release.version} className="card">
                  <div className="changelog-header mb-3">
                    {release.changes.map((change, index) => (
                      <span key={index} className="changelog-badge">
                        {change.type}
                      </span>
                    ))}
                    <span className="changelog-version">v{release.version}</span>
                  </div>
                  {release.changes.map((change, index) => (
                    <div key={index}>
                      <div className="card-header">
                        <div className="card-title">{change.title}</div>
                        <div className="card-date text-[12px] text-[--color-text-tertiary]">
                          {release.date}
                        </div>
                      </div>
                      <div className="card-content text-[14px] text-[--color-text-secondary] leading-relaxed">
                        {change.description}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Resources</h2>
            <div className="link-list">
              <a href="/documentation" className="link-item">
                <span className="left">
                  <span className="icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </span>
                  Documentation
                </span>
                <span className="arrow">→</span>
              </a>
              <a href="/report-issue" className="link-item">
                <span className="left">
                  <span className="icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  Report an Issue
                </span>
                <span className="arrow">→</span>
              </a>
              <a href="/contact-support" className="link-item">
                <span className="left">
                  <span className="icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  Contact Support
                </span>
                <span className="arrow">→</span>
              </a>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Legal</h2>
            <div className="link-list">
              <a href="/legal?tab=privacy" className="link-item">
                <span className="left">
                  <span className="icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  Privacy Policy
                </span>
                <span className="arrow">→</span>
              </a>
              <a href="/legal?tab=terms" className="link-item">
                <span className="left">
                  <span className="icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </span>
                  Terms of Service
                </span>
                <span className="arrow">→</span>
              </a>
              <a href="/legal?tab=licenses" className="link-item">
                <span className="left">
                  <span className="icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                  Licenses
                </span>
                <span className="arrow">→</span>
              </a>
            </div>
          </section>

          <footer className="page-footer text-center text-[--color-text-tertiary] text-[13px] mt-12">
            <p>© 2026 vyzoriX. All rights reserved.</p>
          </footer>
        </>
      )}
    </div>
  );
}
