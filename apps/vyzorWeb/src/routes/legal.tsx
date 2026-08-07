import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useHeader } from "@/contexts/header-context";

type LegalTab = "privacy" | "terms" | "licenses";

const TABS = [
  { id: "privacy" as LegalTab, label: "Privacy Policy", href: "/legal?tab=privacy" },
  { id: "terms" as LegalTab, label: "Terms of Service", href: "/legal?tab=terms" },
  { id: "licenses" as LegalTab, label: "Licenses", href: "/legal?tab=licenses" },
];

function PrivacyPolicy(): React.ReactElement {
  return (
    <section id="privacy" className="section">
      <h2 className="section-title">Privacy Policy</h2>

      <div className="content-card">
        <h3>Introduction</h3>
        <p>
          Audio Scope View (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to
          protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard
          your information when you use our application and related services.
        </p>

        <p>
          By accessing or using the Service, you acknowledge that you have read, understood, and
          agree to be bound by this Privacy Policy.
        </p>

        <h3>Information We Collect</h3>

        <h3>Audio Data</h3>
        <p>
          When you use the oscilloscope or recording features, audio is processed locally on your
          device using the Web Audio API. Your microphone input is not transmitted to our servers
          unless you explicitly choose to save recordings to your account.
        </p>

        <h3>Account Information</h3>
        <p>
          If you create an account, we collect information you provide such as your email address.
          This is used solely for authentication and account management.
        </p>

        <h3>Cloud Storage</h3>
        <p>
          When you save recordings to the cloud, they are stored securely using Turso, an edge
          database service. Your saved recordings remain yours and we do not use them for any
          purpose other than providing the Service.
        </p>

        <h3>How We Use Your Information</h3>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, maintain, and improve our Service</li>
          <li>Respond to your comments and questions</li>
          <li>Send you updates and security alerts</li>
        </ul>

        <h3>Data Security</h3>
        <p>
          We implement appropriate security measures to protect your personal information. However,
          no method of transmission over the Internet is 100% secure.
        </p>

        <div className="highlight-box">
          <p>
            <strong>Your Control:</strong> You can delete your recordings and account data at any
            time through the app settings.
          </p>
        </div>

        <h3>Third-Party Services</h3>
        <p>
          We use Turso for database services. Their privacy policy governs how they handle your
          data.
        </p>

        <h3>Changes to This Policy</h3>
        <p>
          We may update this Privacy Policy occasionally. Changes will be posted on this page with
          an updated date.
        </p>

        <h3>Contact</h3>
        <p>For privacy concerns, contact us at:</p>
        <p>
          <strong>Email:</strong> kamaukevin0033@gmail.com
          <br />
          <strong>GitHub:</strong> github.com/VinnsEdesigner
        </p>
      </div>
    </section>
  );
}

function TermsOfService(): React.ReactElement {
  return (
    <section id="terms" className="section">
      <h2 className="section-title">Terms of Service</h2>

      <div className="content-card">
        <h3>Acceptance of Terms</h3>
        <p>
          By using Audio Scope View, you agree to these Terms of Service. If you do not agree,
          please do not use the app.
        </p>

        <h3>The Service</h3>
        <p>
          Audio Scope View provides real-time audio visualization and analysis tools, including:
        </p>
        <ul>
          <li>Oscilloscope display for waveform visualization</li>
          <li>Audio recording capabilities</li>
          <li>Session management features</li>
          <li>Export functionality for recordings</li>
          <li>Cloud synchronization via Turso database</li>
        </ul>

        <h3>Acceptable Use</h3>
        <p>You agree to:</p>
        <ul>
          <li>Use the Service only for lawful purposes</li>
          <li>Not attempt to gain unauthorized access</li>
          <li>Not transmit harmful code or malicious content</li>
          <li>Not interfere with or disrupt the Service</li>
        </ul>

        <h3>Audio Recording</h3>
        <p>
          When using recording features, you are responsible for complying with applicable laws in
          your jurisdiction. This includes obtaining necessary consent when required.
        </p>

        <div className="highlight-box">
          <p>
            <strong>Legal Compliance:</strong> Audio recording laws vary by location. It is your
            responsibility to understand and follow the laws applicable to your situation.
          </p>
        </div>

        <h3>Your Content</h3>
        <p>
          You retain ownership of recordings you create. By saving recordings, you grant us
          permission to store them on your behalf using our cloud service.
        </p>

        <h3>Intellectual Property</h3>
        <p>
          The app and its original content, features, and design are owned by Audio Scope View. You
          may not copy, modify, or distribute them without permission.
        </p>

        <h3>Service Changes</h3>
        <p>
          We may update or modify the Service at any time. We strive to provide reliable service but
          cannot guarantee uninterrupted availability.
        </p>

        <h3>Contact</h3>
        <p>Questions about these terms? Contact us at:</p>
        <p>
          <strong>Email:</strong> kamaukevin0033@gmail.com
          <br />
          <strong>GitHub:</strong> github.com/VinnsEdesigner
        </p>
      </div>
    </section>
  );
}

function Licenses(): React.ReactElement {
  return (
    <section id="licenses" className="section">
      <h2 className="section-title">Third-Party Licenses</h2>

      <div className="content-card">
        <p>
          Audio Scope View uses open source software. This page acknowledges the projects that make
          our app possible.
        </p>

        <h3>Technologies We Use</h3>

        <h3>Svelte</h3>
        <p>MIT License</p>
        <p>
          <a href="https://github.com/sveltejs/svelte" target="_blank" rel="noopener noreferrer">
            github.com/sveltejs/svelte
          </a>
        </p>

        <h3>TypeScript</h3>
        <p>Apache License 2.0</p>
        <p>
          <a
            href="https://github.com/microsoft/TypeScript"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/microsoft/TypeScript
          </a>
        </p>

        <h3>Vite</h3>
        <p>MIT License</p>
        <p>
          <a href="https://github.com/vitejs/vite" target="_blank" rel="noopener noreferrer">
            github.com/vitejs/vite
          </a>
        </p>

        <h3>Tailwind CSS</h3>
        <p>MIT License</p>
        <p>
          <a
            href="https://github.com/tailwindlabs/tailwindcss"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/tailwindlabs/tailwindcss
          </a>
        </p>

        <h3>Turso</h3>
        <p>MIT License</p>
        <p>
          <a
            href="https://github.com/tursodatabase/turso"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/tursodatabase/turso
          </a>
        </p>

        <h3>Lucide Icons</h3>
        <p>ISC License</p>
        <p>
          <a
            href="https://github.com/lucide-icons/lucide"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/lucide-icons/lucide
          </a>
        </p>

        <h3>Inter Font</h3>
        <p>SIL Open Font License 1.1</p>
        <p>
          <a href="https://github.com/rsms/inter" target="_blank" rel="noopener noreferrer">
            github.com/rsms/inter
          </a>
        </p>

        <h3>Web Audio API</h3>
        <p>W3C Software License</p>
        <p>Part of web platform specifications</p>

        <h3>Acknowledgments</h3>
        <p>
          We&apos;re grateful to all open source developers whose work makes projects like Audio
          Scope View possible.
        </p>

        <p>For complete license details, see the package.json file in our repository.</p>
      </div>
    </section>
  );
}

export function Legal(): React.ReactElement {
  const [searchParameters, setSearchParameters] = useSearchParams();
  const { setContent } = useHeader();

  const activeTab: LegalTab = (searchParameters.get("tab") as LegalTab) || "privacy";

  React.useEffect(() => {
    setContent({
      title: "Legal",
      subtitle: "Last updated: December 15, 2024",
      variant: "tabbed",
      backUrl: "/about",
      tabs: TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        href: tab.href,
        isActive: tab.id === activeTab,
      })),
    });
  }, [setContent, activeTab]);

  const handleTabChange = (tab: LegalTab) => {
    setSearchParameters({ tab });
  };

  return (
    <div className="page-container">
      {/* Tab navigation for mobile / content area */}
      <nav className="nav-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Page header */}
      <header className="page-header">
        <h1 className="page-title">Legal Information</h1>
        <p className="last-updated">Last updated: December 15, 2024</p>
      </header>

      {/* Content based on active tab */}
      {activeTab === "privacy" && <PrivacyPolicy />}
      {activeTab === "terms" && <TermsOfService />}
      {activeTab === "licenses" && <Licenses />}

      <footer className="page-footer">
        <p>© 2026 vyzoriX. All rights reserved.</p>
      </footer>
    </div>
  );
}
