export const StatusPanel = ({ title, message, subMessage, isLoading }: any) => (
  <div className="app-container">
    <div className={isLoading ? "loading-state" : "error-state"}>
      <div className={isLoading ? "loading-text" : "error-title"}>{title}</div>
      {message && <div className="error-message">{message}</div>}
      {subMessage && <div className="error-sub-message">{subMessage}</div>}
    </div>
  </div>
);
