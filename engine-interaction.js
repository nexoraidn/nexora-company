const HISTORY_KEY = "nexora_engine_research_history";

function isValidHistoryItem(item) {
  return (
    item &&
    typeof item.input === "string" &&
    typeof item.output === "string" &&
    item.input.trim().length > 0 &&
    item.input.trim().toLowerCase() !== "/research" &&
    item.input.length <= 500 &&
    item.output.length <= 1000 &&
    Number.isFinite(item.timestamp) &&
    item.timestamp >= 1577836800000 &&
    item.timestamp <= Date.now() + 86400000 &&
    !Number.isNaN(new Date(item.timestamp).getTime())
  );
}

function loadHistory() {
  try {
    const history = JSON.parse(
      localStorage.getItem(HISTORY_KEY) || "[]"
    );

    if (!Array.isArray(history)) {
      return [];
    }

    return history
      .filter(isValidHistoryItem)
      .map(item => ({
        input: item.input.slice(0, 500),
        output: item.output.slice(0, 1000),
        timestamp: item.timestamp
      }))
      .slice(-20);
  } catch {
    return [];
  }
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString("id-ID");
}

const NexoraEngine = {
  version: "3.2.4",
  status: "online",
  mode: "research",
  history: loadHistory(),

  getStatus() {
    return {
      version: this.version,
      status: this.status,
      mode: this.mode
    };
  },

  saveHistory() {
    try {
      if (!Array.isArray(this.history)) {
        return false;
      }

      const validHistory = this.history.every(item =>
        item &&
        typeof item === "object" &&
        typeof item.input === "string" &&
        typeof item.output === "string" &&
        typeof item.timestamp === "number" &&
        item.input.trim().length > 0 &&
        item.input.trim().toLowerCase() !== "/research" &&
        item.input.length <= 500 &&
        item.output.length <= 1000 &&
        Number.isFinite(item.timestamp) &&
        item.timestamp >= 1577836800000 &&
        item.timestamp <= Date.now() + 86400000 &&
        !Number.isNaN(new Date(item.timestamp).getTime())
      );

      if (!validHistory) {
        return false;
      }

      const safeHistory = this.history
        .map(item => ({
          input: item.input.slice(0, 500),
          output: item.output.slice(0, 1000),
          timestamp: item.timestamp
        }))
        .slice(-20);

      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(safeHistory)
      );
      return true;
    } catch {
      return false;
    }
  },

  clearHistory() {
    const previousHistory = this.history;

    try {
      localStorage.removeItem(HISTORY_KEY);
      this.history = [];
      return true;
    } catch {
      this.history = previousHistory;
      return false;
    }
  },
  process(input) {
    const command = input.trim().toLowerCase();

    if (!command) {
      return "Enter a research command to begin.";
    }

    if (command === "/status") {
      return `NEXORA Engine v${this.version} — Status: ${this.status} — Mode: ${this.mode}`;
    }

    if (command === "/help") {
      return "Available commands: /status, /help, /clear, /history, /research <topic>";
    }

    if (command === "/research") {
      return "Research mode ready. Use: /research <topic>";
    }

    if (command.startsWith("/research ")) {
      const topic = input.trim().slice(10).trim();

      if (!topic) {
        return "Please enter a research topic.";
      }

      return `Research topic received: "${topic}"`;
    }

    if (command === "/history") {
      if (this.history.length === 0) {
        return "No research history.";
      }

      return this.history.filter(item => Number.isFinite(new Date(item.timestamp).getTime()))
        .map((item, index) =>
          `${index + 1}. ${item.input} → ${item.output} [${formatTimestamp(item.timestamp)}]`
        )
        .join("\n");
    }

    if (command === "/clear") {
      this.clearHistory();
      return "";
    }

    return `Research input received: "${input.trim()}"`;
  },

  execute(input) {
    const MAX_INPUT_LENGTH = 500;

    if (typeof input !== "string") {
      return "Invalid input. Text is required.";
    }

    if (input.length > MAX_INPUT_LENGTH) {
      return `Input too long. Maximum ${MAX_INPUT_LENGTH} characters.`;
    }

    const cleanInput = input.trim();

    if (!cleanInput) {
      return "Enter a research command to begin.";
    }

    const command = cleanInput.toLowerCase();
    const output = this.process(cleanInput);

    const isResearchTopic =
      command.startsWith("/research ") &&
      cleanInput.slice(10).trim().length > 0;

    if (isResearchTopic) {
      const MAX_HISTORY_INPUT = 500;
      const MAX_HISTORY_OUTPUT = 1000;

      this.history.push({
        input: cleanInput.slice(0, MAX_HISTORY_INPUT),
        output: String(output).slice(0, MAX_HISTORY_OUTPUT),
        timestamp: Date.now()
      });

      this.history = this.history
        .filter(isValidHistoryItem)
        .map(item => ({
          input: item.input.slice(0, 500),
          output: item.output.slice(0, 1000),
          timestamp: item.timestamp
        }))
        .slice(-20);

      const historySaved = this.saveHistory();

      if (!historySaved) {
        this.history = this.history.slice(0, -1);
        return "Research history could not be saved.";
      }
    }

    return output;
  }
};
const engineVersion = document.getElementById("engine-version");
const researchInput = document.getElementById("research-input");
const researchSubmit = document.getElementById("research-submit");
const researchHistory = document.getElementById("research-history");
const researchOutput = document.getElementById("research-output");

