"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  {
    group: "Overview",
    items: [
      { href: "/", label: "Home", icon: "⌂" },
      { href: "/alerts", label: "Alerts", icon: "⚠" },
    ],
  },
  {
    group: "People",
    items: [
      { href: "/designers", label: "Designers", icon: "◈" },
      { href: "/partners", label: "Partners", icon: "◉" },
    ],
  },
  {
    group: "Rhythm",
    items: [
      { href: "/one-on-ones", label: "1:1 Calendar", icon: "⊡" },
      { href: "/calendar", label: "Import from Outlook", icon: "📅" },
      { href: "/checkins/biweekly", label: "Biweekly check-ins", icon: "⊞" },
      { href: "/my-actions", label: "My actions", icon: "✓" },
      { href: "/concerns", label: "Team concerns", icon: "⚑" },
    ],
  },
  {
    group: "Reviews",
    items: [
      { href: "/cycles", label: "Cycles", icon: "◷" },
      { href: "/rubric", label: "Rubric", icon: "≡" },
    ],
  },
  {
    group: "Insights",
    items: [
      { href: "/reports", label: "Team report", icon: "▦" },
      { href: "/chat", label: "Ask AI", icon: "✦" },
    ],
  },
  {
    group: "Ingest",
    items: [
      { href: "/ingest/email", label: "Paste email", icon: "✉" },
      { href: "/ingest/note", label: "Paste note", icon: "✎" },
      { href: "/ingest/form", label: "Manual entry", icon: "✚" },
      { href: "/ingest/upload", label: "Upload file", icon: "⇪" },
    ],
  },
  {
    group: "System",
    items: [{ href: "/audit", label: "Audit log", icon: "⊙" }],
  },
];

export function Sidebar() {
  const path = usePathname();
  const [urgentCount, setUrgentCount] = useState(0);

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((res) => setUrgentCount(res.counts?.urgent ?? 0))
      .catch(() => {});
  }, []);

  function isActive(href: string) {
    if (href === "/") return path === "/";
    return path.startsWith(href);
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 w-52 flex flex-col z-20"
      style={{
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(40px) saturate(200%)",
        WebkitBackdropFilter: "blur(40px) saturate(200%)",
        borderRight: "1px solid rgba(0, 0, 0, 0.07)",
        boxShadow: "1px 0 0 rgba(0,0,0,0.03)",
      }}
    >
      {/* Logo */}
      <div
        className="px-4 py-5"
        style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}
      >
        <p className="text-sm font-semibold tracking-tight text-zinc-900">
          Design Intel
        </p>
        <p className="text-[10px] mt-0.5 text-zinc-400">
          Team manager dashboard
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map((section) => (
          <div key={section.group} className="mb-4">
            <p className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-widest text-zinc-400">
              {section.group}
            </p>
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-[13px] font-medium transition-all mb-0.5"
                  style={
                    active
                      ? {
                          background: "rgba(0, 122, 255, 0.10)",
                          color: "#007AFF",
                        }
                      : {
                          color: "rgba(60, 60, 67, 0.65)",
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
                      (e.currentTarget as HTMLElement).style.color = "#1c1c1e";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "rgba(60,60,67,0.65)";
                    }
                  }}
                >
                  <span className="text-sm w-4 text-center leading-none opacity-70">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/alerts" && urgentCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                      style={{ background: "rgba(255,59,48,0.12)", color: "#FF3B30" }}
                    >
                      {urgentCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-4 py-3"
        style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{
              background: "rgba(0, 122, 255, 0.12)",
              color: "#007AFF",
            }}
          >
            R
          </div>
          <p className="text-[11px] text-zinc-400">Ravi · Design Manager</p>
        </div>
      </div>
    </aside>
  );
}
