const PromptSuggestionButton = ({ text, onClick }) => {
  return (
    <button className="prompt-suggestion-btn" onClick={onClick}>
      {text}
    </button>
  );
};

export default PromptSuggestionButton;
