# tauri-admin: Written child-question editing + per-child model answers + force-push on merge failure

**Date:** 2026-06-14
**Status:** Approved (design phase)
**Scope:** `tauri-admin/` (frontend + Rust), `scripts/pdf_generator.py`
**Out of scope:** `written-engine.js` runtime (already correct), schema/marker changes, UID stability, sw.js stabilization.

---

## 1. Problem statement

Three independent issues in `tauri-admin` and the PDF pipeline:

1. **Child questions are silently dropped by the admin structured editor.** When a written file with `children` is opened, edited, and saved through the dashboard's structured editor, `syncQuizBankEditor` reads only `question / modelAnswer / rubric / explanation / tags` and emits a question object **without** `children`. The next save destroys the child data. The new-file wizard also has no UI to author children.

2. **Per-child model answers are lost in PDF export.** `scripts/pdf_generator.py::build_written_question` renders children inline as text, then emits a single combined `MODEL ANSWER` callout sourced from the parent's `modelAnswer`. When each child has its own `modelAnswer`, those per-child answers never appear in the PDF.

3. **Git Sync breaks the repo on sw.js divergence.** `gitSync()` runs `pull --rebase --autostash` → `add -A` → `commit` → `push`. The sync step regenerates `sw.js` locally (timestamps/version hashes), so when the remote has a different `sw.js`, the rebase fails mid-way and the local repo is left in a broken merge state with no escape hatch in the UI.

## 2. Current state (verified)

