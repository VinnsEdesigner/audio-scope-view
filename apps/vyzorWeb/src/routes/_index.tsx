/**
 * Dashboard - Home route showing overview of audio scopes
 */

import { useNavigate } from "react-router-dom";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, trend, icon }: StatCardProps): React.ReactElement {
  return (
    <div className="stat-card">
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      {trend && <div className="stat-trend">{trend}</div>}
    </div>
  );
}

interface ScopeItemProps {
  name: string;
  lastActivity: string;
  status: "live" | "paused" | "offline";
}

function ScopeItem({ name, lastActivity, status }: ScopeItemProps): React.ReactElement {
  return (
    <div className="scope-item">
      <div className="scope-info">
        <div className="scope-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12h2m4 0h2m4 0h2m4 0h2" />
            <path d="M6 8v8M10 6v12M14 9v6M18 7v10" />
          </svg>
        </div>
        <div className="scope-details">
          <span className="scope-name">{name}</span>
          <span className="scope-meta">Last activity: {lastActivity}</span>
        </div>
      </div>
      <div className="scope-status">
        <span className={`status-badge ${status}`}>
          <span className="status-dot" />
          {status === "live" ? "Live" : status === "paused" ? "Paused" : "Offline"}
        </span>
      </div>
    </div>
  );
}

export function Dashboard(): React.ReactElement {
  const navigate = useNavigate();

  const stats: StatCardProps[] = [
    {
      label: "Total Scopes",
      value: 12,
      trend: "+3 this week",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12h2m4 0h2m4 0h2m4 0h2" />
          <path d="M6 8v8M10 6v12M14 9v6M18 7v10" />
        </svg>
      ),
    },
    {
      label: "Active Now",
      value: 3,
      trend: "Capturing",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      ),
    },
    {
      label: "Waveforms",
      value: "1,847",
      trend: "+124 today",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12h4l3-9 4 18 3-9h4" />
        </svg>
      ),
    },
    {
      label: "Total Samples",
      value: "2.4M",
      trend: "+850K today",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M9 9h6v6H9z" />
        </svg>
      ),
    },
  ];

  const scopes: ScopeItemProps[] = [
    { name: "Production Scope", lastActivity: "2 min ago", status: "live" },
    { name: "Lab Testing", lastActivity: "15 min ago", status: "paused" },
    { name: "Field Recording", lastActivity: "1 hour ago", status: "offline" },
    { name: "Debug Monitor", lastActivity: "3 hours ago", status: "offline" },
  ];

  return (
    <div className="settings-page">
      {/* Header */}
      <header className="settings-header">
        <h1 className="settings-title">Dashboard</h1>
        <p className="settings-description">Overview of your audio scopes and recent activity</p>
      </header>

      {/* Stats Grid */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div className="section-title-group">
            <h2 className="section-title">Overview</h2>
            <p className="section-description">Your audio scope statistics</p>
          </div>
        </div>

        <div className="settings-card">
          {stats.map((stat, index) => (
            <div key={index} className="settings-row">
              <div className="settings-row-content">
                <div className="settings-label">{stat.label}</div>
                <div className="settings-label-description">{stat.trend}</div>
              </div>
              <div className="settings-control">
                <span className="stat-value-inline">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Scopes */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12h2m4 0h2m4 0h2m4 0h2" />
              <path d="M6 8v8M10 6v12M14 9v6M18 7v10" />
            </svg>
          </div>
          <div className="section-title-group">
            <h2 className="section-title">Recent Scopes</h2>
            <p className="section-description">Your latest audio capture scopes</p>
          </div>
        </div>

        <div className="settings-card">
          {scopes.map((scope, index) => (
            <ScopeItem key={index} {...scope} />
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </div>
          <div className="section-title-group">
            <h2 className="section-title">Quick Actions</h2>
            <p className="section-description">Common tasks and shortcuts</p>
          </div>
        </div>

        <div className="settings-card">
          <button
            type="button"
            className="settings-row-hover"
            onClick={() => navigate("/scope")}
          >
            <div className="settings-row-content">
              <div className="settings-label">New Scope</div>
              <div className="settings-label-description">Create a new audio capture scope</div>
            </div>
          </button>

          <button
            type="button"
            className="settings-row-hover"
            onClick={() => navigate("/api-keys")}
          >
            <div className="settings-row-content">
              <div className="settings-label">Generate API Key</div>
              <div className="settings-label-description">Create keys for external access</div>
            </div>
          </button>
        </div>
      </section>

      {/* System Status */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className="section-title-group">
            <h2 className="section-title">System Status</h2>
            <p className="section-description">Health and connectivity</p>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">API Server</div>
            </div>
            <div className="settings-control">
              <div className="version-badge">
                <span className="version-badge-dot" />
                Online
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Audio Engine</div>
            </div>
            <div className="settings-control">
              <div className="version-badge" style={{ borderColor: "#fb7185" }}>
                <span className="version-badge-dot" style={{ background: "#fb7185" }} />
                Running
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Storage</div>
            </div>
            <div className="settings-control">
              <div className="version-badge">
                <span className="version-badge-dot" />
                45% used
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
