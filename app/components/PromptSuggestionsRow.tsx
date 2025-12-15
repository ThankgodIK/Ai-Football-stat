import PromptSuggestionButton from "./PromptSuggestionButton";
const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "What are the top 5 players in football history?",
    "Who won the 2025FIFA club World Cup?",
    "Show me the statistics for Lionel Messi.",
    "Who holds the record for most goals in a season?",
  ];
  return (
    <div className="promptSuggestionRow">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton
          key={index}
          text={prompt}
          onClick={() => {
            onPromptClick(prompt);
          }}
        />
      ))}
    </div>
  );
};

export default PromptSuggestionsRow;