| Layer | Today | Gap |
|---|---|---|
| `written-engine.js` runtime | Full per-child `modelAnswer/rubric/explanation`, per-child AI + manual grading, result view shows per-child model answers (`renderChildFeedback` line 2036, result-list line 2280, engine-PDF line 2521). | None |
| `written-template.html` | Format documented in comments; sample `wq-2` has per-child `modelAnswer`. | None |
| `tauri-admin` parser (`parser.rs`) + `templates.rs` | Children pass through transparently (`parse_literal` returns full structure; `create_written_html` pretty-prints whatever it's given). | None |
| `tauri-admin` frontend editor (`renderQuestionCard` + `syncQuizBankEditor`) | Written branch renders only flat fields; reads only flat fields. | **Data-loss bug (Task #1)** |
| `tauri-admin` new-file wizard (`renderModalQuestionList` + `syncModalQuestionsFromUI` + `addModalQuestion`) | Written branch has no children UI. | Task #1 |
| `scripts/pdf_generator.py` `build_written_question` | Children rendered inline; one combined `MODEL ANSWER` from parent only. | **Task #2** |
| Git push (`gitSync` → pull-rebase → add → commit → push) | No recovery path on rebase/merge failure. | **Task #3** |

## 3. Design decisions (user-confirmed)

- **Task #2 surface:** apply per-child model answer rendering everywhere it's missing — PDF, admin editor, runtime. Runtime is already correct; PDF and admin editor are the real fixes.
- **Task #3 UX:** auto-offer force-push when `gitSync` fails. Use `--force-with-lease` (refuses to overwrite remote commits the local ref hasn't seen). No `--force` "nuclear" option.
- **Task #3 scope:** just add force-push. No sw.js stabilization, no reset-to-remote. Force-push is the escape hatch.

## 4. Task #1 — Admin editor: child-question support

### Goal
Read, edit, add, remove, and reorder children safely. Round-trip children through save with zero data loss.

### Approach — additive nested editor

**`renderQuestionCard` (written branch), `tauri-admin/frontend/index.html` (~line 3218):**
- Keep existing parent fields (Question Prompt, Model Answer, Rubric, Explanation, Tags) unchanged.
- Below the parent fields, render a **"Sub-parts (multi-part question)"** section when `Array.isArray(question.children) && question.children.length > 0`.
  - Each child row contains, in a `child-editor-card` container:
    - A header line: `Part {label-or-index+1}` + mini-actions (Up / Down / Duplicate / Remove).
    - `Label` short text input (e.g. `A)`, `B)`). Placeholder: `A)`.
    - `Question` textarea.
    - `Model Answer` textarea.
    - `Rubric` textarea (optional, collapsed by default to reduce clutter — single "show rubric/explanation" toggle per child, or simply rendered smaller).
    - `Explanation` textarea (optional).
  - Input classes are namespaced to avoid clashing with the parent-field selectors: `wq-child-label`, `wq-child-question`, `wq-child-model-answer`, `wq-child-rubric`, `wq-child-explanation`. Each carries `data-pidx="${index}"` and `data-cidx="${ci}"`.
  - An **"+ Add Part"** button at the bottom of the children section. New child defaults: `{ label: nextLetter(children.length), question: '', modelAnswer: '', rubric: '', explanation: '' }` where `nextLetter(n) => String.fromCharCode(65 + n) + ')'`.
- Below the children section (and below the parent fields when no children exist), a toggle button:
  - When **no** children: **"Convert to multi-part"** → adds a single empty child (`{ label: 'A)', ... }`).
  - When children exist: **"Convert to single question"** → opens a confirm modal ("This removes the sub-parts. The parent question and parent Model Answer are kept. Continue?"). On confirm, deletes `question.children`.

**`syncQuizBankEditor` (written branch), `tauri-admin/frontend/index.html` (~line 3479):**
- After reading the existing flat parent fields, read children from the DOM:
  ```js
  const childRows = Array.from(card.querySelectorAll('.child-editor-card'));
  const children = childRows.map(row => {
    const label = row.querySelector('.wq-child-label')?.value?.trim() || '';
    const question = row.querySelector('.wq-child-question')?.value || '';
    const modelAnswer = row.querySelector('.wq-child-model-answer')?.value || '';
    const rubric = row.querySelector('.wq-child-rubric')?.value || '';
    const explanation = row.querySelector('.wq-child-explanation')?.value || '';
    const child = { label, question, modelAnswer };
    if (rubric) child.rubric = rubric;
    if (explanation) child.explanation = explanation;
    return child;
  });
  const q = { question, modelAnswer, rubric, explanation, tags };
  if (children.length) q.children = children;
  ```
- Children emitted only when non-empty → simple questions stay clean. Parent `modelAnswer` always preserved (engine uses it as fallback when a child has none).

**New functions (window-exposed, mirroring existing question helpers):**
- `addChildPart(qIdx)` — push a new child with auto-letter label, re-render, sync.
- `removeChildPart(qIdx, cIdx)` — splice, re-render, sync.
- `moveChildPart(qIdx, cIdx, delta)` — swap, re-render, sync.
- `duplicateChildPart(qIdx, cIdx)` — insert a copy at `cIdx + 1` with label re-lettered, re-render, sync.
- `convertToMultiPart(qIdx)` / `convertToSingle(qIdx)` — mode toggle (convert-to-single opens confirm modal).

**`addQuestion` (written branch), `tauri-admin/frontend/index.html` (~line 3661):**
- Unchanged — new top-level questions are still flat by default. Children are an opt-in conversion.

**New-file wizard (`renderModalQuestionList` written branch + `syncModalQuestionsFromUI` + `addModalQuestion`), `tauri-admin/frontend/index.html` (~lines 4356, 4390, 4427):**
- Apply the same nested children UI inside the wizard question card. Wizard children inputs use a parallel class namespace `mq-child-*` (to avoid colliding with the editor's `wq-child-*` queries which target a different DOM root).
- `syncModalQuestionsFromUI` (written branch): read children from `mq-child-*` inputs into `q.children`.
- `addModalQuestion`: unchanged default (flat written question). Add `addModalChildPart(qIdx)` / `removeModalChildPart(qIdx, cIdx)` for the wizard.
- JSON/text paste import already preserves children via the parser (`applyWizardImport`) — verify during implementation, no expected change.

### Safety
- Parent `modelAnswer` is never auto-cleared when children are added (engine uses it as fallback).
- Children array omitted from output when empty — preserves the existing simple-question shape.
- "Convert to single" requires explicit confirmation.
- All re-render paths call `syncQuizBankEditor()` immediately after to keep `state.currentData` consistent (matches existing `moveQuestion` / `duplicateQuestion` pattern).

## 5. Task #2 — Per-child model answer rendering

### (a) `scripts/pdf_generator.py` — `build_written_question` (~line 1215)

Today (lines 1231–1256): children rendered inline as `label. question` paragraphs, then ONE `MODEL ANSWER` callout from `q_data["modelAnswer"]`.

**New logic:**

```
children = q_data.get("children", [])
parent_model = q_data.get("modelAnswer", "") or q_data.get("model_answer", "")
child_has_own_model = [bool(c.get("modelAnswer") or c.get("model_answer")) for c in children]
any_child_has_own = any(child_has_own_model)

for idx, child in enumerate(children):
    # existing: spacer + label + question paragraph
    ...
    # NEW: if this child has its own model answer, emit a per-child callout
    if child_has_own_model[idx]:
        elems.append(Spacer(1, sp(0.5, fs)))
        elems.append(_callout_box(
            f"MODEL ANSWER — {label_text.strip()}",
            child.get("modelAnswer") or child.get("model_answer"),
            content_w, bg=PALE_BLUE, border_color=ROYAL, fs=fs,
        ))

# Parent-level callout: emit only if parent has a model answer AND
# (no children at all, OR no child had its own model answer — i.e. parent is the shared fallback)
if parent_model and (not children or not any_child_has_own):
    elems.append(Spacer(1, sp(1, fs)))
    elems.append(_callout_box("MODEL ANSWER", parent_model, content_w, ...))
```

This mirrors the runtime engine's `hasAllChildModelAnswers` decision (written-engine.js line 966 / 1091). A mixed file (some children with own model answers, parent as fallback for the rest) renders per-child callouts where present and the parent callout only when no child supplied its own — preserving the runtime's "parent is fallback" semantics in print.

### (b) Admin editor
Covered by Task #1 — each child row in `renderQuestionCard` has its own Model Answer textarea.

### (c) Runtime engine
Already correct:
- `renderChildFeedback` line 2036: shows `child.modelAnswer` per child.
- Result list line 2280: shows `child.modelAnswer || q.modelAnswer`.
- Engine PDF (html2pdf) line 2521: shows `child.modelAnswer || q.modelAnswer`.

**No code change.** Verified during implementation; documented here for completeness.

## 6. Task #3 — Force-push on merge failure

### Rust — `tauri-admin/src/git.rs`

Add a new public function alongside `git_push`:

```rust
pub fn git_force_push(project_root: &Path) -> Result<Value, String> {
    if !git_available(project_root) { return Err("Git is not available for this repository.".into()); }
    let (_, branch, _) = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], project_root);
    let branch = branch.trim().to_string();
    if branch.is_empty() { return Err("Could not determine the current branch.".into()); }

    // --force-with-lease refuses to overwrite remote commits the local
    // ref hasn't seen (protects collaborators). No-arg form uses the
    // recorded remote-tracking ref as the lease.
    let (code, out, err) = run_git(&["push", "--force-with-lease", "origin", &branch], project_root);
    if code != 0 {
        let msg = if err.trim().is_empty() { out.trim().to_string() } else { err.trim().to_string() };
        return Err(format!("Git force-push failed: {}", msg));
    }
    Ok(json!({ "message": "Force-push completed successfully.", "branch": branch, "output": out.trim() }))
}
```

`run_git` already sets `CREATE_NO_WINDOW` on Windows (line 19). No token plumbing needed here — `git_push` today relies on the OS credential helper / the remote URL configured by a prior `provider_deploy`; force-push reuses the same path. (If a user has only ever pushed via `provider_deploy`, the remote URL already embeds the token from the last deploy.)

### Rust — `tauri-admin/src/commands.rs`

Add a thin command wrapper next to `git_push` (line 570):

```rust
#[tauri::command]
pub fn git_force_push(state: State<ProjectRoot>) -> Result<Value, String> {
    git::git_force_push(&root(&state))
}
```

### Rust — `tauri-admin/src/main.rs`

Register in the `invoke_handler` list (after `git_push` at line 207):

```rust
commands::git_force_push,
```

### Frontend — `tauri-admin/frontend/index.html`

**(1) Route map (line 1436):** add `'/admin/git-force-push': { cmd: 'git_force_push', method: 'POST' }`.

**(2) `gitSync()` error handling (~line 5265):**

```js
} catch (err) {
  const msg = (err && (err.message || String(err))) || '';
  const isMergeConflict = /merge|conflict|rebase|fetch-first|non-fast-forward|stale/i.test(msg);
  showToast('Git Sync failed. Check activity log.', 'error');
  logActivity('Git Sync error', msg, 'error');
  if (isMergeConflict) openForcePushModal({ reason: msg });
}
```

**(3) New modal + handler:**

```js
function openForcePushModal({ reason = '' } = {}) {
  closeModal();
  openModal({
    title: 'Git Sync Conflict',
    subtitle: 'The local files (including sw.js) diverged from GitHub and the automatic rebase failed.',
    body: `
      <div class="empty-state" style="text-align:left;">
        Force-push overwrites the remote <strong>current branch</strong> with your local version.
        Remote commits not present locally will be lost. Use this when your local copy is the
        source of truth (the typical case after a sync regenerated sw.js locally).
        ${reason ? `<details style="margin-top:0.75rem;"><summary style="cursor:pointer;color:var(--muted);font-size:.82rem;">Show git output</summary><pre style="white-space:pre-wrap;font-size:.78rem;margin-top:0.5rem;">${escapeHtml(reason)}</pre></details>` : ''}
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" style="background:var(--bad);border-color:var(--bad);color:#fff;" onclick="forcePush()">Force Push Local</button>
      </div>
    `,
  });
}
window.openForcePushModal = openForcePushModal;

async function forcePush() {
  try {
    const result = await fetchJson('/admin/git-force-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    showToast(result.message || 'Force-push completed.', 'success');
    logActivity('Git force-push', result.output || result.message || ('branch: ' + (result.branch || '')), 'success');
    await refreshWorkspace({ preserveCurrent: true });
    closeModal();
  } catch (err) {
    showToast('Force-push failed: ' + (err?.message || err), 'error');
    logActivity('Git force-push error', err?.message || String(err), 'error');
  }
}
window.forcePush = forcePush;
```

**(4) Manual button in the existing Git modal** (alongside Sync / Pull / Push, e.g. near line 5215 / wherever the Git modal body is built): a small secondary button **"Force Push…"** that calls `openForcePushModal({})`. This makes force-push reachable outside the auto-failure path, while still funnelling through the same confirm modal.

### Safety
- `--force-with-lease` (not `--force`): refuses if remote advanced past the recorded tracking ref, so a collaborator's commits made after our last fetch are not silently destroyed.
- Always behind an explicit confirm modal — never automatic.
- Scoped to the current branch (`HEAD`), not `--all`.
- No token embedded in URLs by this code path; reuses existing remote configuration.

## 7. Testing & verification

### Task #1 (admin editor)
- Open a written file with children (e.g. `wq-2` from the template) → children appear in the editor with all fields populated.
- Edit a child field → save → re-open → edit preserved. **Children array survives the round trip.**
- Add a child part → label auto-letters (A, B, C…) → save → re-open → child present.
- Remove a child → save → re-open → child gone, others preserved.
- Reorder children (Up/Down) → order persists after save.
- "Convert to multi-part" on a flat question → creates one empty child. "Convert to single" on a multi-part → confirm modal → children removed, parent fields intact.
- New-file wizard: create a written assessment, add a 2-child question, create file → file contains the children. Re-open in editor → children present.
- Paste-JSON import of a written file with children → children preserved into the wizard.

### Task #2 (PDF)
- Generate PDF from a written file where every child has its own `modelAnswer` (e.g. `wq-2`) → each child has its own `MODEL ANSWER — A)`, `MODEL ANSWER — B)` callout. No combined parent callout.
- Generate PDF from a written file with children but no per-child `modelAnswer` (parent `modelAnswer` only) → single combined `MODEL ANSWER` callout (unchanged behavior).
- Generate PDF from a flat written question (no children) → single `MODEL ANSWER` callout (unchanged).
- Mixed file: some children with own model answers, parent has model answer → per-child callouts where present; parent callout suppressed when at least one child has its own (matches runtime fallback semantics — confirm the exact suppression rule during implementation; the rule above is "parent callout only if NO child has its own").

### Task #3 (force-push)
- `cargo build` succeeds after Rust changes; command registered.
- Simulate divergence: commit a different `sw.js` directly to remote (or hand-edit local `sw.js` + commit), then run Git Sync from the dashboard → rebase/pull fails → force-push modal appears → confirm → push succeeds → remote matches local → second Git Sync is clean (pull succeeds, nothing to commit/push).
- Manual button: open Git modal → click "Force Push…" → confirm modal → success.
- `--force-with-lease` safety: if a new remote commit appears after our last fetch, force-push fails with a clear error (lease rejected) instead of clobbering. Verify the error surfaces in the toast/log.

## 8. Files touched

| File | Change |
|---|---|
| `tauri-admin/frontend/index.html` | `renderQuestionCard` written branch (children UI + convert toggle); `syncQuizBankEditor` written branch (read children); new `addChildPart` / `removeChildPart` / `moveChildPart` / `duplicateChildPart` / `convertToMultiPart` / `convertToSingle`; wizard `renderModalQuestionList` + `syncModalQuestionsFromUI` + `addModalChildPart` + `removeModalChildPart`; new `/admin/git-force-push` route; `gitSync` conflict detection; `openForcePushModal` + `forcePush`; manual "Force Push…" button in Git modal. |
| `tauri-admin/src/git.rs` | `git_force_push()`. |
| `tauri-admin/src/commands.rs` | `git_force_push` command wrapper. |
| `tauri-admin/src/main.rs` | Register `git_force_push` in `invoke_handler`. |
| `scripts/pdf_generator.py` | `build_written_question` per-child `MODEL ANSWER` callouts + conditional parent callout. |

## 9. Non-goals / explicitly out of scope

- No changes to `written-engine.js` (runtime already correct).
- No changes to `written-template.html` (format already documented and demonstrated).
- No schema, marker, or UID changes.
- No sw.js stabilization or sync-script changes (user chose "just add force-push").
- No reset-to-remote button (deferred).
- No plain `--force` option (only `--force-with-lease`).
- No Tauri generator (`tauri/`) changes — admin-only.

## 10. Risks

- **Forgetting a sync call after a child mutation** would silently desync the editor state from the DOM. Mitigation: every new helper calls `renderFilePanel()` → `setTab('editor')` → `syncQuizBankEditor()`, matching the existing `moveQuestion` pattern.
- **Wizard input-class collision** if the editor and wizard share class names but target different DOM roots. Mitigation: separate namespaces (`wq-child-*` for editor, `mq-child-*` for wizard), paralleling the existing `wq-*` vs `mq-*` split.
- **PDF parent-callout suppression rule ambiguity** for mixed files. Mitigation: spec states the rule explicitly (parent callout only when NO child has its own); verify against runtime engine behavior during implementation.
- **Force-push clobbering uncollaborated remote work.** Mitigation: `--force-with-lease` + explicit confirm modal.
