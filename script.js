// script.js – DFA Playground core logic
// Author: Antigravity (Senior Frontend Engineer)
// This file implements parsing of DFA definition, building a Vis.js graph,
// and interactive string simulation with step‑by‑step control.

// ------- Global State ------------------------------------------------------
let dfa = {
  states: [], // array of state names
  alphabet: [], // array of symbols
  startState: null,
  acceptStates: new Set(),
  transitions: {} // {state: {symbol: nextState}}
};

let simulation = {
  currentState: null,
  inputString: "",
  index: 0,
  autoRunInterval: null
};

let network = null; // Vis Network instance

// ------- Helper Functions ---------------------------------------------------
/**
 * Trim and split a comma‑separated string into an array of trimmed values.
 */
function csvToArray(str) {
  return str
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Parse the raw transition table entered by the user.
 * Expected line format: "state, symbol -> nextState"
 */
function parseTransitions(raw) {
  const transitions = {};
  const lines = raw.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines) {
    // Using regex to capture parts, tolerant of spaces
    const match = line.match(/^([^,]+)\s*,\s*([^\s]+)\s*->\s*(.+)$/);
    if (!match) {
      throw new Error(`Invalid transition line: "${line}"`);
    }
    const [, from, symbol, to] = match.map(s => s.trim());
    if (!transitions[from]) transitions[from] = {};
    transitions[from][symbol] = to;
  }
  return transitions;
}

/**
 * Refresh the visual graph based on the current dfa definition.
 * Highlights the start state and accept states; the active state is set later.
 */
function buildGraph() {
  const nodes = dfa.states.map(state => {
    const isStart = state === dfa.startState;
    const isAccept = dfa.acceptStates.has(state);
    return {
      id: state,
      label: state,
      shape: "ellipse",
      color: {
        background: isStart ? "#d1e7dd" : "#e2e8f0", // light teal for start, light slate otherwise
        border: isAccept ? "#10b981" : "#6b7280",
        highlight: {
          background: "#f59e0b" // orange for current active highlight (set later)
        }
      },
      borderWidth: isAccept ? 4 : 1,
      font: { color: "#111827" }
    };
  });

  // Create edges – combine multiple symbols between same pair into a single label
  const edgeMap = {};
  for (const [from, trans] of Object.entries(dfa.transitions)) {
    for (const [symbol, to] of Object.entries(trans)) {
      const key = `${from}->${to}`;
      if (!edgeMap[key]) edgeMap[key] = { from, to, labelParts: [] };
      edgeMap[key].labelParts.push(symbol);
    }
  }
  const edges = Object.values(edgeMap).map(e => ({
    from: e.from,
    to: e.to,
    arrows: "to",
    label: e.labelParts.join(", "),
    font: { align: "middle" },
    color: { color: "#374151" }
  }));

  const container = document.getElementById("graph");
  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
  const options = {
    layout: { improvedLayout: true },
    physics: { stabilization: false },
    interaction: { hover: true },
    edges: { smooth: { type: "cubicBezier", roundness: 0.2 } }
  };

  // Destroy previous instance if exists
  if (network) network.destroy();
  network = new vis.Network(container, data, options);

  // Highlight start state initially
  highlightNode(dfa.startState);
}

/**
 * Highlight a node (used for start/active states). Uses Vis.js "selectNodes".
 */
function highlightNode(state) {
  if (!network) return;
  const allIds = dfa.states.map(s => s);
  network.unselectAll();
  network.selectNodes([state]);
}

/**
 * Update the status banner with a message and colour.
 */
function setStatus(message, type = "info") {
  const banner = document.getElementById("statusBanner");
  const colors = {
    info: "bg-blue-100 text-blue-800",
    success: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-800",
    warning: "bg-yellow-100 text-yellow-800"
  };
  banner.className = `mt-4 p-2 text-center font-medium rounded ${colors[type] || colors.info}`;
  banner.textContent = message;
}

/**
 * Reset simulation to the start state.
 */
function resetSimulation() {
  if (simulation.autoRunInterval) {
    clearInterval(simulation.autoRunInterval);
    simulation.autoRunInterval = null;
  }
  simulation.currentState = dfa.startState;
  simulation.index = 0;
  setStatus(`Ready – start state: ${simulation.currentState}`, "info");
  highlightNode(simulation.currentState);
}

/**
 * Process one step of the input string.
 */
