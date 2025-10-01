import React from "react"

import styles from "../styles/typing-indicator.module.css"

export const TypingIndicator: React.FC<{ label?: string }> = ({ label = "assistant" }) => {
  return (
    <div className={styles.message}>
      <span className={styles.messageRole}>{label}</span>
      <div className={styles.typingIndicator}>
        <div className={styles.typingDot}></div>
        <div className={styles.typingDot}></div>
        <div className={styles.typingDot}></div>
      </div>
    </div>
  )
}

