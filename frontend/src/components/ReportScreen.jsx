import React from "react";

export default function ReportScreen({ report, role, difficulty, onRestart }) {
  if (!report) return null;

  const {
    final_score = 0,
    strengths = [],
    weaknesses = [],
    seven_day_plan = [],
    verdict = "Needs practice"
  } = report;

  const verdictClass = verdict === "Ready" ? "score-high" : verdict === "Almost ready" ? "score-mid" : "score-low";

  return (
    <div className="glass-card">
      <div className="report-hero">
        <div className="section-kicker">FINAL EVALUATION REPORT</div>
        <div className="final-score-circle">
          <div className="final-score-num">{final_score}</div>
          <div className="final-score-total">out of 100</div>
        </div>

        <div>
          <span className={`verdict-badge ${verdictClass}`}>
            Verdict: {verdict}
          </span>
        </div>

        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.9rem", fontWeight: 400, marginBottom: "8px" }}>
          Performance Summary
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Track: <strong>{role}</strong> ({difficulty} level) • 5 Fresher Questions Completed
        </p>
      </div>

      <div className="feedback-grid" style={{ marginBottom: "28px" }}>
        <div className="feedback-col good" style={{ padding: "18px" }}>
          <h5 style={{ fontSize: "0.85rem" }}>Key Strengths</h5>
          <ul style={{ listStyle: "disc", paddingLeft: "18px", fontSize: "0.88rem", marginTop: "8px", lineHeight: "1.6" }}>
            {strengths.map((str, idx) => (
              <li key={idx} style={{ marginBottom: "6px" }}>{str}</li>
            ))}
          </ul>
        </div>

        <div className="feedback-col improve" style={{ padding: "18px" }}>
          <h5 style={{ fontSize: "0.85rem" }}>Areas for Improvement</h5>
          <ul style={{ listStyle: "disc", paddingLeft: "18px", fontSize: "0.88rem", marginTop: "8px", lineHeight: "1.6" }}>
            {weaknesses.map((weak, idx) => (
              <li key={idx} style={{ marginBottom: "6px" }}>{weak}</li>
            ))}
          </ul>
        </div>
      </div>

      {seven_day_plan && seven_day_plan.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <div className="section-kicker">PERSONALIZED ACTION PLAN</div>
          <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", fontWeight: 400, marginBottom: "12px" }}>
            7-Day Fresher Improvement Roadmap
          </h3>
          <ul className="plan-list">
            {seven_day_plan.map((item, idx) => (
              <li key={idx} className="plan-item">
                <strong>{item.split(":")[0] || `Day ${idx + 1}`}:</strong> {item.includes(":") ? item.substring(item.indexOf(":") + 1).trim() : item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRestart}
          style={{ padding: "14px 32px", fontSize: "1rem" }}
        >
          Practice Another Round ↺
        </button>
      </div>
    </div>
  );
}
