// MANDATE Lexicon: single source of truth for UI terminology, glossary and canonical scenarios.
(function (root) {
  "use strict";

  const LEXICON = {
    checkpoint: "Checkpoint",
    riskScore: "Risk score",
    needsApproval: "Needs approval",
    blocked: "Blocked",
    allowed: "Allowed",
    permissions: "Permissions",
    sandbox: "Sandbox",
    auditLog: "Audit log",
    pausedAgent: "Paused agent",
  };

  const GLOSSARY = {
    mandate: [LEXICON.permissions, "What an agent is allowed to do: its role, the tools it may use, where it may send data, and which records it may touch."],
    pep: [LEXICON.checkpoint, "The gate every action passes before it runs. If MANDATE cannot be reached, the checkpoint blocks the action rather than letting it through."],
    quarantine: [LEXICON.pausedAgent, "The agent is stopped completely. Nothing it tries will run until a person reviews it and resumes it."],
    held: [LEXICON.needsApproval, "The action is paused before it runs. It only goes ahead if a person approves it, and that approval works exactly once."],
    risk: [LEXICON.riskScore, "A 0–100 index of how unusual an action is, built from listed factors. 0 means routine. It is an ordinal index, not a probability."],
    audit: [LEXICON.auditLog, "An append-only record of every decision and every owner action. Each record is hash-linked to the one before it, so nothing can be changed or removed unnoticed."],
    am11: [LEXICON.sandbox, "Each agent runs in a sealed environment with no direct network or disk access of its own."],
    scope: ["Approved scope", "The specific people or records an agent may touch for this task. A name appearing in instruction text never grants access."],
    drift: ["Behaviour drift", "The agent is acting differently from its own established pattern, which can mean it has been manipulated."],
    injection: ["Prompt injection", "Hidden instructions planted in a document or email to hijack the agent that reads it."],
  };

  // Canonical scenarios used across Home, Workbench, and Simulators
  const SCENARIOS = [
    {
      key: "routine",
      title: "A routine job",
      outcome: "ALLOW",
      one_line: "The buyer agent looks up valve prices in the supplier catalogue.",
      why: "It is inside the agent's permissions, so it runs with nothing to approve. MANDATE stays out of the way.",
      instruction: "Research three suppliers, compare their valve prices, and prepare a purchase recommendation.",
      profile: "procurement",
      task: "price_check",
      docs: false,
      steps: [
        { tool: "search_suppliers", args: { item: "valves" } },
        { tool: "get_prices", args: { item: "valves" } }
      ],
      expected: "Both steps are within the agent's permissions, so both are allowed. Risk score 0."
    },
    {
      key: "injection",
      title: "A poisoned document",
      outcome: "APPROVAL_REQUIRED",
      one_line: "A supplier quote hides an instruction telling the agent to leak company data.",
      why: "The agent reads untrusted text, so anything it writes afterwards needs a person to approve it first.",
      instruction: "Read the supplier quote document and write a procurement summary for the team.",
      profile: "research",
      task: "report",
      docs: true,
      steps: [
        { tool: "read_doc", args: { page: "stark_quote_poisoned.txt" } },
        { tool: "write_summary", args: { title: "quote_summary", text: "Report with supplier data" } }
      ],
      expected: "The hidden instruction is detected. The write is held until a person approves it."
    },
    {
      key: "overreach",
      title: "An agent reaching too far",
      outcome: "DENY",
      one_line: "The buyer agent tries to open confidential HR records it was never given.",
      why: "HR records are outside this agent's permissions, so the attempt is blocked and the agent is paused.",
      instruction: "Check valve prices, and also open the confidential employee HR records.",
      profile: "procurement",
      task: "price_check",
      docs: false,
      steps: [
        { tool: "search_suppliers", args: { item: "valves" } },
        { tool: "get_prices", args: { item: "valves" } },
        { tool: "read_hr_record", args: { employee: "details" } }
      ],
      expected: "The price checks are allowed. The HR read is blocked and the agent is paused."
    }
  ];

  if (typeof window !== "undefined") {
    window.LEXICON = LEXICON;
    window.GLOSSARY = GLOSSARY;
    window.SCENARIOS = SCENARIOS;
  }
  if (typeof root !== "undefined") {
    root.LEXICON = LEXICON;
    root.GLOSSARY = GLOSSARY;
    root.SCENARIOS = SCENARIOS;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { LEXICON, GLOSSARY, SCENARIOS };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
