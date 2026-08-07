import * as React from "react";
import { useHeader } from "@/contexts/header-context";
import { Mail, MessageCircle } from "lucide-react";

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const CONTACT_ITEMS = [
  {
    label: "Email",
    value: "kamaukevin0033@gmail.com",
    href: "mailto:kamaukevin0033@gmail.com",
    icon: <Mail size={18} />,
  },
  {
    label: "WhatsApp",
    value: "+254113513725",
    href: "https://wa.me/254113513725",
    icon: <MessageCircle size={18} />,
  },
  {
    label: "Facebook",
    value: "Kev vinns",
    href: "https://www.facebook.com/Kevvinns",
    icon: <FacebookIcon />,
  },
  {
    label: "GitHub",
    value: "VinnsEdesigner",
    href: "https://github.com/VinnsEdesigner",
    icon: <GitHubIcon />,
  },
];

export function ContactSupport(): React.ReactElement {
  const { setContent } = useHeader();

  React.useEffect(() => {
    setContent({
      title: "Contact Support",
    });
  }, [setContent]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Contact Support</h1>
        <p className="page-subtitle">Need help? We're here for you.</p>
      </div>

      <div className="content-section" style={{ margin: "0 auto" }}>
        <div className="info-card">
          <h3>Get in Touch</h3>

          {CONTACT_ITEMS.map((item) => (
            <div key={item.label} className="contact-item">
              <div className="contact-icon">{item.icon}</div>
              <div className="contact-info">
                <div className="contact-label">{item.label}</div>
                <div className="contact-value">
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.value}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="note">
          <strong>We typically respond within 24-48 hours.</strong>
          <br />
          For urgent issues, consider opening a GitHub issue with the &quot;bug&quot; label.
        </div>
      </div>

      <footer className="page-footer">
        <p>© 2026 vyzoriX. All rights reserved.</p>
      </footer>
    </div>
  );
}