function stepSimulation() {
  const str = simulation.inputString;
  if (simulation.index >= str.length) {
    // Already finished – evaluate acceptance
    const accepted = dfa.acceptStates.has(simulation.currentState);
    setStatus(accepted ? "ACCEPTED" : "REJECTED", accepted ? "success" : "error");
    return;
  }
  const symbol = str[simulation.index];
  if (!dfa.alphabet.includes(symbol)) {
    setStatus(`Invalid symbol "${symbol}" at position ${simulation.index + 1}.`, "error");
    return;
  }
  const next = dfa.transitions[simulation.currentState]?.[symbol];
  if (!next) {
    setStatus(`No transition defined for state ${simulation.currentState} on symbol "${symbol}".`, "error");
    return;
  }
  simulation.currentState = next;
  simulation.index++;
  setStatus(`Processed "${symbol}" – now in state ${simulation.currentState}`, "info");
  highlightNode(simulation.currentState);
  // If we've just finished processing the last character, evaluate acceptance
  if (simulation.index === str.length) {
    const accepted = dfa.acceptStates.has(simulation.currentState);
    setStatus(accepted ? "ACCEPTED" : "REJECTED", accepted ? "success" : "error");
  }
}

/**
 * Auto‑run the remaining steps with a 500 ms interval.
 */
function autoRunSimulation() {
  if (simulation.autoRunInterval) return; // already running
  simulation.autoRunInterval = setInterval(() => {
    if (simulation.index >= simulation.inputString.length) {
      clearInterval(simulation.autoRunInterval);
      simulation.autoRunInterval = null;
      return;
    }
    stepSimulation();
  }, 500);
}

/**
 * Populate the configuration fields with the example DFA that accepts strings ending in "10".
 */
function loadExample() {
  document.getElementById("statesInput").value = "q0, q1, q2";
  document.getElementById("alphabetInput").value = "0, 1";
  document.getElementById("startStateInput").value = "q0";
  document.getElementById("acceptStatesInput").value = "q2";
  document.getElementById("transitionsInput").value = `q0, 0 -> q0
q0, 1 -> q1
q1, 0 -> q2
q1, 1 -> q1
q2, 0 -> q0
q2, 1 -> q1`;
}

/**
 * Read user inputs, validate, and populate the global `dfa` object.
 */
function buildDFA() {
  try {
    const states = csvToArray(document.getElementById("statesInput").value);
    const alphabet = csvToArray(document.getElementById("alphabetInput").value);
    const startState = document.getElementById("startStateInput").value.trim();
    const acceptStates = new Set(csvToArray(document.getElementById("acceptStatesInput").value));
    const transitionsRaw = document.getElementById("transitionsInput").value;

    // Basic validation
    if (!states.length) throw new Error("Please specify at least one state.");
    if (!alphabet.length) throw new Error("Alphabet cannot be empty.");
    if (!startState) throw new Error("Start state is required.");
    if (!states.includes(startState)) throw new Error("Start state must be one of the defined states.");
    for (const acc of acceptStates) {
      if (!states.includes(acc)) throw new Error(`Accept state "${acc}" is not a defined state.`);
    }

    const transitions = parseTransitions(transitionsRaw);
    // Ensure every state has a transition defined for every alphabet symbol (DFA completeness)
    for (const s of states) {
      if (!transitions[s]) transitions[s] = {};
      for (const a of alphabet) {
        if (!transitions[s][a]) {
          console.warn(`Missing transition for state ${s} on symbol ${a}; DFA will be incomplete.`);
        }
      }
    }

    // Populate global dfa
    dfa = { states, alphabet, startState, acceptStates, transitions };
    buildGraph();
    resetSimulation();
    setStatus("DFA built successfully.", "info");
  } catch (e) {
    setStatus(e.message, "error");
    console.error(e);
  }
}

/**
 * Initialise event listeners after DOM load.
 */
function init() {
  document.getElementById("loadExampleBtn").addEventListener("click", loadExample);
  document.getElementById("buildGraphBtn").addEventListener("click", buildDFA);
  document.getElementById("resetBtn").addEventListener("click", resetSimulation);
  document.getElementById("stepBtn").addEventListener("click", stepSimulation);
  document.getElementById("autoRunBtn").addEventListener("click", autoRunSimulation);
  document.getElementById("inputString").addEventListener("input", e => {
    simulation.inputString = e.target.value.trim();
    // Reset simulation whenever the string changes
    resetSimulation();
  });
}

window.addEventListener("DOMContentLoaded", init);
