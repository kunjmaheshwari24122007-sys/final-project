import React, { useState } from "react";
import FeedbackCard from "./FeedbackCard.jsx";

export default function InterviewScreen({
  currentQuestionIndex,
  currentQuestion,
  onSubmitAnswer,
  onNextQuestion,
  isSubmitting,
  isLoadingNext,
  latestFeedback
}) {
  const [answerText, setAnswerText] = useState("");
  const totalQuestions = 5;
  const questionNumber = currentQuestionIndex + 1;
  const progressPercent = (questionNumber / totalQuestions) * 100;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answerText.trim() || isSubmitting) return;
    onSubmitAnswer(answerText.trim());
  };

  const handleNext = () => {
    setAnswerText("");
    onNextQuestion();
  };

  const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;

  return (
    <div className="glass-card">
      {/* Progress Bar */}
      <div className="progress-bar-wrapper">
        <div className="progress-info">
          <span className="section-kicker" style={{ marginBottom: 0 }}>
            QUESTION {questionNumber} OF {totalQuestions}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
            {Math.round(progressPercent)}% Completed
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Question Card */}
      <div className="question-box">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--color-rust)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            AI Interviewer Question
          </span>
        </div>
        <h2 className="question-text">
          {currentQuestion || "Loading question..."}
        </h2>
      </div>

      {/* Answer Form */}
      {!latestFeedback ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label className="form-label" htmlFor="answerInput" style={{ marginBottom: 0 }}>
                Your Answer:
              </label>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {wordCount} words
              </span>
            </div>
            <textarea
              id="answerInput"
              className="form-textarea"
              rows={5}
              placeholder="Type your answer here... Be clear, direct, and mention a college project or coursework example if applicable."
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Tip: Aim for 2–4 concise sentences with a direct definition and one simple example.
            </span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !answerText.trim()}
              style={{ minWidth: "150px" }}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <span>Submit Answer</span>
              )}
            </button>
          </div>
        </form>
      ) : (
        <FeedbackCard
          feedback={latestFeedback}
          onNext={handleNext}
          isLastQuestion={questionNumber >= totalQuestions}
          isLoadingNext={isLoadingNext}
        />
      )}
    </div>
  );
}
