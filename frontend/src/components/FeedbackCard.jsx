import React from "react";

export default function FeedbackCard({ feedback, onNext, isLastQuestion, isLoadingNext }) {
  if (!feedback) return null;

  const { score = 0, good = "", improve = "", sample_answer = "", filler_words_detected = [] } = feedback;

  const scoreClass = score >= 7 ? "score-high" : score >= 4 ? "score-mid" : "score-low";

  return (
    <div className="feedback-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div className={`score-badge ${scoreClass}`}>
          Score: {score} / 10
        </div>
        {filler_words_detected && filler_words_detected.length > 0 && (
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
            Filler words: {filler_words_detected.join(", ")}
          </span>
        )}
      </div>

      <div className="feedback-grid">
        <div className="feedback-col good">
          <h5>What was good</h5>
          <p style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>{good}</p>
        </div>

        <div className="feedback-col improve">
          <h5>What to improve</h5>
          <p style={{ fontSize: "0.88rem", color: "var(--text-primary)" }}>{improve}</p>
        </div>
      </div>

      {sample_answer && (
        <div style={{ marginTop: "16px", padding: "12px 14px", background: "#FFFFFF", border: "1px solid var(--border-card)", borderRadius: "var(--radius-sm)" }}>
          <h5 style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-rust)", marginBottom: "4px" }}>
            Sample strong answer:
          </h5>
          <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            {sample_answer}
          </p>
        </div>
      )}

      <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn-rust"
          onClick={onNext}
          disabled={isLoadingNext}
          style={{ minWidth: "160px" }}
        >
          {isLoadingNext ? (
            <>
              <div className="spinner" />
              <span>Loading Next...</span>
            </>
          ) : isLastQuestion ? (
            <span>View Final Report →</span>
          ) : (
            <span>Next Question →</span>
          )}
        </button>
      </div>
    </div>
  );
}
