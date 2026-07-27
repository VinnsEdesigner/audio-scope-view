/**
 * Dashboard - Main dashboard matching mockup design
 * Features: Stats grid, Live Waveform, Recent Scopes, Quick Actions, System Status
 */

import { Link } from "react-router-dom";
import {
  Radio,
  Key,
  Activity,
  Clock,
  PlusCircle,
  Mic,
  Copy,
  TrendingUp,
} from "lucide-react";

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Stat Card Component
function StatCard({
  label,
  value,
  trend,
  trendDirection,
  icon,
}: {
  label: string;
  value: string;
  trend?: string;
  trendDirection?: "up" | "down";
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-bg-secondary border border-border-subtle rounded-xl p-6 transition-all hover:-translate-y-0.5 hover:border-border-hover">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[13px] font-medium uppercase tracking-wider text-text-tertiary">
          {label}
        </span>
        <div className="w-9 h-9 bg-bg-elevated border border-border-subtle rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="text-[36px] font-bold tracking-tight mb-2 leading-none text-foreground">
        {value}
      </div>
      {trend && (
        <div className={cn("flex items-center gap-1.5 text-[13px]", trendDirection === "up" ? "text-rose-300" : "text-rose-400")}>
          <TrendingUp size={14} />
          {trend}
        </div>
      )}
    </div>
  );
}

// Action Button Component
function ActionButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 bg-bg-elevated rounded-lg hover:bg-bg-hover transition-all text-left"
    >
      <div className="w-10 h-10 bg-bg-primary rounded-lg flex items-center justify-center text-text-secondary">
        {icon}
      </div>
      <div>
        <div className="text-[14px] font-medium text-foreground">{title}</div>
        <div className="text-[13px] text-text-tertiary">{description}</div>
      </div>
    </button>
  );
}

// Scope Item Component
function ScopeItem({
  name,
  lastActivity,
  status,
}: {
  name: string;
  lastActivity: string;
  status: "live" | "paused" | "offline";
}) {
  const statusStyles = {
    live: "text-rose-300",
    paused: "text-rose-400",
    offline: "text-text-tertiary",
  };

  const dotStyles = {
    live: "bg-rose-300",
    paused: "bg-rose-400",
    offline: "bg-text-tertiary",
  };

  return (
    <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-lg hover:bg-bg-hover transition-all cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-bg-primary rounded-lg flex items-center justify-center text-text-secondary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <path d="M2 12h2m4 0h2m4 0h2m4 0h2" />
            <path d="M6 8v8M10 6v12M14 9v6M18 7v10" />
          </svg>
        </div>
        <div>
          <div className="text-[14px] font-medium text-foreground">{name}</div>
          <div className="text-[12px] text-text-tertiary">Last activity: {lastActivity}</div>
        </div>
      </div>
      <span className={cn("flex items-center gap-1.5 text-[12px] font-medium", statusStyles[status])}>
        <span className={cn("w-1.5 h-1.5 rounded-full", dotStyles[status])} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}

export function Dashboard(): React.ReactElement {
  return (
    <div className="w-full min-h-screen">
      {/* Edge-to-edge with hamburger overlay from top-left */}
      <div className="w-full px-14 py-12 lg:px-20">
        {/* Page Header */}
        <header className="mb-10">
          <h1 className="text-[28px] font-bold tracking-tight text-foreground mb-2">
            Welcome back
          </h1>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Monitor your audio scopes and manage your resources from one place
          </p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-5 mb-10">
          <StatCard
            label="Active Scopes"
            value="3"
            trend="+1 this week"
            trendDirection="up"
            icon={<Radio size={18} className="text-text-secondary" />}
          />
          <StatCard
            label="Total API Keys"
            value="12"
            icon={<Key size={18} className="text-text-secondary" />}
          />
          <StatCard
            label="Data Processed"
            value="2.4GB"
            trend="+180MB today"
            trendDirection="up"
            icon={<Activity size={18} className="text-text-secondary" />}
          />
          <StatCard
            label="Uptime"
            value="99.9%"
            icon={<Clock size={18} className="text-text-secondary" />}
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-[1fr_380px] gap-6">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Live Waveform */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Live Waveform</h2>
                <span className="text-[12px] text-text-tertiary font-mono">2:34:56 PM</span>
              </div>
              <div className="bg-bg-secondary border border-border-subtle rounded-xl p-6">
                <div className="relative h-[180px] bg-bg-primary border border-border-subtle rounded-lg overflow-hidden">
                  {/* Grid pattern */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  {/* Center line */}
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
                  {/* Waveform visualization */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 400 180"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M0 90 L20 90 L30 60 L40 120 L50 40 L60 140 L70 30 L80 150 L90 50 L100 130 L110 70 L120 110 L130 80 L140 100 L150 90 L160 85 L170 95 L180 75 L190 105 L200 90 L210 80 L220 100 L230 70 L240 110 L250 60 L260 120 L270 40 L280 140 L290 30 L300 150 L310 50 L320 130 L330 70 L340 110 L350 80 L360 100 L370 90 L380 85 L390 95 L400 90"
                      fill="none"
                      stroke="#fb7185"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {/* Measurements */}
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center p-3 bg-bg-primary rounded-lg">
                    <div className="text-[18px] font-semibold font-mono text-rose-400">1.2kHz</div>
                    <div className="text-[11px] uppercase tracking-wider text-text-tertiary mt-1">Frequency</div>
                  </div>
                  <div className="text-center p-3 bg-bg-primary rounded-lg">
                    <div className="text-[18px] font-semibold font-mono text-rose-400">3.6V</div>
                    <div className="text-[11px] uppercase tracking-wider text-text-tertiary mt-1">Amplitude</div>
                  </div>
                  <div className="text-center p-3 bg-bg-primary rounded-lg">
                    <div className="text-[18px] font-semibold font-mono text-rose-400">0°</div>
                    <div className="text-[11px] uppercase tracking-wider text-text-tertiary mt-1">Phase</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Recent Scopes */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Recent Scopes</h2>
                <Link to="/scopes" className="text-[13px] font-medium text-accent-primary hover:text-accent-hover transition-colors">
                  View all
                </Link>
              </div>
              <div className="space-y-3">
                <ScopeItem name="Production Scope" lastActivity="2 min ago" status="live" />
                <ScopeItem name="Lab Testing" lastActivity="15 min ago" status="paused" />
                <ScopeItem name="Field Recording" lastActivity="1 hour ago" status="offline" />
                <ScopeItem name="Debug Monitor" lastActivity="3 hours ago" status="offline" />
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold tracking-tight text-foreground">Quick Actions</h2>
              </div>
              <div className="space-y-3">
                <ActionButton
                  icon={<PlusCircle size={20} />}
                  title="New Scope"
                  description="Create a new audio capture scope"
                  onClick={() => {}}
                />
                <ActionButton
                  icon={<Mic size={20} />}
                  title="Test Microphone"
                  description="Check your audio input device"
                  onClick={() => {}}
                />
                <Link to="/api-keys" className="block">
                  <ActionButton
                    icon={<Copy size={20} />}
                    title="Generate API Key"
                    description="Create keys for external access"
                    onClick={() => {}}
                  />
                </Link>
              </div>
            </section>

            {/* System Status */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-semibold tracking-tight text-foreground">System Status</h2>
              </div>
              <div className="bg-bg-secondary border border-border-subtle rounded-xl p-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-text-secondary">API Server</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-rose-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-300" />
                      Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-text-secondary">Audio Engine</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-rose-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      Running
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-text-secondary">Storage</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                      45% used
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
