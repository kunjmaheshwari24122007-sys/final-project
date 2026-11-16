import React, { useState } from "react";
import LandingScreen from "./components/LandingScreen.jsx";
import InterviewScreen from "./components/InterviewScreen.jsx";
import ReportScreen from "./components/ReportScreen.jsx";

export default function App() {
  const [screen, setScreen] = useState("landing"); // "landing" | "interview" | "report"
  const [role, setRole] = useState("Web Developer");
  const [difficulty, setDifficulty] = useState("Beginner");

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [nextQuestionPending, setNextQuestionPending] = useState("");
  const [messages, setMessages] = useState([]);
  const [latestFeedback, setLatestFeedback] = useState(null);
  const [finalReport, setFinalReport] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Start interview: calls /api/interview with empty messages to get Question 1
  const handleStartInterview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          difficulty,
          messages: []
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start interview session.");
      }

      const q1 = data.question || "Tell me about yourself, your educational background, and what sparked your interest in technology?";
      setCurrentQuestion(q1);
      setCurrentQuestionIndex(0);
      setMessages([{ role: "assistant", content: q1 }]);
      setLatestFeedback(null);
      setFinalReport(null);
      setScreen("interview");
    } catch (err) {
      console.error("Start interview error:", err);
      setError(err.message || "Failed to connect to backend server.");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit candidate answer: sends updated messages to backend for evaluation
  const handleSubmitAnswer = async (answerText) => {
    setIsSubmitting(true);
    setError(null);

    const updatedMessages = [
      ...messages,
      { role: "user", content: answerText }
    ];
    setMessages(updatedMessages);

    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          difficulty,
          messages: updatedMessages
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to evaluate your answer.");
      }

      setLatestFeedback({
        score: data.score,
        good: data.good,
        improve: data.improve,
        sample_answer: data.sample_answer,
        filler_words_detected: data.filler_words_detected || []
      });

      if (data.next_question) {
        setNextQuestionPending(data.next_question);
      }

      if (data.final_score !== undefined) {
        setFinalReport({
          final_score: data.final_score,
          strengths: data.strengths || [],
          weaknesses: data.weaknesses || [],
          seven_day_plan: data.seven_day_plan || [],
          verdict: data.verdict || "Needs practice"
        });
      }
    } catch (err) {
      console.error("Submit answer error:", err);
      setError(err.message || "Evaluation request failed. Please check the backend connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance to next question or transition to final report screen
  const handleNextQuestion = () => {
    if (currentQuestionIndex < 4) {
      const nextQ = nextQuestionPending || `Can you explain a technical concept related to ${role}?`;
      setCurrentQuestion(nextQ);
      setCurrentQuestionIndex((prev) => prev + 1);
      setMessages((prev) => [...prev, { role: "assistant", content: nextQ }]);
      setLatestFeedback(null);
      setNextQuestionPending("");
    } else {
      setScreen("report");
    }
  };

  // Restart interview
  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setCurrentQuestion("");
    setNextQuestionPending("");
    setMessages([]);
    setLatestFeedback(null);
    setFinalReport(null);
    setError(null);
    setScreen("landing");
  };

  return (
    <div className="app-container">
      {/* Editorial Header */}
      <header className="app-header">
        <a href="#home" className="brand" onClick={(e) => { e.preventDefault(); handleRestart(); }}>
          <div className="brand-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div className="brand-text">InterviewAce</div>
            <div className="brand-tagline">AI Coach for Freshers</div>
          </div>
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            B.Tech Year 1
          </span>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="error-banner">
          <strong>Notice:</strong> {error}
        </div>
      )}

      {/* View Router */}
      {screen === "landing" && (
        <LandingScreen
          role={role}
          setRole={setRole}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          onStart={handleStartInterview}
          isLoading={isLoading}
        />
      )}

      {screen === "interview" && (
        <InterviewScreen
          currentQuestionIndex={currentQuestionIndex}
          currentQuestion={currentQuestion}
          onSubmitAnswer={handleSubmitAnswer}
          onNextQuestion={handleNextQuestion}
          isSubmitting={isSubmitting}
          isLoadingNext={false}
          latestFeedback={latestFeedback}
        />
      )}

      {screen === "report" && (
        <ReportScreen
          report={finalReport}
          role={role}
          difficulty={difficulty}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}
