import * as React from "react";
import { useHeader } from "@/contexts/header-context";
import { Send, Loader2 } from "lucide-react";

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const TIPS = [
  "Include your device type and operating system",
  "Describe the steps to reproduce the issue",
  "Attach screenshots if possible",
  "Include any error messages you see",
];

export function ReportIssue(): React.ReactElement {
  const { setContent } = useHeader();
  const [message, setMessage] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setContent({
      title: "Report a bug?",
    });
  }, [setContent]);

  const handleSendEmail = () => {
    setIsLoading(true);
    const email = "kamaukevin0033@gmail.com";
    const subjectEncoded = encodeURIComponent(subject || "Bug Report");
    const bodyEncoded = encodeURIComponent(message);
    // Small delay to show spinner
    setTimeout(() => {
      window.open(`mailto:${email}?subject=${subjectEncoded}&body=${bodyEncoded}`);
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Report an issue</h1>
        <p className="page-subtitle">Found a bug? Let us know so we can fix it.</p>
      </div>

      <div className="content-section" style={{ margin: "0 auto" }}>
        <div className="info-card">
          <h3>Send Email</h3>
          <div style={{ marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Subject (optional)"
              value={subject}
              onChange={(event_) => setSubject(event_.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: "var(--color-bg-primary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-foreground)",
                fontSize: "14px",
                marginBottom: "10px",
              }}
            />
            <textarea
              placeholder="Describe the issue..."
              value={message}
              onChange={(event_) => setMessage(event_.target.value)}
              rows={5}
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: "var(--color-bg-primary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-foreground)",
                fontSize: "14px",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
          </div>
          <button
            onClick={handleSendEmail}
            disabled={!message.trim() || isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "10px 18px",
              backgroundColor:
                message.trim() && !isLoading ? "var(--color-primary)" : "var(--color-bg-hover)",
              color: message.trim() && !isLoading ? "#fff" : "var(--color-text-tertiary)",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontWeight: "500",
              cursor: message.trim() && !isLoading ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              minWidth: "120px",
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-block-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} />
                Send Email
              </>
            )}
          </button>
        </div>

        <div className="info-card">
          <h3>GitHub</h3>
          <div className="contact-item">
            <div className="contact-icon">
              <GitHubIcon />
            </div>
            <div className="contact-info">
              <div className="contact-label">Open an Issue</div>
              <div className="contact-value">
                <a
                  href="https://github.com/VinnsEdesigner/audio-scope-view/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open an Issue on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="note">
          <strong>Tips for reporting issues:</strong>
          <br />
          {TIPS.map((tip, index) => (
            <span key={index}>
              • {tip}
              <br />
            </span>
          ))}
        </div>
      </div>

      <footer className="page-footer">
        <p>© 2026 vyzoriX. All rights reserved.</p>
      </footer>
    </div>
  );
}
