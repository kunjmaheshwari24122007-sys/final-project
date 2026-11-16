import React from "react";

export default function LandingScreen({ role, setRole, difficulty, setDifficulty, onStart, isLoading }) {
  const roles = [
    "Web Developer",
    "Data Analyst",
    "AI/ML Engineer",
    "Software Tester",
    "HR / Non-tech"
  ];

  const difficulties = [
    "Beginner",
    "Intermediate"
  ];

  return (
    <div className="glass-card">
      <div className="section-kicker">PERSONALIZED SETUP</div>
      <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "2.1rem", fontWeight: 400, marginBottom: "8px" }}>
        AI Interview Coach
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", marginBottom: "28px" }}>
        Tailored practice for first-year B.Tech engineering students in India. Real-time feedback, honest evaluation, and actionable advice to boost your placement and internship readiness.
      </p>

      <form onSubmit={(e) => { e.preventDefault(); onStart(); }}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="roleSelect">Target Role / Track</label>
            <select
              id="roleSelect"
              className="form-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="diffSelect">Difficulty Level</label>
            <select
              id="diffSelect"
              className="form-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {difficulties.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ background: "var(--bg-surface-alt)", padding: "16px", borderRadius: "var(--radius-sm)", marginBottom: "24px", border: "1px solid var(--border-card)" }}>
          <h4 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: "4px" }}>Round Format (5 Questions):</h4>
          <ul style={{ fontSize: "0.85rem", color: "var(--text-secondary)", paddingLeft: "18px", lineHeight: "1.7" }}>
            <li><strong>Q1:</strong> Tell me about yourself (fresher self-introduction)</li>
            <li><strong>Q2–Q4:</strong> Technical fundamentals & core computer science basics</li>
            <li><strong>Q5:</strong> Situational & teamwork scenario (college project/lab)</li>
          </ul>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ minWidth: "180px" }}>
            {isLoading ? (
              <>
                <div className="spinner" />
                <span>Preparing Interview...</span>
              </>
            ) : (
              <span>Start Interview Session</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