if (engineVersion) {
  engineVersion.textContent = "v" + NexoraEngine.version;
}

function runResearch() {
  if (!researchInput || !researchOutput) return;

  const input = researchInput.value.trim();

  if (!input) {
    researchOutput.textContent =
      "Enter a research command to begin.";
    researchInput.focus();
    return;
  }

  const isClearCommand = input.toLowerCase() === "/clear";
  const clearSuccess = isClearCommand
    ? NexoraEngine.clearHistory()
    : null;
  const response = isClearCommand
    ? ""
    : NexoraEngine.execute(input);
  const timestamp = new Date().toLocaleString("id-ID");

  researchOutput.textContent = "";

  if (isClearCommand) {
    const message = document.createElement("span");
    message.textContent = clearSuccess
      ? "Research history cleared."
      : "Unable to clear research history.";
    researchOutput.appendChild(message);
  } else {
    const status = document.createElement("div");
    status.textContent = "STATUS: RECEIVED";

    const time = document.createElement("div");
    time.textContent = "TIME: " + timestamp;

    const result = document.createElement("div");
    result.textContent = "RESULT: " + response;

    researchOutput.append(status, time, result);
  }

  researchInput.value = "";
  researchInput.focus();
}

if (researchSubmit) {
  researchSubmit.addEventListener("click", runResearch);
}

if (researchHistory) {
  researchHistory.addEventListener("click", () => {
    if (!researchOutput) return;

    const history = NexoraEngine.history;

    researchOutput.textContent = "";

    if (!history.length) {
      researchOutput.textContent = "No research history available.";
      return;
    }

    history.forEach((item, index) => {
      const entry = document.createElement("div");
      entry.className = "history-entry";

      const number = document.createElement("div");
      number.className = "history-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const content = document.createElement("div");
      content.className = "history-content";

      const input = document.createElement("div");
      input.className = "history-input";
      input.textContent = item.input;

      const output = document.createElement("div");
      output.className = "history-result";
      output.textContent = item.output;

      const time = document.createElement("div");
      time.className = "history-time";
      time.textContent = formatTimestamp(item.timestamp);

      content.append(input, output, time);
      entry.append(number, content);
      researchOutput.appendChild(entry);
    });
  });
}

if (researchInput) {
  researchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runResearch();
    }
  });
}

document.title =
  "NEXORA Engine " + NexoraEngine.version;


