export function TypingIndicator() {
  return (
    <div className="typing-indicator" aria-live="polite">
      <span className="typing-dots">
        <span />
        <span />
        <span />
      </span>
      digitando…
    </div>
  )
}
