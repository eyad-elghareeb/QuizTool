#!/usr/bin/env python3
"""
Admin dashboard for MU61S8-style static quiz repositories.

The dashboard is a local Flask app that helps manage quiz, bank, and hub pages
without a build step. It intentionally follows the repository rules documented
in AGENTS.md:

- preserve stable UIDs for existing files
- generate new files with path-based UIDs
- create proper index pages that load root engines/assets by depth
- never edit sw.js directly; run the sync script instead

The UI borrows interaction patterns from the standalone QuizTool editors while
keeping the workflow inside one local dashboard.
"""

from __future__ import annotations

import base64
import copy
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
import zipfile
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template_string, request, send_file, send_from_directory


app = Flask(__name__)
app.config["JSON_SORT_KEYS"] = False


SCRIPT_PATH = Path(__file__).resolve()
SCRIPTS_DIR = SCRIPT_PATH.parent
PROJECT_ROOT = SCRIPTS_DIR.parent.resolve()
SYNC_SCRIPT = SCRIPTS_DIR / "sync_quiz_assets.py"
HOST = "127.0.0.1"
PORT = 5500
DEPLOY_DIR = PROJECT_ROOT / ".quiztool"
DEPLOY_METADATA_PATH = DEPLOY_DIR / "deploy.json"

SKIP_DIRS = {".git", ".github", ".quiztool", "__pycache__"}
DEPLOY_SKIP_DIRS = {".git", ".github", ".quiztool", "__pycache__", "_site", "node_modules"}
EDITABLE_SUFFIXES = {".html"}
ASSET_SUFFIXES = {
    ".html",
    ".css",
    ".js",
    ".json",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webmanifest",
    ".ico",
    ".txt",
}
# Built-in tools served as templates
BUILTIN_TOOLS = {
    "pdf-exporter": {
        "label": "PDF Exporter",
        "description": "Export quiz and bank pages to PDF with customizable layouts.",
    },
}


TRACKER_MODAL_HTML = """
<div class="dash-overlay" id="tracker-dashboard">
  <div class="dash-modal">
    <div class="dash-header">
      <h2 id="dash-title-text">Question Tracker</h2>
      <button class="dash-close-btn" onclick="closeTrackerDashboard()">x</button>
    </div>
    <div class="dash-scope-bar" id="dash-scope-bar"></div>
    <div class="dash-summary">
      <div class="dash-stat"><div class="ds-val red" id="dash-total-wrong">0</div><div class="ds-lbl">Wrong</div></div>
      <div class="dash-stat"><div class="ds-val blue" id="dash-total-flagged">0</div><div class="ds-lbl">Flagged</div></div>
      <div class="dash-stat"><div class="ds-val green" id="dash-total-quizzes">0</div><div class="ds-lbl">Quizzes</div></div>
    </div>
    <div class="dash-body" id="dash-body"></div>
    <div class="dash-footer">
      <button class="btn-dash-action" onclick="exportTrackerToPDF()">Export PDF</button>
      <button class="btn-dash-action btn-dash-danger" onclick="confirmClearTrackerData()">Clear All</button>
      <button class="btn-dash-close" onclick="closeTrackerDashboard()">Close</button>
    </div>
  </div>
</div>
"""


DASHBOARD_HTML = r"""
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - {{ project_name }}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface2: #1c2330;
      --surface3: #11161d;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --accent: #f0a500;
      --accent-dim: rgba(240, 165, 0, 0.12);
      --correct: #2ea043;
      --wrong: #da3633;
      --blue: #58a6ff;
      --purple: #d2a8ff;
      --radius: 12px;
      --shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
      --transition: 0.2s ease;
    }
    [data-theme="light"] {
      --bg: #f3f0eb;
      --surface: #ffffff;
      --surface2: #f8f6f1;
      --surface3: #f0ece5;
      --border: #d0ccc5;
      --text: #1c1917;
      --text-muted: #78716c;
      --accent: #c27803;
      --accent-dim: rgba(194, 120, 3, 0.1);
      --correct: #16a34a;
      --wrong: #dc2626;
      --blue: #2563eb;
      --purple: #7c3aed;
      --shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: 'Outfit', sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    button, input, select, textarea {
      font: inherit;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    .shell {
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.95rem 1.4rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 0;
    }
    .brand-mark {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: var(--accent);
      color: #17120a;
      font-weight: 800;
    }
    .brand-copy {
      min-width: 0;
    }
    .brand-title {
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand-subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    .topbar-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .btn, .icon-btn, .filter-btn, .tab-btn, .ghost-btn {
      border: 1px solid var(--border);
      background: var(--surface2);
      color: var(--text);
      transition: transform var(--transition), border-color var(--transition), background var(--transition), color var(--transition), opacity var(--transition);
    }
    .btn, .ghost-btn {
      border-radius: 999px;
      min-height: 42px;
      padding: 0.7rem 1rem;
      cursor: pointer;
      font-weight: 600;
    }
    .btn:hover, .ghost-btn:hover, .icon-btn:hover, .filter-btn:hover, .tab-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .btn-primary {
      background: var(--accent);
      color: #17120a;
      border-color: transparent;
    }
    .btn-primary:hover {
      color: #17120a;
      opacity: 0.92;
    }
    .btn-danger {
      color: var(--wrong);
      border-color: color-mix(in srgb, var(--wrong) 60%, var(--border));
    }
    .btn-danger:hover {
      color: #fff;
      background: var(--wrong);
      border-color: var(--wrong);
    }
    .icon-btn {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1.1rem;
    }
    .page {
      flex: 1;
      width: 100vw;
      max-width: 100%;
      margin: 0;
      padding: 1rem;
      display: grid;
      grid-template-rows: 1fr;
      min-height: 0;
    }
    .panel, .sidebar, .activity {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 0.75rem;
    }
    .stat-card {
      padding: 0.9rem 1rem;
      border-radius: 10px;
      background: var(--surface);
      border: 1px solid var(--border);
    }
    .stat-value {
      font-size: 1.6rem;
      font-weight: 800;
      color: var(--accent);
      line-height: 1;
    }
    .stat-label {
      color: var(--text-muted);
      margin-top: 0.35rem;
      font-size: 0.86rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .main-grid {
      display: grid;
      grid-template-columns: minmax(380px, 24%) minmax(0, 1fr);
      gap: 1.25rem;
      height: 100%;
      min-height: 0;
    }
    .sidebar {
      padding: 1rem;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .sidebar-header h2, .section-title, .panel-title {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
    }
    .sidebar-subtitle, .muted {
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    .search-wrap {
      position: relative;
      margin-bottom: 0.9rem;
    }
    .search-input, .text-input, .select-input, .text-area {
      width: 100%;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface2);
      color: var(--text);
      padding: 0.8rem 0.9rem;
      outline: none;
      transition: border-color var(--transition), background var(--transition);
    }
    .search-input {
      padding-left: 2.7rem;
    }
    .search-wrap svg {
      position: absolute;
      left: 0.95rem;
      top: 50%;
      transform: translateY(-50%);
      opacity: 0.55;
    }
    .search-input:focus, .text-input:focus, .select-input:focus, .text-area:focus {
      border-color: var(--accent);
    }
    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-bottom: 0.9rem;
    }
    .filter-btn {
      border-radius: 999px;
      padding: 0.55rem 0.8rem;
      cursor: pointer;
      font-size: 0.84rem;
      font-weight: 600;
    }
    .filter-btn.active {
      background: var(--accent-dim);
      border-color: var(--accent);
      color: var(--accent);
    }
    .tree-wrap {
      min-height: 0;
      overflow: auto;
      padding-right: 0.2rem;
      border-top: 1px solid var(--border);
      margin-top: 0.1rem;
      padding-top: 0.9rem;
    }
    .file-tree, .file-tree ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .file-tree ul {
      margin-left: 0.95rem;
      padding-left: 0.9rem;
      border-left: 1px solid var(--border);
    }
    .tree-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.55rem 0.7rem;
      border-radius: 10px;
      cursor: pointer;
      transition: background var(--transition), transform var(--transition), color var(--transition);
      margin-bottom: 0.16rem;
    }
    .tree-row:hover {
      background: var(--surface2);
    }
    .tree-row.active {
      background: var(--accent-dim);
      color: var(--accent);
      border: 1px solid color-mix(in srgb, var(--accent) 65%, var(--border));
    }
    .tree-icon {
      width: 20px;
      text-align: center;
      flex: none;
    }
    .tree-copy {
      min-width: 0;
      flex: 1;
    }
    .tree-name {
      font-size: 0.95rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tree-meta {
      color: var(--text-muted);
      font-size: 0.78rem;
      margin-top: 0.12rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tree-row.folder-row {
      padding-right: 0.45rem;
    }
    .tree-row .tree-actions {
      display: flex;
      align-items: center;
      opacity: 0;
      transition: opacity var(--transition);
    }
    .tree-row:hover .tree-actions,
    .tree-row:focus-within .tree-actions {
      opacity: 1;
    }
    .tree-add-btn {
      width: 28px;
      height: 28px;
      min-height: 28px;
      border-radius: 8px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      font-weight: 700;
    }
    .content-stack {
      display: grid;
      gap: 1.1rem;
      height: 100%;
      grid-template-rows: 1fr;
      min-height: 0;
    }
    .panel {
      padding: 1rem;
    }
    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .panel-header-main {
      min-width: 0;
      flex: 1;
      cursor: context-menu;
    }
    .panel-path {
      margin-top: 0.35rem;
      color: var(--text-muted);
      word-break: break-word;
      font-size: 0.92rem;
    }
    .panel-actions {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .panel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.7rem;
      margin-bottom: 1rem;
    }
    .meta-card {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.8rem 0.9rem;
    }
    .meta-label {
      color: var(--text-muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.3rem;
    }
    .meta-value {
      font-weight: 700;
      word-break: break-word;
    }
    .tab-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-bottom: 1rem;
    }
    .tab-btn {
      border-radius: 999px;
      min-height: 38px;
      padding: 0.58rem 1rem;
      cursor: pointer;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--surface2);
      color: var(--text-muted);
      transition: var(--transition);
    }
    .tab-btn.active {
      background: var(--accent-dim);
      border-color: var(--accent);
      color: var(--accent);
    }
    .subpanel {
      display: none;
      animation: fadeIn 0.2s ease;
    }
    .subpanel.active {
      display: block;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .preview-frame {
      width: 100%;
      min-height: 600px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #fff;
    }
    .preview-toolbar,
    .status-strip,
    .validation-strip,
    .wizard-summary,
    .context-menu {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface2);
    }
    .preview-toolbar,
    .status-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
      padding: 0.75rem 0.85rem;
      margin-bottom: 0.9rem;
    }
    .validation-strip {
      padding: 0.8rem 0.9rem;
      margin-bottom: 0.9rem;
    }
    .validation-list {
      display: grid;
      gap: 0.45rem;
      margin-top: 0.55rem;
    }
    .validation-item {
      padding: 0.55rem 0.7rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface3);
      font-size: 0.88rem;
    }
    .validation-item.error {
      border-color: color-mix(in srgb, var(--wrong) 55%, var(--border));
    }
    .validation-item.warning {
      border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: var(--surface3);
      border: 1px solid var(--border);
      font-size: 0.8rem;
      font-weight: 700;
    }
    .editor-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.35rem;
    }
    .editor-toolbar-actions {
      display: flex;
      gap: 0.55rem;
      flex-wrap: wrap;
    }
    .editor-card.collapsed .editor-card-body {
      display: none;
    }
    .editor-summary {
      color: var(--text-muted);
      font-size: 0.85rem;
      margin-top: 0.1rem;
    }
    .editor-grid {
      display: grid;
      gap: 1rem;
    }
    .field-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 0.9rem;
    }
    .field {
      display: grid;
      gap: 0.45rem;
    }
    .field.full {
      grid-column: 1 / -1;
    }
    .field label {
      font-weight: 600;
    }
    .field small {
      color: var(--text-muted);
    }
    .text-area {
      min-height: 110px;
      resize: vertical;
    }
    .text-area.code {
      min-height: 520px;
      font-family: Consolas, "Courier New", monospace;
      font-size: 0.9rem;
      line-height: 1.55;
      white-space: pre;
    }
    .editor-list {
      display: grid;
      gap: 1rem;
      margin-top: 0.5rem;
    }
    .editor-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface2);
      padding: 0.95rem;
      display: grid;
      gap: 0.8rem;
    }
    .editor-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.75rem;
    }
    .editor-card-title {
      font-weight: 800;
      color: var(--accent);
    }
    .mini-actions {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
    }
    .mini-btn {
      border: 1px solid var(--border);
      background: var(--surface3);
      color: var(--text-muted);
      border-radius: 8px;
      padding: 0.45rem 0.65rem;
      cursor: pointer;
    }
    .modal-tab-content {
      display: none;
      animation: fadeIn 0.2s ease;
    }
    .modal-tab-content.active {
      display: block;
    }
    .mini-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
    }
    .mini-btn.delete:hover {
      border-color: var(--wrong);
      color: var(--wrong);
    }
    .option-row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.65rem;
      align-items: center;
      margin-bottom: 0.55rem;
    }
    .option-row input[type="radio"] {
      width: 18px;
      height: 18px;
      accent-color: var(--correct);
      cursor: pointer;
    }
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1rem;
    }
    .overview-card {
      padding: 1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface2);
      display: grid;
      gap: 0.75rem;
    }
    .overview-list, .activity-list {
      display: grid;
      gap: 0.8rem;
    }
    .overview-list a:hover {
      color: var(--accent);
    }
    .overview-item {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
    }
    .overview-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--accent);
      margin-top: 0.45rem;
      flex: none;
    }
    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: var(--surface3);
      border: 1px solid var(--border);
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-muted);
    }
    .status-good { color: var(--correct); }
    .status-warn { color: var(--accent); }
    .status-bad { color: var(--wrong); }
    .status-info { color: var(--blue); }
    .activity {
      padding: 0.7rem 0.8rem;
      max-height: 220px;
      overflow: auto;
    }
    .activity-entry {
      padding: 0.55rem 0.7rem;
      border-radius: 10px;
      background: var(--surface2);
      border: 1px solid var(--border);
    }
    .activity-entry + .activity-entry {
      margin-top: 0.7rem;
    }
    .activity-title {
      font-weight: 700;
      margin-bottom: 0.15rem;
      font-size: 0.9rem;
    }
    .activity-meta {
      color: var(--text-muted);
      font-size: 0.78rem;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.58);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      z-index: 100;
    }
    .modal.open {
      display: flex;
    }
    .modal-card {
      width: min(900px, 100%);
      max-height: min(90vh, 1020px);
      overflow: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: var(--shadow);
      padding: 1.1rem;
    }
    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .modal-header h3 {
      margin: 0;
      font-size: 1.05rem;
    }
    .modal-actions {
      display: flex;
      gap: 0.7rem;
      justify-content: flex-end;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .wizard-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 280px;
      gap: 1rem;
      align-items: start;
    }
    .wizard-summary {
      padding: 0.95rem;
      position: sticky;
      top: 0;
    }
    .wizard-step-title {
      margin-bottom: 0.75rem;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .wizard-preset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.7rem;
    }
    .wizard-preset {
      text-align: left;
      padding: 0.85rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface2);
      cursor: pointer;
    }
    .wizard-preset.active {
      border-color: var(--accent);
      background: var(--accent-dim);
    }
    .context-menu {
      position: fixed;
      z-index: 140;
      min-width: 160px;
      max-width: 320px;
      padding: 0.3rem;
      display: none;
      box-shadow: var(--shadow);
    }
    .context-menu.open {
      display: block;
    }
    .context-menu-title {
      padding: 0.3rem 0.5rem 0.4rem;
      color: var(--text-muted);
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .context-menu button {
      width: 100%;
      text-align: left;
      border: 0;
      background: transparent;
      color: var(--text);
      border-radius: 6px;
      padding: 0.5rem 0.65rem;
      cursor: pointer;
      font-size: 0.88rem;
    }
    .context-menu button:hover {
      background: var(--surface3);
    }
    .context-menu button.danger {
      color: var(--wrong);
    }
    .context-divider {
      height: 1px;
      margin: 0.25rem 0;
      background: var(--border);
    }
    .close-btn {
      border: 1px solid var(--border);
      background: var(--surface2);
      color: var(--text-muted);
      width: 40px;
      height: 40px;
      border-radius: 12px;
      cursor: pointer;
    }
    .toast-stack {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 120;
      display: grid;
      gap: 0.65rem;
      width: min(420px, calc(100vw - 2rem));
    }
    .toast {
      padding: 0.9rem 1rem;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: var(--shadow);
    }
    .toast.info { border-color: color-mix(in srgb, var(--blue) 40%, var(--border)); }
    .toast.success { border-color: color-mix(in srgb, var(--correct) 50%, var(--border)); }
    .toast.warn { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
    .toast.error { border-color: color-mix(in srgb, var(--wrong) 55%, var(--border)); }
    .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.8rem;
      padding: 0.2rem 0.4rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface2);
      font-size: 0.8rem;
      color: var(--text-muted);
      font-weight: 700;
    }
    .empty-state {
      padding: 1.4rem;
      border: 1px dashed var(--border);
      border-radius: 10px;
      color: var(--text-muted);
      text-align: center;
      background: var(--surface2);
    }
    @media (max-width: 1200px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
      .sidebar {
        position: static;
        max-height: none;
      }
    }
    @media (max-width: 900px) {
      .stats-grid, .panel-grid, .field-grid, .overview-grid {
        grid-template-columns: 1fr 1fr;
      }
      .wizard-layout {
        grid-template-columns: 1fr;
      }
      .tree-row .tree-actions {
        opacity: 1;
      }
      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }
      .topbar-actions {
        width: 100%;
        justify-content: flex-start;
      }
    }
    @media (max-width: 640px) {
      .page {
        width: min(100vw - 1rem, 100%);
        margin-top: 0.7rem;
      }
      .stats-grid, .panel-grid, .field-grid, .overview-grid {
        grid-template-columns: 1fr;
      }
      .panel-actions, .modal-actions {
        justify-content: stretch;
      }
      .panel-actions > *, .modal-actions > * {
        width: 100%;
      }
      .preview-frame {
        min-height: 420px;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">MU</div>
        <div class="brand-copy">
          <div class="brand-title">Admin Dashboard</div>
          <div class="brand-subtitle">{{ project_name }} <span id="save-indicator">ready</span></div>
        </div>
      </div>
      <div class="topbar-actions">
        <button class="btn" onclick="openActivityModal()">Activity Log</button>
        <button class="btn" onclick="openDeployModal()">Deploy</button>
        <button class="icon-btn" id="theme-toggle" onclick="toggleTheme()" title="Toggle theme">☀</button>
      </div>
    </div>

    <div class="page">
      <section class="main-grid">
        <aside class="sidebar">
          <div class="sidebar-header">
            <div>
              <h2>Project Files</h2>
              <div class="sidebar-subtitle" id="sidebar-summary">Loading files...</div>
            </div>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <button class="icon-btn" onclick="openCreateModal()" title="Create New...">+</button>
              <button class="icon-btn" onclick="refreshWorkspace()" title="Refresh">↻</button>
            </div>
          </div>

          <div class="search-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
            <input id="file-search" class="search-input" type="text" placeholder="Search by path, title, or UID..." oninput="setSearch(this.value)">
          </div>

          <div class="filter-row" id="filter-row"></div>

          <div class="tree-wrap">
            <div id="file-tree-root"></div>
          </div>
        </aside>

        <div class="content-stack">
          <section class="panel" id="workspace-panel"></section>
        </div>
      </section>
    </div>
  </div>

  <div class="modal" id="modal">
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3 id="modal-title">Action</h3>
          <div class="muted" id="modal-subtitle"></div>
        </div>
        <button class="close-btn" onclick="closeModal()">x</button>
      </div>
      <div id="modal-body"></div>
    </div>
  </div>

  <div class="context-menu" id="context-menu"></div>

  <div class="toast-stack" id="toast-stack"></div>

  <script>
    const state = {
      files: [],
      folders: [],
      projectState: null,
      filter: localStorage.getItem('admin-filter') || 'all',
      search: localStorage.getItem('admin-search') || '',
      openFolders: new Set(JSON.parse(localStorage.getItem('admin-open-folders') || '[""]')),
      currentFile: null,
      currentData: null,
      loadedMeta: null,
      currentTab: 'preview',
      dirty: false,
      activity: [],
      modalOpen: false,
      modalQuestions: [],
      modalTab: 'basic',
      syncState: 'saved',
      syncMessage: 'Workspace ready.',
      validation: null,
      contextMenu: null,
      pendingAction: null,
      quickOpenQuery: '',
      collapsedQuestions: new Set(),
      recentFolders: JSON.parse(localStorage.getItem('admin-recent-folders') || '[]'),
      recentPresets: JSON.parse(localStorage.getItem('admin-recent-presets') || '[]'),
      wizard: null,
    };

    const WIZARD_PRESETS = [
      { key: 'blank', label: 'Blank Quiz', description: 'Start from a clean question set.', type: 'quiz', starterCount: 1, folderHint: '', bankIcon: '🗃️' },
      { key: 'lecture', label: 'Lecture MCQ', description: 'Single lecture practice set.', type: 'quiz', starterCount: 5, defaultDescription: 'Lecture MCQs', bankIcon: '🗃️' },
      { key: 'past-paper', label: 'Past Paper', description: 'Exam-style set for previous years.', type: 'quiz', starterCount: 10, defaultDescription: 'Past paper MCQs', bankIcon: '🗃️' },
      { key: 'quick-review', label: 'Quick Review', description: 'Short revision-focused quiz.', type: 'quiz', starterCount: 3, defaultDescription: 'Quick review questions', bankIcon: '🗃️' },
      { key: 'all-bank', label: 'All Bank', description: 'Large question bank with bank defaults.', type: 'bank', starterCount: 8, defaultDescription: 'All questions in one bank file', bankIcon: '🗃️' },
    ];

    const FILTERS = [
      { key: 'all', label: 'All' },
      { key: 'quiz', label: 'Quiz' },
      { key: 'bank', label: 'Bank' },
      { key: 'index', label: 'Index' },
      { key: 'html', label: 'Other HTML' },
    ];

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function clone(obj) {
      return JSON.parse(JSON.stringify(obj));
    }

    function saveUiPrefs() {
      localStorage.setItem('admin-filter', state.filter);
      localStorage.setItem('admin-search', state.search);
      localStorage.setItem('admin-open-folders', JSON.stringify(Array.from(state.openFolders)));
      localStorage.setItem('admin-recent-folders', JSON.stringify(state.recentFolders.slice(0, 8)));
      localStorage.setItem('admin-recent-presets', JSON.stringify(state.recentPresets.slice(0, 8)));
      if (state.currentFile) localStorage.setItem('admin-last-file', state.currentFile);
    }

    function rememberRecent(listName, value) {
      if (!value) return;
      const list = state[listName] || [];
      const next = [value, ...list.filter(item => item !== value)].slice(0, 8);
      state[listName] = next;
      saveUiPrefs();
    }

    function encodePath(path) {
      return String(path).split('/').map(encodeURIComponent).join('/');
    }

    function badgeClassForTone(tone) {
      if (tone === 'success') return 'status-good';
      if (tone === 'warn') return 'status-warn';
      if (tone === 'error') return 'status-bad';
      return 'status-info';
    }

    function nowTime() {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function setDirty(dirty) {
      state.dirty = !!dirty;
      const indicator = document.getElementById('save-indicator');
      if (indicator) indicator.textContent = state.dirty ? 'unsaved changes' : (state.syncState === 'needs-sync' ? 'saved, sync recommended' : 'ready');
      renderStatusStrip();
    }

    function setSyncState(syncState, message = '') {
      state.syncState = syncState;
      state.syncMessage = message || state.syncMessage;
      const indicator = document.getElementById('save-indicator');
      if (indicator) {
        if (state.dirty) indicator.textContent = 'unsaved changes';
        else if (syncState === 'needs-sync') indicator.textContent = 'saved, sync recommended';
        else if (syncState === 'syncing') indicator.textContent = 'syncing';
        else if (syncState === 'sync-failed') indicator.textContent = 'sync failed';
        else indicator.textContent = 'ready';
      }
      renderStatusStrip();
    }

    function showToast(message, tone = 'info') {
      const stack = document.getElementById('toast-stack');
      const toast = document.createElement('div');
      toast.className = `toast ${tone}`;
      toast.textContent = message;
      stack.prepend(toast);
      window.setTimeout(() => toast.remove(), 3600);
    }

    function logActivity(title, detail = '', tone = 'info') {
      state.activity.unshift({ title, detail, tone, time: nowTime() });
      state.activity = state.activity.slice(0, 30);
      renderActivity();
    }

    function toggleTheme() {
      const root = document.documentElement;
      const current = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      const next = current === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      localStorage.setItem('admin-theme', next);
      syncThemeButton();
    }

    function syncThemeButton() {
      const btn = document.getElementById('theme-toggle');
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      if (btn) btn.textContent = current === 'light' ? '🌙' : '☀';
    }

    function restoreTheme() {
      const saved = localStorage.getItem('admin-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', saved);
      syncThemeButton();
    }

    function slugifyClient(value, fallback = 'untitled') {
      const slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
      return slug || fallback;
    }

    function snakeifyClient(value, fallback = 'item') {
      const slug = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
      return slug || fallback;
    }

    function buildDerivedUid(folder, stem) {
      const parts = [];
      if (folder && folder !== '.') parts.push(...String(folder).split('/').filter(Boolean));
      parts.push(stem);
      return snakeifyClient(parts.join('_'), 'quiz_file');
    }

    function defaultQuestion() {
      return { question: '', options: ['', '', '', ''], correct: 0, explanation: '' };
    }

    function parseImportedQuestions(raw) {
      const text = String(raw || '').trim();
      if (!text) return { questions: [], issues: [] };
      try {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.QUESTION_BANK || parsed.QUESTIONS || []);
        if (Array.isArray(list)) {
          return {
            questions: list.map(item => ({
              question: item.question || '',
              options: Array.isArray(item.options) ? item.options : ['', '', '', ''],
              correct: Number.isInteger(item.correct) ? item.correct : Number(item.correct || 0),
              explanation: item.explanation || '',
            })),
            issues: [],
          };
        }
      } catch (error) {
      }

      const blockMatch = text.match(/const\s+(?:QUESTION_BANK|QUESTIONS)\s*=\s*(\[[\s\S]*\]);?/);
      if (blockMatch) {
        return parseImportedQuestions(blockMatch[1]);
      }

      const issues = [];
      const questions = text
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean)
        .map((block, index) => {
          const lines = block.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          const questionLine = lines.shift() || '';
          const options = [];
          let correct = 0;
          let explanation = '';
          lines.forEach(line => {
            if (/^(answer|correct)\s*:/i.test(line)) {
              const answerRaw = line.split(':').slice(1).join(':').trim();
              const answerLetter = answerRaw.charAt(0).toUpperCase();
              const fromLetter = answerLetter ? answerLetter.charCodeAt(0) - 65 : Number(answerRaw) - 1;
              if (!Number.isNaN(fromLetter) && fromLetter >= 0) correct = fromLetter;
              return;
            }
            if (/^explanation\s*:/i.test(line)) {
              explanation = line.split(':').slice(1).join(':').trim();
              return;
            }
            const optionMatch = line.match(/^(?:[-*]|\(?[A-Ha-h1-8]\)?[.)-])\s*(.+)$/);
            if (optionMatch) {
              options.push(optionMatch[1].trim());
            }
          });
          if (!questionLine || options.length < 2) {
            issues.push(`Block ${index + 1} could not be parsed into a full MCQ.`);
          }
          return {
            question: questionLine.replace(/^\d+[\).:-]\s*/, ''),
            options: options.length ? options : ['', '', '', ''],
            correct,
            explanation,
          };
        });
      return { questions: questions.filter(item => item.question || item.options.some(Boolean)), issues };
    }

    function validateQuestionListClient(questions) {
      const issues = [];
      if (!Array.isArray(questions) || !questions.length) {
        issues.push({ level: 'warning', message: 'No questions yet.', field: 'questions' });
        return issues;
      }
      questions.forEach((question, index) => {
        const prompt = String(question.question || '').trim();
        const options = Array.isArray(question.options) ? question.options.map(option => String(option || '').trim()) : [];
        const correct = Number(question.correct || 0);
        if (!prompt) issues.push({ level: 'error', message: `Question ${index + 1} is missing its prompt.`, field: `questions.${index}.question` });
        if (options.length < 2) issues.push({ level: 'error', message: `Question ${index + 1} needs at least 2 options.`, field: `questions.${index}.options` });
        if (options.length >= 2 && options.some(option => !option)) issues.push({ level: 'warning', message: `Question ${index + 1} has a blank option.`, field: `questions.${index}.options` });
        if (correct < 0 || correct >= options.length) issues.push({ level: 'error', message: `Question ${index + 1} has an invalid correct answer.`, field: `questions.${index}.correct` });
      });
      return issues;
    }

    function renderValidationIssues(issues, { empty = 'No validation issues right now.' } = {}) {
      if (!issues?.length) return `<div class="muted">${escapeHtml(empty)}</div>`;
      return `<div class="validation-list">${issues.map(issue => `
        <div class="validation-item ${escapeHtml(issue.level || 'warning')}">
          <strong>${escapeHtml((issue.level || 'warning').toUpperCase())}</strong> ${escapeHtml(issue.message || '')}
        </div>
      `).join('')}</div>`;
    }

    async function fetchJson(url, options = {}) {
      const response = await fetch(url, options);
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        payload = { message: 'Invalid server response' };
      }
      if (!response.ok) {
        const error = new Error(payload.message || payload.error || 'Request failed');
        error.payload = payload;
        throw error;
      }
      return payload;
    }

    async function refreshWorkspace({ preserveCurrent = true } = {}) {
      const [filePayload, projectState] = await Promise.all([
        fetchJson(`/admin/files?t=${Date.now()}`),
        fetchJson(`/admin/project-state?t=${Date.now()}`),
      ]);
      state.files = filePayload.files || [];
      state.folders = filePayload.folders || [];
      state.projectState = projectState;
      const search = document.getElementById('file-search');
      if (search && search.value !== state.search) search.value = state.search;
      renderFilters();
      renderTree();
      if (preserveCurrent && state.currentFile) {
        const stillExists = state.files.some(file => file.path === state.currentFile);
        if (!stillExists) {
          state.currentFile = null;
          state.currentData = null;
          state.loadedMeta = null;
          setDirty(false);
        }
      }
      if (!state.currentFile) {
        renderOverview();
      } else {
        const active = state.files.find(file => file.path === state.currentFile);
        if (active) {
          await loadFile(active.path, { silent: true, keepTab: true, forceRefresh: true });
        } else {
          renderOverview();
        }
      }
      const dirtyCount = projectState?.git?.dirtyCount || 0;
      logActivity('Workspace refreshed', dirtyCount ? `${dirtyCount} git changes detected.` : 'Working tree is clean.', 'info');
    }

    function renderFilters() {
      const row = document.getElementById('filter-row');
      row.innerHTML = FILTERS.map(filter => `
        <button class="filter-btn ${state.filter === filter.key ? 'active' : ''}" onclick="setFilter('${filter.key}')">
          ${escapeHtml(filter.label)}
        </button>
      `).join('');
    }

    function setFilter(filter) {
      state.filter = filter;
      saveUiPrefs();
      renderFilters();
      renderTree();
    }

    function setSearch(value) {
      state.search = String(value || '').toLowerCase();
      saveUiPrefs();
      renderTree();
    }

    function getFilteredFiles() {
      return state.files.filter(file => {
        const matchesType = state.filter === 'all' ? true : file.type === state.filter;
        if (!matchesType) return false;
        if (!state.search) return true;
        const haystack = [
          file.path,
          file.title || '',
          file.uid || '',
          file.description || '',
        ].join(' ').toLowerCase();
        return haystack.includes(state.search);
      });
    }

    function buildTreeFromFiles(files) {
      const root = {};
      for (const file of files) {
        const parts = file.path.split('/');
        let cursor = root;
        let running = '';
        for (let i = 0; i < parts.length - 1; i += 1) {
          const part = parts[i];
          running = running ? `${running}/${part}` : part;
          if (!cursor[part]) {
            cursor[part] = { kind: 'folder', path: running, children: {} };
          }
          cursor = cursor[part].children;
        }
        cursor[parts[parts.length - 1]] = { kind: 'file', record: file };
      }
      return root;
    }

    function sortTreeEntries(entries) {
      return Object.entries(entries).sort((a, b) => {
        const aFolder = a[1].kind === 'folder';
        const bFolder = b[1].kind === 'folder';
        if (aFolder !== bFolder) return aFolder ? -1 : 1;
        return a[0].localeCompare(b[0]);
      });
    }

    function renderTree() {
      const filtered = getFilteredFiles();
      const treeRoot = document.getElementById('file-tree-root');
      const tree = buildTreeFromFiles(filtered);
      const summary = document.getElementById('sidebar-summary');
      summary.textContent = `${filtered.length} visible files across ${state.folders.length} folders`;
      if (!filtered.length) {
        treeRoot.innerHTML = `<div class="empty-state">No files match the current search or filter.</div>`;
        return;
      }
      treeRoot.innerHTML = renderTreeLevel(tree, '');
    }

    function renderTreeLevel(node, parentPath) {
      const items = sortTreeEntries(node).map(([name, item]) => {
        if (item.kind === 'folder') {
          const open = state.search ? true : state.openFolders.has(item.path);
          return `
            <li>
              <div class="tree-row folder-row" onclick="toggleFolder('${escapeHtml(item.path)}')" oncontextmenu="openFolderContextMenu(event, '${escapeHtml(item.path)}')">
                <div class="tree-icon">${open ? '📂' : '📁'}</div>
                <div class="tree-copy">
                  <div class="tree-name">${escapeHtml(name)}</div>
                  <div class="tree-meta">${escapeHtml(item.path || 'root')}</div>
                </div>
                <div class="tree-actions">
                  <button class="mini-btn tree-add-btn" onclick="openFolderQuickAdd(event, '${escapeHtml(item.path)}')" title="Add here">+</button>
                </div>
              </div>
              <ul style="display:${open ? 'block' : 'none'}">${renderTreeLevel(item.children, item.path)}</ul>
            </li>
          `;
        }
        const file = item.record;
        const active = state.currentFile === file.path ? 'active' : '';
        const subMeta = [file.type, file.uid || file.title || ''].filter(Boolean).join(' • ');
        return `
          <li>
            <div class="tree-row ${active}" onclick="requestLoadFile('${escapeHtml(file.path)}')" oncontextmenu="openFileContextMenu(event, '${escapeHtml(file.path)}')">
              <div class="tree-icon">${escapeHtml(file.icon || '📄')}</div>
              <div class="tree-copy">
                <div class="tree-name">${escapeHtml(file.name)}</div>
                <div class="tree-meta">${escapeHtml(subMeta)}</div>
              </div>
            </div>
          </li>
        `;
      });
      return `<ul class="file-tree">${items.join('')}</ul>`;
    }

    function toggleFolder(path) {
      if (state.openFolders.has(path)) state.openFolders.delete(path);
      else state.openFolders.add(path);
      saveUiPrefs();
      renderTree();
    }

    function copyTextValue(value, label = 'Value') {
      navigator.clipboard.writeText(String(value || '')).then(() => {
        showToast(`${label} copied.`, 'success');
      }).catch(() => {
        showToast(`Could not copy ${label.toLowerCase()}.`, 'warn');
      });
    }

    function closeContextMenu() {
      state.contextMenu = null;
      const menu = document.getElementById('context-menu');
      if (menu) {
        menu.classList.remove('open');
        menu.innerHTML = '';
      }
    }

    function openContextMenu(event, title, actions) {
      event.preventDefault();
      event.stopPropagation();
      const menu = document.getElementById('context-menu');
      if (!menu) return;
      const validActions = (actions || []).filter(Boolean);
      menu.innerHTML = `
        <div class="context-menu-title">${escapeHtml(title)}</div>
        ${validActions.map(action => action.divider ? '<div class="context-divider"></div>' : `
          <button class="${action.danger ? 'danger' : ''}" onclick="${action.onclick}">
            ${escapeHtml(action.label)}
          </button>
        `).join('')}
      `;
      const x = Math.min(event.clientX, window.innerWidth - 260);
      const y = Math.min(event.clientY, window.innerHeight - 320);
      menu.style.left = `${Math.max(10, x)}px`;
      menu.style.top = `${Math.max(10, y)}px`;
      menu.classList.add('open');
      state.contextMenu = { title };
    }

    function openFolderQuickAdd(event, folderPath) {
      event.stopPropagation();
      openContextMenu(event, folderPath === '.' ? 'Root actions' : `${folderPath} actions`, [
        { label: 'New Quiz Here', onclick: `closeContextMenu(); openNewFileWizard({ folder: '${escapeHtml(folderPath)}', type: 'quiz' })` },
        { label: 'New Bank Here', onclick: `closeContextMenu(); openNewFileWizard({ folder: '${escapeHtml(folderPath)}', type: 'bank' })` },
        { label: 'New Folder Here', onclick: `closeContextMenu(); openNewFolderModal('${escapeHtml(folderPath)}')` },
        state.currentFile ? { label: 'Duplicate Active File Here', onclick: `closeContextMenu(); openDuplicateModal('${escapeHtml(folderPath)}')` } : null,
      ]);
    }

    function openFolderContextMenu(event, folderPath) {
      const isOpen = state.search ? true : state.openFolders.has(folderPath);
      openContextMenu(event, folderPath === '.' ? 'Root folder' : folderPath, [
        { label: 'New Quiz Here', onclick: `closeContextMenu(); openNewFileWizard({ folder: '${escapeHtml(folderPath)}', type: 'quiz' })` },
        { label: 'New Bank Here', onclick: `closeContextMenu(); openNewFileWizard({ folder: '${escapeHtml(folderPath)}', type: 'bank' })` },
        { label: 'New Folder Here', onclick: `closeContextMenu(); openNewFolderModal('${escapeHtml(folderPath)}')` },
        state.currentFile ? { label: 'Duplicate Active File Here', onclick: `closeContextMenu(); openDuplicateModal('${escapeHtml(folderPath)}')` } : null,
        { divider: true },
        { label: isOpen ? 'Collapse Folder' : 'Expand Folder', onclick: `closeContextMenu(); toggleFolder('${escapeHtml(folderPath)}')` },
        { label: 'Copy Folder Path', onclick: `closeContextMenu(); copyTextValue('${escapeHtml(folderPath)}', 'Folder path')` },
        folderPath !== '.' ? { label: 'Delete Folder', danger: true, onclick: `closeContextMenu(); deleteFolderConfirm('${escapeHtml(folderPath)}')` } : null,
      ]);
    }

    function deleteFolderConfirm(folderPath) {
      const fileCount = state.files.filter(f => f.path.startsWith(folderPath + '/') || (folderPath === '.' ? false : false)).length;
      const cnt = state.files.filter(f => folderPath === '.' ? false : f.path.startsWith(folderPath + '/')).length;
      openModal({
        title: 'Delete Folder',
        subtitle: 'This permanently deletes the folder and all its contents.',
        body: `
          <div class="empty-state" style="text-align:left;">
            <strong>${escapeHtml(folderPath)}</strong><br><br>
            This folder contains <strong>${cnt}</strong> file(s).<br>
            Deleting is irreversible. Run sync afterward to refresh indexes.
          </div>
          <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-danger" onclick="closeModal(); executeDeleteFolder('${escapeHtml(folderPath)}')">Yes, Delete Folder</button>
          </div>
        `,
      });
    }

    function openFileContextMenu(event, filePath) {
      const file = state.files.find(item => item.path === filePath);
      openContextMenu(event, file?.title || filePath, [
        { label: 'Open', onclick: `closeContextMenu(); requestLoadFile('${escapeHtml(filePath)}')` },
        { label: 'Preview', onclick: `closeContextMenu(); requestLoadFile('${escapeHtml(filePath)}', { tab: 'preview' })` },
        { label: 'Open Parent Folder', onclick: `closeContextMenu(); expandFolderForFile('${escapeHtml(filePath)}')` },
        { divider: true },
        { label: 'Duplicate', onclick: `closeContextMenu(); openDuplicateModal('', '${escapeHtml(filePath)}')` },
        { label: 'Move/Rename', onclick: `closeContextMenu(); requestLoadFile('${escapeHtml(filePath)}', { afterLoadAction: 'openMoveModal' })` },
        (file?.type === 'quiz' || file?.type === 'bank') ? { label: 'Convert Quiz/Bank', onclick: `closeContextMenu(); requestLoadFile('${escapeHtml(filePath)}', { afterLoadAction: 'convertFile' })` } : null,
        { divider: true },
        { label: 'Copy Path', onclick: `closeContextMenu(); copyTextValue('${escapeHtml(filePath)}', 'Path')` },
        { label: 'Delete', danger: true, onclick: `closeContextMenu(); requestLoadFile('${escapeHtml(filePath)}', { afterLoadAction: 'openDeleteModal' })` },
      ]);
    }

    function openActiveFileContextMenu(event) {
      if (!state.currentFile) return;
      openFileContextMenu(event, state.currentFile);
    }

    function expandFolderForFile(filePath) {
      const folder = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '.';
      if (folder && folder !== '.') {
        let current = '';
        folder.split('/').forEach(part => {
          current = current ? `${current}/${part}` : part;
          state.openFolders.add(current);
        });
      }
      saveUiPrefs();
      renderTree();
    }

    function renderActivity() {
      const modalActive = state.modalOpen && state.modalTab === 'activity';
      if (!modalActive) return;
      const body = document.getElementById('activity-modal-body');
      if (!body) return;

      const items = state.activity.length ? state.activity.map(item => `
        <div class="activity-entry" style="margin-bottom: 0.8rem; border-bottom: 1px solid var(--border); padding-bottom: 0.8rem;">
          <div class="activity-title ${badgeClassForTone(item.tone)}" style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(item.title)}</div>
          <div class="activity-meta" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem; white-space: pre-wrap;">${escapeHtml(item.time)}${item.detail ? '\n' + escapeHtml(item.detail) : ''}</div>
        </div>
      `).join('') : `<div class="empty-state">No activity yet. Actions, sync output, and git feedback will appear here.</div>`;
      body.innerHTML = items;
    }

    function openActivityModal() {
      state.modalTab = 'activity';
      openModal({
        title: 'Recent Activity',
        subtitle: 'Latest project actions and system feedback.',
        body: '<div id="activity-modal-body" class="activity-list" style="max-height: 500px; overflow-y: auto;"></div>',
        onOpen: () => renderActivity()
      });
    }

    function gitStatusSummary(git) {
      if (!git?.available) return 'Git repository not detected.';
      const branch = git.branch || 'unknown';
      if (!git.dirtyCount) return `Branch ${branch} is clean.`;
      return `${git.dirtyCount} changed path(s) on branch ${branch}.`;
    }

    function renderOverview() {
      const panel = document.getElementById('workspace-panel');
      const summary = state.projectState?.summary || {};
      const git = state.projectState?.git || {};
      const recentFiles = [...state.files].sort((a, b) => (b.modified || 0) - (a.modified || 0)).slice(0, 6);
      panel.innerHTML = `
        <div class="panel-header">
          <div>
            <div class="panel-title">Workspace Overview</div>
            <div class="muted">Project status, recent files, and helper tools.</div>
          </div>
          <div class="badge-row">
            <div class="badge ${badgeClassForTone(git.dirtyCount ? 'warn' : 'success')}">${escapeHtml(gitStatusSummary(git))}</div>
            <div class="badge">${escapeHtml(summary.folderCount || 0)} folders</div>
            <div class="badge">${escapeHtml(summary.totalQuestions || 0)} parsed questions</div>
          </div>
        </div>
        <div class="overview-grid">
          <div class="overview-card">
            <div class="section-title">Repository Rules</div>
            <div class="overview-list">
              <div class="overview-item"><div class="overview-dot"></div><div><strong>Never rename deployed UIDs.</strong><div class="muted">New file creation follows folder and filename path patterns automatically.</div></div></div>
              <div class="overview-item"><div class="overview-dot"></div><div><strong>Use sync after content changes.</strong><div class="muted">This keeps generated indexes, tracker maps, and <code>sw.js</code> in step.</div></div></div>
              <div class="overview-item"><div class="overview-dot"></div><div><strong>Keep engines at the root.</strong><div class="muted">Generated quiz, bank, and index pages compute their prefixes from folder depth.</div></div></div>
            </div>
          </div>
          <div class="overview-card">
            <div class="section-title">Recent Files</div>
            <div class="overview-list">
              ${recentFiles.length ? recentFiles.map(file => `
                <a href="#" onclick="event.preventDefault(); requestLoadFile('${escapeHtml(file.path)}')">
                  <div class="overview-item">
                    <div class="overview-dot"></div>
                    <div>
                      <strong>${escapeHtml(file.title || file.name)}</strong>
                      <div class="muted">${escapeHtml(file.path)}</div>
                    </div>
                  </div>
                </a>
              `).join('') : '<div class="muted">No HTML files found yet.</div>'}
            </div>
          </div>
          <div class="overview-card">
            <div class="section-title">Built-in Tools</div>
            <div class="overview-list">
              <div class="overview-item">
                <div class="overview-dot"></div>
                <div>
                  <strong><a href="/admin/pdf-exporter" target="_blank" rel="noopener">PDF Exporter</a></strong>
                  <div class="muted">Generate printable PDF versions of your quizzes and banks.</div>
                </div>
              </div>
            </div>
          </div>
          <div class="overview-card">
            <div class="section-title">Keyboard</div>
            <div class="overview-list">
              <div class="overview-item"><div class="overview-dot"></div><div><span class="kbd">Ctrl</span> + <span class="kbd">S</span><div class="muted">Save the current file.</div></div></div>
              <div class="overview-item"><div class="overview-dot"></div><div><span class="kbd">Esc</span><div class="muted">Close the active modal.</div></div></div>
              <div class="overview-item"><div class="overview-dot"></div><div><span class="kbd">/</span><div class="muted">Focus the file search box when you are not typing in an editor.</div></div></div>
            </div>
          </div>
        </div>
      `;
    }

    function renderStatusStrip() {
      const host = document.getElementById('panel-status-strip');
      if (!host) return;
      const chips = [];
      if (state.dirty) chips.push({ tone: 'warn', text: 'Unsaved changes' });
      else chips.push({ tone: 'success', text: 'Saved locally' });
      if (state.syncState === 'needs-sync') chips.push({ tone: 'warn', text: 'Sync recommended' });
      if (state.syncState === 'syncing') chips.push({ tone: 'info', text: 'Sync running' });
      if (state.syncState === 'sync-failed') chips.push({ tone: 'error', text: 'Sync failed' });
      if (state.validation?.errors?.length) chips.push({ tone: 'error', text: `${state.validation.errors.length} validation error(s)` });
      else if (state.validation?.warnings?.length) chips.push({ tone: 'warn', text: `${state.validation.warnings.length} validation warning(s)` });
      host.innerHTML = `
        <div class="status-strip">
          ${chips.map(chip => `<div class="status-chip ${badgeClassForTone(chip.tone)}">${escapeHtml(chip.text)}</div>`).join('')}
          <div class="muted" style="margin-left:auto;">${escapeHtml(state.syncMessage || 'Workspace ready.')}</div>
        </div>
      `;
    }

    function renderValidationPanel() {
      const host = document.getElementById('panel-validation-host');
      if (!host) return;
      if (!state.validation) {
        host.innerHTML = '';
        return;
      }
      host.innerHTML = `
        <div class="validation-strip">
          <strong>Validation</strong>
          ${renderValidationIssues([...(state.validation.errors || []), ...(state.validation.warnings || [])], { empty: 'No validation issues.' })}
        </div>
      `;
    }

    async function validateCurrentFile({ silent = true } = {}) {
      if (!state.currentFile || !state.currentData) return null;
      const payload = {
        path: state.currentFile,
        content: state.currentData.content,
        original_uid: state.loadedMeta?.uid || '',
      };
      const result = await fetchJson('/admin/validate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      state.validation = result.validation;
      if (!silent) {
        const tone = result.ok ? 'success' : 'warn';
        showToast(result.message || 'Validation complete.', tone);
      }
      renderStatusStrip();
      renderValidationPanel();
      return result.validation;
    }

    function runNamedAction(actionName) {
      if (actionName && typeof window[actionName] === 'function') {
        window[actionName]();
      }
    }

    function openUnsavedChangesModal(nextAction) {
      state.pendingAction = nextAction;
      openModal({
        title: 'Unsaved Changes',
        subtitle: 'Choose what to do before leaving this file.',
        body: `
          <div class="empty-state" style="text-align:left;">
            This file has unsaved changes. You can save now, discard the edits, or stay on the current file.
          </div>
          <div class="modal-actions">
            <button class="btn" onclick="closeModal(); state.pendingAction = null;">Cancel</button>
            <button class="btn" onclick="discardPendingChanges()">Discard</button>
            <button class="btn btn-primary" onclick="saveAndContinuePending()">Save</button>
          </div>
        `,
      });
    }

    async function saveAndContinuePending() {
      closeModal();
      const saved = await saveFile({ quiet: true });
      if (saved && typeof state.pendingAction === 'function') {
        const next = state.pendingAction;
        state.pendingAction = null;
        await next();
      }
    }

    function discardPendingChanges() {
      closeModal();
      setDirty(false);
      if (typeof state.pendingAction === 'function') {
        const next = state.pendingAction;
        state.pendingAction = null;
        next();
      }
    }

    async function requestLoadFile(path, options = {}) {
      const { afterLoadAction = '', ...loadOptions } = options || {};
      if (state.dirty && path !== state.currentFile) {
        openUnsavedChangesModal(async () => {
          await loadFile(path, loadOptions);
          runNamedAction(afterLoadAction);
        });
        return;
      }
      const result = await loadFile(path, loadOptions);
      runNamedAction(afterLoadAction);
      return result;
    }

    async function loadFile(path, { silent = false, keepTab = false, tab = null, forceRefresh = false } = {}) {
      if (!forceRefresh && state.currentFile === path && state.currentData) {
        if (!keepTab) state.currentTab = tab || 'preview';
        else if (tab) state.currentTab = tab;
        renderFilePanel();
        return state.currentData;
      }
      const data = await fetchJson(`/admin/load-file?path=${encodeURIComponent(path)}`);
      state.currentFile = path;
      state.currentData = data;
      state.loadedMeta = clone(data.meta || {});
      state.validation = null;
      rememberRecent('recentFolders', path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.');
      expandFolderForFile(path);
      saveUiPrefs();
      if (!keepTab) state.currentTab = tab || 'preview';
      else if (tab) state.currentTab = tab;
      setDirty(false);
      setSyncState('saved', `Loaded ${path}`);
      renderFilePanel();
      renderTree();
      if (!silent) logActivity('Loaded file', path, 'info');
      return data;
    }

    function renderFilePanel() {
      const panel = document.getElementById('workspace-panel');
      if (!state.currentData) {
        renderOverview();
        return;
      }
      const meta = state.currentData.meta || {};
      const previewUrl = `/admin/preview/${encodePath(state.currentFile)}?v=${Date.now()}`;
      const canStructuredEdit = ['quiz', 'bank', 'index'].includes(meta.type);

      let content = '';
      if (state.currentTab === 'preview') {
        content = `
          <div class="preview-toolbar">
            <button class="mini-btn" onclick="renderFilePanel()">Reload Preview</button>
            <a class="mini-btn" href="/admin/preview/${encodePath(state.currentFile)}" target="_blank" rel="noopener">Open in New Tab</a>
            <a class="mini-btn" href="/${encodePath(state.currentFile)}" target="_blank" rel="noopener">Open Real File</a>
            ${state.currentFile.includes('/') ? `<a class="mini-btn" href="/${encodePath(state.currentFile.slice(0, state.currentFile.lastIndexOf('/')) + '/index.html')}" target="_blank" rel="noopener">Open Parent Index</a>` : ''}
          </div>
          <iframe class="preview-frame" src="${previewUrl}" style="flex: 1; min-height: 0;" title="Preview"></iframe>
        `;
      } else if (state.currentTab === 'editor' && canStructuredEdit) {
        content = renderStructuredEditor(meta);
      } else if (state.currentTab === 'metadata') {
        content = `<textarea class="text-area code" readonly>${escapeHtml(JSON.stringify(meta, null, 2))}</textarea>`;
      } else {
        content = `<textarea id="raw-html" class="text-area code" style="flex: 1;" oninput="onRawInput()">${escapeHtml(state.currentData.content || '')}</textarea>`;
      }

      panel.innerHTML = `
        <div class="panel-header">
          <div class="panel-header-main" oncontextmenu="openActiveFileContextMenu(event)">
            <div class="panel-title">${meta.title || meta.filename || 'New File'}</div>
            <div class="panel-path">${escapeHtml(state.currentFile)}</div>
          </div>
          <div class="panel-actions">
            ${(() => { const a = getPrimaryActionState(); if (a.action) return `<button class="btn ${a.tone === 'primary' ? 'btn-primary' : a.tone === 'warn' ? 'btn' : a.tone === 'error' ? 'btn btn-danger' : 'btn'}" onclick="${a.action}">${escapeHtml(a.label)}</button>`; return `<button class="btn" disabled>${escapeHtml(a.label)}</button>`; })()}
            <button class="btn" onclick="runSync()">Sync</button>
            <button class="btn" onclick="openDuplicateModal()">Duplicate</button>
            <button class="btn" onclick="openMoveModal()">Move/Rename</button>
            <button class="btn delete" onclick="openDeleteModal()">Delete</button>
          </div>
        </div>

        <div id="panel-status-strip"></div>
        <div id="panel-validation-host"></div>

        <div class="tab-row">
          <button class="tab-btn ${state.currentTab === 'preview' ? 'active' : ''}" onclick="setTab('preview')">Preview</button>
          <button class="tab-btn ${state.currentTab === 'editor' ? 'active' : ''}" onclick="setTab('editor')">Editor</button>
          <button class="tab-btn ${state.currentTab === 'metadata' ? 'active' : ''}" onclick="setTab('metadata')">Metadata</button>
          <button class="tab-btn ${state.currentTab === 'raw' ? 'active' : ''}" onclick="setTab('raw')">Raw HTML</button>
        </div>

        <div class="panel-body" style="flex: 1; overflow: auto; min-height: 0; margin-top: 1rem; display: flex; flex-direction: column;">
          ${content}
        </div>
      `;
      renderStatusStrip();
      renderValidationPanel();
    }

    function renderMetaCard(label, value) {
      return `<div class="meta-card"><div class="meta-label">${escapeHtml(label)}</div><div class="meta-value">${escapeHtml(value)}</div></div>`;
    }

    function renderTabButton(key, label) {
      return `<button class="tab-btn ${state.currentTab === key ? 'active' : ''}" onclick="setTab('${key}')">${escapeHtml(label)}</button>`;
    }

    function setTab(tab) {
      state.currentTab = tab;
      renderFilePanel();
    }

    function renderStructuredEditor(meta) {
      if (meta.type === 'quiz' || meta.type === 'bank') {
        return renderQuizBankEditor(meta);
      }
      if (meta.type === 'index') {
        return renderIndexEditor(meta);
      }
      return '<div class="empty-state">Structured editing is not available for this file type.</div>';
    }

    function getPrimaryActionState() {
      if (state.dirty) {
        if (state.validation?.errors?.length) return { label: 'Validate', action: 'validateCurrentFile({ silent: false })', tone: 'warn' };
        return { label: 'Save', action: 'saveFile()', tone: 'primary' };
      }
      if (state.syncState === 'needs-sync') return { label: 'Sync', action: 'runSync()', tone: 'primary' };
      if (state.syncState === 'syncing') return { label: 'Syncing...', action: '', tone: 'info' };
      if (state.syncState === 'sync-failed') return { label: 'Sync Failed', action: 'runSync()', tone: 'error' };
      if (state.projectState?.git?.dirtyCount) return { label: 'Deploy', action: 'openDeployModal()', tone: 'primary' };
      return { label: 'Saved', action: '', tone: 'success' };
    }

    function renderQuizBankEditor(meta) {
      const isBank = meta.type === 'bank';
      const questions = meta.questions || [];
      const topFields = `
        <div class="editor-grid">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem; align-items:start;">
            <div class="field" style="margin:0;">
              <label>UID</label>
              <input class="text-input" id="cfg-uid" value="${escapeHtml(meta.config?.uid || '')}" oninput="syncQuizBankEditor()">
              <small>Keep this stable for deployed files to preserve progress and tracker data.</small>
            </div>
            <div class="field" style="margin:0;">
              <label>Title</label>
              <input class="text-input" id="cfg-title" value="${escapeHtml(meta.config?.title || '')}" oninput="syncQuizBankEditor()">
            </div>
          </div>
          <div class="field full">
            <label>Description</label>
            <textarea class="text-area" id="cfg-description" oninput="syncQuizBankEditor()">${escapeHtml(meta.config?.description || '')}</textarea>
          </div>
          ${isBank ? `
            <div class="field" style="max-width:300px;">
              <label>Icon</label>
              <input class="text-input" id="cfg-icon" value="${escapeHtml(meta.config?.icon || '🗃️')}" oninput="syncQuizBankEditor()">
            </div>
          ` : ''}
      `;
      return `
        ${topFields}
          <div class="panel-grid">
            ${renderMetaCard('Questions', questions.length)}
            ${renderMetaCard('Mode', isBank ? 'Bank' : 'Quiz')}
            ${renderMetaCard('Engine', isBank ? 'bank-engine.js' : 'quiz-engine.js')}
          </div>
          <div class="editor-toolbar">
            <div class="muted">Collapse large banks to scan and reorder them faster.</div>
            <div class="editor-toolbar-actions">
              <button class="mini-btn" onclick="collapseAllQuestions()">Collapse All</button>
              <button class="mini-btn" onclick="expandAllQuestions()">Expand All</button>
            </div>
          </div>
          <div class="editor-list">
            ${questions.map((question, index) => renderQuestionCard(question, index)).join('')}
          </div>
          <button class="btn" onclick="addQuestion()">Add Question</button>
        </div>
      `;
    }

    function renderQuestionCard(question, index) {
      const options = question.options || ['', '', '', ''];
      const collapsed = state.collapsedQuestions.has(index);
      const summary = `${(question.question || 'Untitled question').slice(0, 90)}${(question.question || '').length > 90 ? '…' : ''}`;
      return `
        <div class="editor-card ${collapsed ? 'collapsed' : ''}">
          <div class="editor-card-header">
            <div>
              <div class="editor-card-title">Question ${index + 1}</div>
              <div class="editor-summary">${escapeHtml(summary)}</div>
            </div>
            <div class="mini-actions">
              <button class="mini-btn" onclick="toggleQuestionCollapse(${index})">${collapsed ? 'Expand' : 'Collapse'}</button>
              <button class="mini-btn" onclick="moveQuestion(${index}, -1)" ${index === 0 ? 'disabled' : ''}>Up</button>
              <button class="mini-btn" onclick="moveQuestion(${index}, 1)" ${index === (state.currentData.meta.questions || []).length - 1 ? 'disabled' : ''}>Down</button>
              <button class="mini-btn" onclick="duplicateQuestion(${index})">Duplicate</button>
              <button class="mini-btn delete" onclick="removeQuestion(${index})">Remove Q</button>
            </div>
          </div>
          <div class="editor-card-body">
            <div class="field">
              <label>Question</label>
              <textarea class="text-area q-question" data-index="${index}" oninput="syncQuizBankEditor()">${escapeHtml(question.question || '')}</textarea>
            </div>
            <div class="field">
              <label>Options</label>
              <div class="option-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                ${options.map((option, optionIndex) => `
                  <div class="option-row" style="display: flex; align-items: center; gap: 0.4rem;">
                    <input type="radio" name="correct-${index}" value="${optionIndex}" ${question.correct === optionIndex ? 'checked' : ''} onchange="syncQuizBankEditor()">
                    <input class="text-input q-option" data-index="${index}" data-option="${optionIndex}" value="${escapeHtml(option)}" oninput="syncQuizBankEditor()" placeholder="Option ${String.fromCharCode(65 + optionIndex)}" style="flex:1;">
                    ${options.length > 2 ? `<button class="mini-btn delete" onclick="removeOption(${index}, ${optionIndex})" title="Remove Option">×</button>` : ''}
                  </div>
                `).join('')}
                <button class="mini-btn" onclick="addOption(${index})" style="grid-column: span 2; border-style: dashed; margin-top: 0.25rem;">+ Add Option</button>
              </div>
            </div>
            <div class="field">
              <label>Explanation</label>
              <textarea class="text-area q-explanation" data-index="${index}" oninput="syncQuizBankEditor()">${escapeHtml(question.explanation || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    function renderIndexEditor(meta) {
      const quizzes = meta.quizzes || [];
      return `
        <div class="editor-grid">
          <div class="field-grid">
            <div class="field">
              <label>Page Title</label>
              <input class="text-input" id="index-title" value="${escapeHtml(meta.title || '')}" oninput="syncIndexEditor()">
            </div>
            <div class="field">
              <label>Hero Title</label>
              <input class="text-input" id="index-hero-title" value="${escapeHtml(meta.hero_title || '')}" oninput="syncIndexEditor()">
              <small>HTML is allowed here, for example <code>Select your &lt;span&gt;Gynecology exam&lt;/span&gt;</code>.</small>
            </div>
            <div class="field full">
              <label>Hero Description</label>
              <textarea class="text-area" id="index-description" oninput="syncIndexEditor()">${escapeHtml(meta.description || '')}</textarea>
            </div>
          </div>
          <div class="editor-list">
            ${quizzes.map((quiz, index) => renderIndexCard(quiz, index)).join('')}
          </div>
          <button class="btn" onclick="addIndexCard()">Add Card</button>
        </div>
      `;
    }

    function renderIndexCard(quiz, index) {
      return `
        <div class="editor-card">
          <div class="editor-card-header">
            <div class="editor-card-title">Card ${index + 1}</div>
            <div class="mini-actions">
              <button class="mini-btn" onclick="moveIndexCard(${index}, -1)" ${index === 0 ? 'disabled' : ''}>Up</button>
              <button class="mini-btn" onclick="moveIndexCard(${index}, 1)" ${index === (state.currentData.meta.quizzes || []).length - 1 ? 'disabled' : ''}>Down</button>
              <button class="mini-btn" onclick="duplicateIndexCard(${index})">Duplicate</button>
              <button class="mini-btn delete" onclick="removeIndexCard(${index})">Remove</button>
            </div>
          </div>
          <div class="field-grid">
            <div class="field">
              <label>Title</label>
              <input class="text-input idx-title" data-index="${index}" value="${escapeHtml(quiz.title || '')}" oninput="syncIndexEditor()">
            </div>
            <div class="field">
              <label>URL</label>
              <input class="text-input idx-url" data-index="${index}" value="${escapeHtml(quiz.url || '')}" oninput="syncIndexEditor()">
            </div>
            <div class="field">
              <label>Icon</label>
              <input class="text-input idx-icon" data-index="${index}" value="${escapeHtml(quiz.icon || '')}" oninput="syncIndexEditor()">
            </div>
            <div class="field">
              <label>Tags</label>
              <input class="text-input idx-tags" data-index="${index}" value="${escapeHtml((quiz.tags || []).join(', '))}" oninput="syncIndexEditor()" placeholder="Folder, 30 Questions">
            </div>
            <div class="field full">
              <label>Description</label>
              <textarea class="text-area idx-description" data-index="${index}" oninput="syncIndexEditor()">${escapeHtml(quiz.description || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    function onRawInput() {
      if (!state.currentData) return;
      state.currentData.content = document.getElementById('raw-html').value;
      setDirty(true);
      setSyncState('needs-sync', 'Raw HTML changed. Save and sync when ready.');
      scheduleValidation();
    }

    function replaceAssignedBlock(html, constName, openChar, closeChar, value) {
      const openPattern = new RegExp(`(const|let|var)\\s+${constName}\\s*=\\s*\\${openChar}`);
      const match = html.match(openPattern);
      if (!match) return html;
      const startIdx = html.indexOf(match[0]);
      const blockStart = startIdx + match[0].length - 1;
      let depth = 0;
      let endIdx = -1;
      for (let i = blockStart; i < html.length; i += 1) {
        if (html[i] === openChar) depth += 1;
        else if (html[i] === closeChar) {
          depth -= 1;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
      if (endIdx === -1) return html;
      const serialized = JSON.stringify(value, null, 2);
      return `${html.slice(0, startIdx)}${match[1]} ${constName} = ${serialized}${html.slice(endIdx + 1)}`;
    }

    function updateRawAndMeta() {
      const raw = document.getElementById('raw-html');
      const metadataPanel = document.querySelector('#tab-metadata textarea');
      if (raw) raw.value = state.currentData.content;
      if (metadataPanel) metadataPanel.value = JSON.stringify(state.currentData.meta, null, 2);
      setDirty(true);
      setSyncState('needs-sync', 'Local edits updated. Save when ready, then run sync for generated assets.');
      scheduleValidation();
    }

    function scheduleValidation() {
      window.clearTimeout(state.validationTimer);
      state.validationTimer = window.setTimeout(() => {
        if (state.currentFile && state.currentData) {
          validateCurrentFile({ silent: true }).catch(() => {});
        }
      }, 350);
    }

    function syncQuizBankEditor() {
      if (!state.currentData) return;
      const meta = state.currentData.meta;
      const uid = document.getElementById('cfg-uid')?.value || '';
      const title = document.getElementById('cfg-title')?.value || '';
      const description = document.getElementById('cfg-description')?.value || '';
      const icon = document.getElementById('cfg-icon')?.value || '🗃️';
      const cards = Array.from(document.querySelectorAll('.editor-card'));
      const questions = cards.map((card, index) => {
        const questionText = card.querySelector('.q-question')?.value || '';
        const options = Array.from(card.querySelectorAll('.q-option')).map(input => input.value || '');
        const checked = card.querySelector(`input[name="correct-${index}"]:checked`);
        const correct = checked ? Number(checked.value) : 0;
        const explanation = card.querySelector('.q-explanation')?.value || '';
        return { question: questionText, options, correct, explanation };
      });
      meta.config = meta.config || {};
      meta.config.uid = uid;
      meta.config.title = title;
      meta.config.description = description;
      if (meta.type === 'bank') meta.config.icon = icon;
      meta.uid = uid;
      meta.title = title;
      meta.description = description;
      meta.icon = meta.type === 'bank' ? icon : undefined;
      meta.questions = questions;
      meta.question_count = questions.length;
      const configName = meta.type === 'bank' ? 'BANK_CONFIG' : 'QUIZ_CONFIG';
      const arrayName = meta.type === 'bank' ? 'QUESTION_BANK' : 'QUESTIONS';
      let updated = state.currentData.content;
      updated = replaceAssignedBlock(updated, configName, '{', '}', meta.config);
      updated = replaceAssignedBlock(updated, arrayName, '[', ']', questions);
      state.currentData.content = updated;
      updateRawAndMeta();
    }

    function syncIndexEditor() {
      if (!state.currentData) return;
      const meta = state.currentData.meta;
      const title = document.getElementById('index-title')?.value || '';
      const heroTitle = document.getElementById('index-hero-title')?.value || '';
      const description = document.getElementById('index-description')?.value || '';
      const cards = Array.from(document.querySelectorAll('.editor-card')).map(card => {
        const cardTitle = card.querySelector('.idx-title')?.value || '';
        const cardDescription = card.querySelector('.idx-description')?.value || '';
        const cardUrl = card.querySelector('.idx-url')?.value || '';
        const cardIcon = card.querySelector('.idx-icon')?.value || '';
        const tags = (card.querySelector('.idx-tags')?.value || '')
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean);
        const entry = { title: cardTitle, description: cardDescription, url: cardUrl };
        if (cardIcon) entry.icon = cardIcon;
        if (tags.length) entry.tags = tags;
        return entry;
      });
      meta.title = title;
      meta.hero_title = heroTitle;
      meta.description = description;
      meta.quizzes = cards;
      meta.question_count = cards.length;
      let updated = state.currentData.content;
      updated = replaceAssignedBlock(updated, 'QUIZZES', '[', ']', cards);
      if (title) {
        updated = updated.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
        updated = updated.replace(/<div class="topbar-title">[\s\S]*?<\/div>/i, `<div class="topbar-title">${escapeHtml(title)}</div>`);
      }
      const heroPattern = /<header class="hero">[\s\S]*?<\/header>/i;
      if (heroPattern.test(updated)) {
        updated = updated.replace(
          heroPattern,
          `<header class="hero">\n      <h1>${heroTitle}</h1>\n      <p>${escapeHtml(description)}</p>\n    </header>`
        );
      }
      state.currentData.content = updated;
      updateRawAndMeta();
    }

    function toggleQuestionCollapse(index) {
      if (state.collapsedQuestions.has(index)) state.collapsedQuestions.delete(index);
      else state.collapsedQuestions.add(index);
      renderFilePanel();
      setTab('editor');
    }

    function collapseAllQuestions() {
      const count = state.currentData?.meta?.questions?.length || 0;
      state.collapsedQuestions = new Set(Array.from({ length: count }, (_value, index) => index));
      renderFilePanel();
      setTab('editor');
    }

    function expandAllQuestions() {
      state.collapsedQuestions = new Set();
      renderFilePanel();
      setTab('editor');
    }

    function moveQuestion(index, delta) {
      const list = state.currentData?.meta?.questions;
      if (!list) return;
      const next = index + delta;
      if (next < 0 || next >= list.length) return;
      [list[index], list[next]] = [list[next], list[index]];
      renderFilePanel();
      setTab('editor');
      syncQuizBankEditor();
    }

    function duplicateQuestion(index) {
      const list = state.currentData?.meta?.questions;
      if (!list) return;
      list.splice(index + 1, 0, clone(list[index]));
      renderFilePanel();
      setTab('editor');
      syncQuizBankEditor();
    }

    function removeQuestion(index) {
      const list = state.currentData?.meta?.questions;
      if (!list) return;
      list.splice(index, 1);
      renderFilePanel();
      setTab('editor');
      syncQuizBankEditor();
    }

    function addQuestion() {
      const list = state.currentData?.meta?.questions;
      if (!list) return;
      list.push({ question: '', options: ['', '', '', ''], correct: 0, explanation: '' });
      renderFilePanel();
      setTab('editor');
      syncQuizBankEditor();
    }

    function addOption(qIdx) {
      const list = state.currentData?.meta?.questions;
      if (!list) return;
      list[qIdx].options.push('');
      renderFilePanel();
      setTab('editor');
      syncQuizBankEditor();
    }

    function removeOption(qIdx, oIdx) {
      const list = state.currentData?.meta?.questions;
      if (!list) return;
      list[qIdx].options.splice(oIdx, 1);
      if (list[qIdx].correct >= list[qIdx].options.length) {
        list[qIdx].correct = 0;
      }
      renderFilePanel();
      setTab('editor');
      syncQuizBankEditor();
    }

    function moveIndexCard(index, delta) {
      const list = state.currentData?.meta?.quizzes;
      if (!list) return;
      const next = index + delta;
      if (next < 0 || next >= list.length) return;
      [list[index], list[next]] = [list[next], list[index]];
      renderFilePanel();
      setTab('editor');
      syncIndexEditor();
    }

    function duplicateIndexCard(index) {
      const list = state.currentData?.meta?.quizzes;
      if (!list) return;
      list.splice(index + 1, 0, clone(list[index]));
      renderFilePanel();
      setTab('editor');
      syncIndexEditor();
    }

    function removeIndexCard(index) {
      const list = state.currentData?.meta?.quizzes;
      if (!list) return;
      list.splice(index, 1);
      renderFilePanel();
      setTab('editor');
      syncIndexEditor();
    }

    function addIndexCard() {
      const list = state.currentData?.meta?.quizzes;
      if (!list) return;
      list.push({ title: '', description: '', url: '', icon: '', tags: [] });
      renderFilePanel();
      setTab('editor');
      syncIndexEditor();
    }

    async function saveFile({ quiet = false, confirmUidChange = false } = {}) {
      if (!state.currentFile || !state.currentData) {
        showToast('No file is loaded.', 'warn');
        return false;
      }
      const raw = document.getElementById('raw-html');
      const content = raw ? raw.value : state.currentData.content;
      try {
        const result = await fetchJson('/admin/save-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: state.currentFile, content, confirm_uid_change: confirmUidChange }),
        });
        state.currentData.content = content;
        setDirty(false);
        setSyncState('needs-sync', 'File saved locally. Run sync to refresh generated indexes and assets.');
        if (!quiet) showToast(result.message || 'File saved.', 'success');
        logActivity('Saved file', state.currentFile, 'success');
        const validation = await validateCurrentFile({ silent: true });
        if (validation?.meta) {
          state.currentData.meta = clone(validation.meta);
          state.loadedMeta = clone(validation.meta);
        }
        return true;
      } catch (error) {
        if (error.payload?.validation) {
          state.validation = error.payload.validation;
          renderFilePanel();
        }
        if (String(error.message || '').includes('UID change requires confirmation') && !confirmUidChange) {
          openModal({
            title: 'Confirm UID Change',
            subtitle: 'Changing a deployed UID can orphan learner progress and tracker history.',
            body: `
              <div class="empty-state" style="text-align:left;">
                Save this file anyway with the new UID?
              </div>
              <div class="modal-actions">
                <button class="btn" onclick="closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="closeModal(); saveFile({ confirmUidChange: true })">Save with New UID</button>
              </div>
            `,
          });
          return false;
        }
        showToast(error.message || 'Save failed.', 'error');
        return false;
      }
    }

    async function runSync({ silentToast = false, preserveCurrent = true } = {}) {
      if (state.dirty) {
        showToast('Save the current file before running sync.', 'warn');
        return false;
      }
      setSyncState('syncing', 'Running sync script...');
      const result = await fetchJson('/admin/run-sync', { method: 'POST' });
      setSyncState(result.returncode === 0 ? 'saved' : 'sync-failed', result.message || 'Sync completed.');
      if (!silentToast) showToast(result.message || 'Sync completed.', result.returncode === 0 ? 'success' : 'warn');
      logActivity('Sync completed', result.output || result.stderr || 'No output.', result.returncode === 0 ? 'success' : 'warn');
      await refreshWorkspace({ preserveCurrent });
      return result.returncode === 0;
    }

    async function saveAndSync() {
      const saved = await saveFile();
      if (!saved) return;
      await runSync({ preserveCurrent: true });
    }

    async function convertFile() {
      if (!state.currentFile) return;
      openModal({
        title: 'Convert Quiz / Bank',
        subtitle: 'This keeps the UID and existing questions while swapping the engine type.',
        body: `
          <div class="empty-state" style="text-align:left;">
            Convert <strong>${escapeHtml(state.currentFile)}</strong> now?
          </div>
          <div class="modal-actions">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="confirmConvertFile()">Convert</button>
          </div>
        `,
      });
    }

    async function confirmConvertFile() {
      const result = await fetchJson('/admin/convert-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: state.currentFile }),
      });
      closeModal();
      showToast(result.message || 'File converted.', 'success');
      logActivity('Converted file', `${state.currentFile}\n${result.message || ''}`, 'success');
      await runSync({ silentToast: true, preserveCurrent: true });
    }

    function openModal({ title, subtitle = '', body, onOpen = null }) {
      state.modalOpen = true;
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-subtitle').textContent = subtitle;
      document.getElementById('modal-body').innerHTML = body;
      document.getElementById('modal').classList.add('open');
      if (typeof onOpen === 'function') onOpen();
    }

    function closeModal() {
      state.modalOpen = false;
      document.getElementById('modal').classList.remove('open');
      document.getElementById('modal-body').innerHTML = '';
      state.modalTab = '';
    }
    
    function openPdfModal(url) {
      openModal({
        title: 'Export PDF',
        subtitle: 'The PDF exporter provides a print-ready view of the current file.',
        body: `
         <iframe class="preview-frame" src="/admin/preview/${state.currentFile}" style="flex: 1; min-height: 0;" title="File Preview"></iframe>
          <div class="modal-actions">
            <a class="btn btn-primary" href="${url}" target="_blank" rel="noopener">Open in New Tab</a>
            <button class="btn" onclick="closeModal()">Close</button>
          </div>
        `
      });
    }

    function folderOptions(selected = '.') {
      return state.folders.map(folder => `
        <option value="${escapeHtml(folder)}" ${folder === selected ? 'selected' : ''}>
          ${escapeHtml(folder === '.' ? 'root' : folder)}
        </option>
      `).join('');
    }

    function openCreateModal() {
      openModal({
        title: 'Create New',
        subtitle: 'Choose what you want to add to the project.',
        body: `
          <div style="display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
            <button class="meta-card" onclick="closeModal(); openNewFileWizard()" style="text-align: left; cursor: pointer; border: 1px solid var(--border); background: var(--surface2); color: var(--text); transition: 0.2s;">
              <div class="meta-label">New Content</div>
              <div class="meta-value" style="font-size: 1.1rem; color: var(--accent);">Quiz or Bank</div>
              <div class="muted" style="font-size: 0.82rem; margin-top: 0.4rem; line-height: 1.4;">Preset-driven creation, import helpers, clone support, and faster folder-aware output.</div>
            </button>
            <button class="meta-card" onclick="closeModal(); openNewFolderModal()" style="text-align: left; cursor: pointer; border: 1px solid var(--border); background: var(--surface2); color: var(--text); transition: 0.2s;">
              <div class="meta-label">New Structure</div>
              <div class="meta-value" style="font-size: 1.1rem; color: var(--accent);">Subject Folder</div>
              <div class="muted" style="font-size: 0.82rem; margin-top: 0.4rem; line-height: 1.4;">Creates a new directory and a managed hub index.html page automatically.</div>
            </button>
          </div>
          <div class="modal-actions" style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
             <a class="btn" href="/admin/pdf-exporter" target="_blank" rel="noopener" onclick="closeModal()">Open Standalone PDF Exporter</a>
             <button class="btn" onclick="closeModal()">Cancel</button>
          </div>
        `
      });
    }

    function openNewFolderModal(parentFolder = '.') {
      const folderDatalist = (state.folders || []).map(f => `<option value="${escapeHtml(f)}">`).join('');
      const defaultPath = parentFolder && parentFolder !== '.' ? `${parentFolder}/` : '';
      openModal({
        title: 'Create Folder',
        subtitle: 'Creates the folder and a matching hub index page with correct root asset prefixes.',
        body: `
          <div class="field-grid">
            <div class="field full">
              <label>Folder Path</label>
              <input class="text-input" id="folder-path" list="folder-suggestions" placeholder="gyn/new-topic" value="${escapeHtml(defaultPath)}">
              <datalist id="folder-suggestions">
                ${folderDatalist}
              </datalist>
              <small>Choose an existing parent or type a new path.</small>
            </div>
            <div class="field">
              <label>Folder Title</label>
              <input class="text-input" id="folder-title" placeholder="New Topic">
            </div>
            <div class="field">
              <label>Hero Description</label>
              <input class="text-input" id="folder-description" placeholder="Quizzes and resources for this section.">
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="createFolder()">Create Folder</button>
          </div>
        `,
      });
    }

    function getPresetByKey(key) {
      return WIZARD_PRESETS.find(preset => preset.key === key) || WIZARD_PRESETS[0];
    }

    function buildStarterQuestions(count) {
      return Array.from({ length: Math.max(1, count || 1) }, () => defaultQuestion());
    }

    function collectWizardState() {
      const previous = state.wizard || {};
      return {
        type: document.getElementById('file-type')?.value || previous.type || 'quiz',
        folder: document.getElementById('file-folder')?.value || previous.folder || '.',
        title: document.getElementById('file-title')?.value || previous.title || '',
        description: document.getElementById('file-description')?.value || previous.description || '',
        filename: document.getElementById('file-name')?.value || previous.filename || '',
        icon: document.getElementById('file-icon')?.value || previous.icon || '🗃️',
        presetKey: document.getElementById('file-preset')?.value || previous.presetKey || 'lecture',
        sourceMode: document.getElementById('file-source-mode')?.value || previous.sourceMode || 'manual',
        sourceRaw: document.getElementById('file-import-raw')?.value || previous.sourceRaw || '',
        clonePath: document.getElementById('file-clone-path')?.value || previous.clonePath || '',
      };
    }

    function renderWizardSummaryBox(wizard) {
      const stemBase = slugifyClient(wizard.filename || wizard.title, 'untitled');
      const stem = wizard.type === 'bank' && !wizard.filename && !stemBase.startsWith('all-') ? `all-${stemBase}` : stemBase;
      const uid = buildDerivedUid(wizard.folder, stem);
      const issues = [];
      if (!wizard.title.trim()) issues.push({ level: 'error', message: 'Title is required before create.' });
      issues.push(...validateQuestionListClient(state.modalQuestions));
      return `
        <div class="wizard-summary">
          <div class="wizard-step-title">Live Summary</div>
          ${renderMetaCard('Target Folder', wizard.folder || '.')}
          ${renderMetaCard('Filename', `${stem}.html`)}
          ${renderMetaCard('Derived UID', uid)}
          ${renderMetaCard('Questions', state.modalQuestions.length)}
          ${renderMetaCard('Source', wizard.sourceMode)}
          <div class="validation-strip" style="margin-top:0.75rem; margin-bottom:0;">
            <strong>Preflight</strong>
            ${renderValidationIssues(issues, { empty: 'Ready to create.' })}
          </div>
        </div>
      `;
    }

    function syncWizardSummary() {
      state.wizard = collectWizardState();
      const host = document.getElementById('wizard-summary');
      if (host) host.innerHTML = renderWizardSummaryBox(state.wizard);
    }

    function openNewFileWizard(options = {}) {
      const previous = state.wizard || {};
      const type = options.type || previous.type || 'quiz';
      const presetKey = previous.presetKey || (type === 'bank' ? 'all-bank' : (state.recentPresets[0] || 'lecture'));
      state.wizard = {
        folder: Object.prototype.hasOwnProperty.call(options, 'folder') ? options.folder : (previous.folder || state.recentFolders[0] || '.'),
        type,
        title: previous.title || '',
        description: previous.description || '',
        filename: previous.filename || '',
        icon: previous.icon || '🗃️',
        presetKey,
        sourceMode: previous.sourceMode || 'manual',
        sourceRaw: previous.sourceRaw || '',
        clonePath: previous.clonePath || '',
      };
      if (!state.modalOpen || !state.modalQuestions.length) {
        state.modalQuestions = buildStarterQuestions(getPresetByKey(presetKey).starterCount);
      }
      if (!state.modalTab || state.modalTab === 'basic') state.modalTab = 'setup';
      renderNewFileModal();
    }

    function renderNewFileModal() {
      const wizard = collectWizardState();
      state.wizard = wizard;
      const isBank = wizard.type === 'bank';
      const preset = getPresetByKey(wizard.presetKey);
      const cloneOptions = state.files
        .filter(file => file.type === 'quiz' || file.type === 'bank')
        .map(file => `<option value="${escapeHtml(file.path)}" ${file.path === wizard.clonePath ? 'selected' : ''}>${escapeHtml(file.title)} (${escapeHtml(file.path)})</option>`)
        .join('');
      const body = `
        <div>
            <div class="tab-row" style="margin-bottom: 1.5rem;">
              <button class="tab-btn ${state.modalTab === 'setup' ? 'active' : ''}" onclick="setModalTab('setup')">1. Setup</button>
              <button class="tab-btn ${state.modalTab === 'source' ? 'active' : ''}" onclick="setModalTab('source')">2. Source</button>
              <button class="tab-btn ${state.modalTab === 'questions' ? 'active' : ''}" onclick="setModalTab('questions')">3. Builder</button>
            </div>
            <div class="modal-tab-content ${state.modalTab === 'setup' ? 'active' : ''}">
              <div class="field-grid">
                <div class="field">
                  <label>Starter Preset</label>
                  <select class="select-input" id="file-preset" onchange="setWizardPreset(this.value)">
                    ${WIZARD_PRESETS.map(item => `<option value="${escapeHtml(item.key)}" ${item.key === wizard.presetKey ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                  </select>
                </div>
                <div class="field">
                  <label>Type</label>
                  <select class="select-input" id="file-type" onchange="onFileTypeChange(); syncWizardSummary()">
                    <option value="quiz" ${wizard.type === 'quiz' ? 'selected' : ''}>Quiz</option>
                    <option value="bank" ${wizard.type === 'bank' ? 'selected' : ''}>Question Bank</option>
                  </select>
                </div>
                <div class="field">
                  <label>Folder</label>
                  <select class="select-input" id="file-folder" onchange="syncWizardSummary()">${folderOptions(wizard.folder)}</select>
                </div>
                <div class="field full">
                  <label>Title</label>
                  <input class="text-input" id="file-title" value="${escapeHtml(wizard.title)}" placeholder="L1 Anatomy" oninput="syncWizardSummary()">
                </div>
                <div class="field full">
                  <label>Description</label>
                  <textarea class="text-area" id="file-description" placeholder="${escapeHtml(preset.defaultDescription || 'Short start-screen description')}" oninput="syncWizardSummary()">${escapeHtml(wizard.description)}</textarea>
                </div>
                <div class="field">
                  <label>Filename Override</label>
                  <input class="text-input" id="file-name" value="${escapeHtml(wizard.filename)}" placeholder="Optional: l1-anatomy" oninput="syncWizardSummary()">
                </div>
                <div class="field" id="bank-icon-wrap" style="display:${isBank ? 'grid' : 'none'};">
                  <label>Bank Icon</label>
                  <input class="text-input" id="file-icon" value="${escapeHtml(wizard.icon || preset.bankIcon || '🗃️')}" oninput="syncWizardSummary()">
                </div>
              </div>
              <div class="modal-actions">
                <button class="btn btn-primary" onclick="setModalTab('source')">Next: Source →</button>
              </div>
            </div>
            <div class="modal-tab-content ${state.modalTab === 'source' ? 'active' : ''}">
              <div class="field">
                <label>Question Source</label>
                <select class="select-input" id="file-source-mode" onchange="state.wizard = collectWizardState(); renderNewFileModal()">
                  <option value="manual" ${wizard.sourceMode === 'manual' ? 'selected' : ''}>Manual Builder</option>
                  <option value="json" ${wizard.sourceMode === 'json' ? 'selected' : ''}>Paste JSON</option>
                  <option value="text" ${wizard.sourceMode === 'text' ? 'selected' : ''}>Paste MCQ Text</option>
                  <option value="clone" ${wizard.sourceMode === 'clone' ? 'selected' : ''}>Clone Existing Quiz/Bank</option>
                </select>
              </div>
              ${wizard.sourceMode === 'clone' ? `
                <div class="field" style="margin-top:1rem;">
                  <label>Clone From</label>
                  <select class="select-input" id="file-clone-path">
                    <option value="">Choose a source file...</option>
                    ${cloneOptions}
                  </select>
                  <div class="modal-actions">
                    <button class="btn" onclick="applyCloneSource()">Load Questions</button>
                  </div>
                </div>
              ` : wizard.sourceMode === 'manual' ? `
                <div class="empty-state" style="margin-top:1rem; text-align:left;">Use the next step to edit the visual builder directly.</div>
              ` : `
                <div class="field" style="margin-top:1rem;">
                  <label>${wizard.sourceMode === 'json' ? 'Paste JSON or QUESTIONS block' : 'Paste plain MCQ text'}</label>
                  <textarea class="text-area code" id="file-import-raw" style="height: 220px;" oninput="syncWizardSummary()" ondragover="event.preventDefault(); this.classList.add('dragover')" ondragleave="this.classList.remove('dragover')" ondrop="onModalJsonDrop(event)">${escapeHtml(wizard.sourceRaw || '')}</textarea>
                  <div class="modal-actions">
                    <button class="btn" onclick="applyWizardImport()">Import Into Builder</button>
                  </div>
                </div>
              `}
              <div class="modal-actions" style="margin-top:2rem; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                <button class="btn" onclick="setModalTab('setup')">← Back</button>
                <button class="btn btn-primary" onclick="setModalTab('questions')">Next: Builder →</button>
              </div>
            </div>
            <div class="modal-tab-content ${state.modalTab === 'questions' ? 'active' : ''}">
              <div class="editor-list" id="modal-question-list" style="max-height: 420px; overflow-y: auto; margin-bottom: 1rem; border: 1px solid var(--border); padding: 0.5rem; border-radius: 8px;">
                ${renderModalQuestionList()}
              </div>
              <div class="modal-actions" style="margin-top:2rem; border-top: 1px solid var(--border); padding-top: 1.5rem;">
                <button class="btn" onclick="setModalTab('source')">← Back</button>
                <button class="btn" onclick="addModalQuestion()">Add Question</button>
                <button class="btn" onclick="createFile('keep')">Create and Keep Adding</button>
                <button class="btn btn-primary" onclick="createFile('open')">Create and Open</button>
              </div>
            </div>
        </div>
      `;
      openModal({
        title: 'Create New Quiz or Bank',
        subtitle: 'Use presets, import helpers, and folder-aware defaults to build files faster.',
        body,
        onOpen: () => syncWizardSummary(),
      });
    }

    function setModalTab(tab) {
      syncModalQuestionsFromUI();
      state.wizard = collectWizardState();
      state.modalTab = tab;
      renderNewFileModal();
    }

    function onFileTypeChange() {
      const type = document.getElementById('file-type').value;
      const wrap = document.getElementById('bank-icon-wrap');
      if (wrap) wrap.style.display = type === 'bank' ? 'grid' : 'none';
    }

    function setWizardPreset(key) {
      syncModalQuestionsFromUI();
      state.wizard = collectWizardState();
      state.wizard.presetKey = key;
      const preset = getPresetByKey(key);
      state.wizard.type = preset.type;
      if (!state.wizard.description) state.wizard.description = preset.defaultDescription || '';
      if (!state.modalQuestions.length || state.modalQuestions.every(question => !question.question && !(question.options || []).some(Boolean))) {
        state.modalQuestions = buildStarterQuestions(preset.starterCount);
      }
      rememberRecent('recentPresets', key);
      renderNewFileModal();
    }

    function renderModalQuestionList() {
      if (!state.modalQuestions.length) return '<div class="muted" style="padding:1rem;">No questions added yet.</div>';
      return state.modalQuestions.map((q, i) => `
        <div class="editor-card" style="margin-bottom: 0.5rem; padding: 0.75rem; background: var(--surface2); border: 1px solid var(--border);">
          <div class="editor-card-header" style="margin-bottom: 0.5rem;">
             <div class="editor-card-title">Q${i+1}</div>
             <button class="mini-btn delete" onclick="removeModalQuestion(${i})">Remove Q</button>
          </div>
          <input class="text-input mq-q" data-idx="${i}" value="${escapeHtml(q.question)}" placeholder="Question text" style="margin-bottom:0.5rem;">
          <textarea class="text-area mq-exp" data-idx="${i}" placeholder="Explanation (optional)" style="min-height:80px; margin-bottom:0.5rem;">${escapeHtml(q.explanation || '')}</textarea>
          <div class="option-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            ${(q.options || []).map((opt, oi) => `
              <div class="option-row" style="padding: 0.25rem; display: flex; align-items: center; gap: 0.25rem;">
                <input type="radio" name="mq-correct-${i}" value="${oi}" ${q.correct === oi ? 'checked' : ''}>
                <input class="text-input mq-opt" data-idx="${i}" data-oidx="${oi}" value="${escapeHtml(opt)}" placeholder="Opt ${String.fromCharCode(65+oi)}" style="flex:1;">
                ${q.options.length > 2 ? `<button class="mini-btn delete" onclick="removeModalOption(${i}, ${oi})" title="Remove Option">×</button>` : ''}
              </div>
            `).join('')}
            <button class="mini-btn" onclick="addModalOption(${i})" style="grid-column: span 2; border-style: dashed;">+ Add Option</button>
          </div>
        </div>
      `).join('');
    }

    function syncModalQuestionsFromUI() {
      const questions = [];
      const rows = document.querySelectorAll('#modal-question-list .editor-card');
      rows.forEach((row, i) => {
        const question = row.querySelector('.mq-q').value;
        const explanation = row.querySelector('.mq-exp')?.value || '';
        const options = Array.from(row.querySelectorAll('.mq-opt')).map(input => input.value);
        const correct = parseInt(row.querySelector(`input[name="mq-correct-${i}"]:checked`)?.value || '0');
        questions.push({ question, options, correct, explanation });
      });
      if (questions.length) state.modalQuestions = questions;
    }

    function addModalQuestion() {
      syncModalQuestionsFromUI();
      state.modalQuestions.push({ question: '', options: ['', '', '', ''], correct: 0, explanation: '' });
      renderNewFileModal();
    }

    function removeModalQuestion(index) {
      syncModalQuestionsFromUI();
      state.modalQuestions.splice(index, 1);
      renderNewFileModal();
    }

    function addModalOption(qIdx) {
      syncModalQuestionsFromUI();
      state.modalQuestions[qIdx].options.push('');
      renderNewFileModal();
    }

    function removeModalOption(qIdx, oIdx) {
      syncModalQuestionsFromUI();
      state.modalQuestions[qIdx].options.splice(oIdx, 1);
      if (state.modalQuestions[qIdx].correct >= state.modalQuestions[qIdx].options.length) {
        state.modalQuestions[qIdx].correct = 0;
      }
      renderNewFileModal();
    }

    function onModalJsonDrop(e) {
      e.preventDefault();
      const textarea = document.getElementById('file-import-raw');
      if (!textarea) return;
      textarea.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        textarea.value = event.target.result;
        syncWizardSummary();
        const sourceMode = document.getElementById('file-source-mode')?.value || state.wizard?.sourceMode || '';
        if (/\.json$/i.test(file.name || '') || sourceMode === 'json') {
          applyWizardImport();
        }
      };
      reader.readAsText(file);
    }

    function applyWizardImport() {
      const raw = document.getElementById('file-import-raw')?.value || '';
      const parsed = parseImportedQuestions(raw);
      if (!parsed.questions.length) {
        showToast('No questions could be parsed from the pasted content.', 'warn');
        return;
      }
      state.modalQuestions = parsed.questions.map(question => ({
        question: question.question || '',
        options: question.options || ['', '', '', ''],
        correct: Number(question.correct || 0),
        explanation: question.explanation || '',
      }));
      if (parsed.issues.length) showToast(`Imported ${state.modalQuestions.length} questions with ${parsed.issues.length} warning(s).`, 'warn');
      else showToast(`Imported ${state.modalQuestions.length} questions.`, 'success');
      state.modalTab = 'questions';
      renderNewFileModal();
    }

    async function applyCloneSource() {
      const sourcePath = document.getElementById('file-clone-path')?.value || '';
      if (!sourcePath) {
        showToast('Choose a source quiz or bank first.', 'warn');
        return;
      }
      const payload = await fetchJson(`/admin/load-file?path=${encodeURIComponent(sourcePath)}`);
      state.modalQuestions = clone(payload.meta?.questions || []).map(question => ({
        question: question.question || '',
        options: question.options || ['', '', '', ''],
        correct: Number(question.correct || 0),
        explanation: question.explanation || '',
      }));
      state.modalTab = 'questions';
      renderNewFileModal();
      showToast(`Loaded ${state.modalQuestions.length} questions from ${sourcePath}.`, 'success');
    }

    function openMoveModal() {
      if (!state.currentFile) return;
      const current = state.currentFile.split('/').pop().replace(/\.html$/i, '');
      const parent = state.currentFile.includes('/') ? state.currentFile.slice(0, state.currentFile.lastIndexOf('/')) : '.';
      openModal({
        title: 'Move or Rename File',
        subtitle: 'The file contents stay intact. Existing UIDs are not rewritten automatically.',
        body: `
          <div class="field-grid">
            <div class="field">
              <label>Target Folder</label>
              <select class="select-input" id="move-folder">${folderOptions(parent || '.') }</select>
            </div>
            <div class="field">
              <label>New Filename</label>
              <input class="text-input" id="move-name" value="${escapeHtml(current)}">
              <small>Use a kebab-case name without <code>.html</code>.</small>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="moveFile()">Apply</button>
          </div>
        `,
      });
    }

    function openDeleteModal() {
      if (!state.currentFile) return;
      openModal({
        title: 'Delete File',
        subtitle: 'This removes the file from disk. Run sync afterward to refresh generated indexes.',
        body: `
          <div class="empty-state" style="text-align:left;">
            <strong>${escapeHtml(state.currentFile)}</strong><br>
            Delete this file from the project?
          </div>
          <div class="modal-actions">
            <button class="btn btn-danger" onclick="deleteFile()">Delete File</button>
          </div>
        `,
      });
    }

    function openDuplicateModal(targetFolder = '', sourcePath = '') {
      const source = sourcePath || state.currentFile;
      if (!source) return;
      const defaultFolder = targetFolder || (source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '.');
      const currentStem = source.split('/').pop().replace(/\.html$/i, '');
      openModal({
        title: 'Duplicate File',
        subtitle: 'Creates a new file and regenerates the UID for quiz/bank duplicates.',
        body: `
          <div class="field-grid">
            <div class="field full">
              <label>Source File</label>
              <input class="text-input" value="${escapeHtml(source)}" readonly>
            </div>
            <div class="field">
              <label>Target Folder</label>
              <select class="select-input" id="duplicate-folder">${folderOptions(defaultFolder)}</select>
            </div>
            <div class="field">
              <label>New Filename</label>
              <input class="text-input" id="duplicate-name" value="${escapeHtml(currentStem)}-copy">
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" onclick="duplicateFile('${escapeHtml(source)}')">Create Duplicate</button>
          </div>
        `,
      });
    }

    function providerDisplayName(provider) {
      return ({ github: 'GitHub Pages', netlify: 'Netlify', vercel: 'Vercel' })[provider] || 'Not configured';
    }

    function deployTokenPlaceholder(provider) {
      return ({ github: 'ghp_xxxxxxxxxxxxxxxxxxxx', netlify: 'nfp_xxxxxxxxxxxxxxxxxxxx', vercel: 'Vercel access token' })[provider] || 'Provider token';
    }

    function openDeployModal() {
      const git = state.projectState?.git || {};
      const deploy = state.projectState?.deploy || {};
      const provider = deploy.provider || 'github';
      const commitSuggestion = state.currentFile ? `Update ${state.currentFile}` : 'Update quiz content';
      const changed = (git.changedPaths || []).map(item => `
        <div class="badge" title="${escapeHtml(item.path)}">
          <span class="${item.status === 'M' ? 'status-info' : 'status-good'}">${escapeHtml(item.status)}</span> 
          ${escapeHtml(item.path.split('/').pop())}
        </div>
      `).join('') || '<div class="muted">No changed paths.</div>';
      
      openModal({
        title: 'Deploy Project',
        subtitle: deploy.provider ? `${providerDisplayName(deploy.provider)}${deploy.inferred ? ' (inferred from Git remote)' : ''}` : 'Choose a provider for this project',
        body: `
          <div class="panel-grid">
            ${renderMetaCard('Provider', providerDisplayName(provider))}
            ${renderMetaCard('Status', git.dirtyCount ? `${git.dirtyCount} changes` : 'Clean')}
            ${renderMetaCard('Live URL', deploy.liveUrl || 'Not published yet')}
          </div>

          ${deploy.provider ? `
            <input type="hidden" id="deploy-provider" value="${escapeHtml(provider)}">
          ` : `
            <div class="field" style="margin-top:1rem;">
              <label>Provider</label>
              <select class="select-input" id="deploy-provider" onchange="renderDeployProviderFields()">
                <option value="github">GitHub Pages</option>
                <option value="netlify">Netlify</option>
                <option value="vercel">Vercel</option>
              </select>
            </div>
            <div id="deploy-provider-fields"></div>
          `}
          
          <div class="field" style="margin-top: 1rem;">
            <label>Changed Files</label>
            <div class="badge-row" style="max-height: 120px; overflow: auto; padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px;">
              ${changed}
            </div>
          </div>

          <div class="field" style="margin-top: 1rem;">
            <label>Commit Message</label>
            <input class="text-input" id="commit-message" value="${escapeHtml(commitSuggestion)}" placeholder="e.g. Add L10 PCOS quiz">
            <small>Used for GitHub Pages commits. Netlify and Vercel deploy the current files directly.</small>
          </div>

          <div class="field" style="margin-top: 1rem;">
            <label id="provider-token-label">${escapeHtml(providerDisplayName(provider))} Token</label>
            <input class="text-input" type="password" id="provider-token" placeholder="${escapeHtml(deployTokenPlaceholder(provider))}" autocomplete="off">
            <small>Session only. The dashboard sends this token to the provider API and never saves it.</small>
          </div>

          <div class="modal-actions" style="margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
            <div style="flex: 1; display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="ghost-btn" onclick="verifyProviderToken()">Verify Token</button>
              <button class="ghost-btn" onclick="commitChanges()">Commit Only</button>
              <button class="ghost-btn" onclick="runSync()" style="border-color: var(--accent); color: var(--accent);">Run Sync Now</button>
            </div>
            <button class="btn btn-primary" onclick="providerDeploy()">Sync & Deploy</button>
          </div>
        `,
        onOpen: () => {
          if (!deploy.provider) renderDeployProviderFields();
        },
      });
    }

    function openGitModal() {
      openDeployModal();
    }

    function renderDeployProviderFields() {
      const provider = document.getElementById('deploy-provider')?.value || 'github';
      const host = document.getElementById('deploy-provider-fields');
      if (!host) return;
      if (provider === 'github') {
        host.innerHTML = `
          <div class="field-grid" style="margin-top:1rem;">
            <div class="field"><label>GitHub Owner</label><input class="text-input" id="deploy-gh-owner" placeholder="username or org"></div>
            <div class="field"><label>Repository</label><input class="text-input" id="deploy-gh-repo" value="${escapeHtml((state.projectState?.projectName || '').replace(/ Quiz$/, ''))}"></div>
            <div class="field"><label>Branch</label><input class="text-input" id="deploy-gh-branch" value="${escapeHtml(state.projectState?.git?.branch || 'main')}"></div>
          </div>
        `;
      } else if (provider === 'netlify') {
        host.innerHTML = `
          <div class="field-grid" style="margin-top:1rem;">
            <div class="field"><label>Netlify Site ID</label><input class="text-input" id="deploy-netlify-site-id" placeholder="site UUID or site name"></div>
            <div class="field"><label>Site Name</label><input class="text-input" id="deploy-netlify-site-name" value="${escapeHtml(state.projectState?.projectName || '')}"></div>
          </div>
        `;
      } else {
        host.innerHTML = `
          <div class="field-grid" style="margin-top:1rem;">
            <div class="field"><label>Vercel Project Name</label><input class="text-input" id="deploy-vercel-project-name" value="${escapeHtml(slugifyClient(state.projectState?.projectName || 'quiz-project'))}"></div>
          </div>
        `;
      }
      const tokenLabel = document.getElementById('provider-token-label');
      const token = document.getElementById('provider-token');
      if (tokenLabel) tokenLabel.textContent = providerDisplayName(provider) + ' Token';
      if (token) token.placeholder = deployTokenPlaceholder(provider);
    }

    function collectDeployMetadata() {
      const existing = state.projectState?.deploy || {};
      const provider = document.getElementById('deploy-provider')?.value || existing.provider || 'github';
      if (existing.provider === provider) return { ...existing };
      if (provider === 'github') {
        const owner = document.getElementById('deploy-gh-owner')?.value.trim();
        const repo = document.getElementById('deploy-gh-repo')?.value.trim();
        const branch = document.getElementById('deploy-gh-branch')?.value.trim() || 'main';
        return {
          provider, projectName: repo, liveUrl: owner && repo ? `https://${owner}.github.io/${repo}/` : '',
          providerUrl: owner && repo ? `https://github.com/${owner}/${repo}` : '',
          github: { owner, repo, branch },
        };
      }
      if (provider === 'netlify') {
        const siteId = document.getElementById('deploy-netlify-site-id')?.value.trim();
        const siteName = document.getElementById('deploy-netlify-site-name')?.value.trim();
        return {
          provider, projectName: siteName || siteId, liveUrl: siteName ? `https://${siteName}.netlify.app` : '',
          providerUrl: siteName ? `https://app.netlify.com/sites/${siteName}/overview` : '',
          netlify: { siteId, siteName },
        };
      }
      const projectName = document.getElementById('deploy-vercel-project-name')?.value.trim();
      return {
        provider, projectName, liveUrl: '', providerUrl: '',
        vercel: { projectName, deploymentUrl: '' },
      };
    }

    async function verifyProviderToken() {
      const provider = document.getElementById('deploy-provider')?.value || state.projectState?.deploy?.provider || 'github';
      const token = document.getElementById('provider-token')?.value.trim();
      if (!token) { showToast('Provider token is required.', 'warn'); return; }
      const result = await fetchJson('/admin/provider-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, token }),
      });
      showToast(result.message || 'Token verified.', 'success');
      logActivity('Provider token verified', provider, 'success');
    }

    async function providerDeploy() {
      const provider = document.getElementById('deploy-provider')?.value || state.projectState?.deploy?.provider || 'github';
      const token = document.getElementById('provider-token')?.value.trim();
      const message = document.getElementById('commit-message')?.value.trim() || 'Update quiz project files';
      if (!token) { showToast('Provider token is required.', 'warn'); return; }
      const metadata = collectDeployMetadata();
      showToast('Starting provider deploy...', 'info');
      logActivity('Deploy started', providerDisplayName(provider), 'info');
      try {
        const result = await fetchJson('/admin/provider-deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, token, message, metadata }),
        });
        showToast(result.message || 'Deploy completed.', 'success');
        logActivity('Deploy completed', `${result.liveUrl || ''}\n${result.syncOutput || ''}`, 'success');
        await refreshWorkspace({ preserveCurrent: true });
        closeModal();
      } catch (err) {
        showToast('Deploy failed. Check activity log.', 'error');
        logActivity('Deploy failed', err.message || String(err), 'error');
      }
    }

    async function createFolder() {
      const name = document.getElementById('folder-path').value;
      const title = document.getElementById('folder-title').value;
      const description = document.getElementById('folder-description').value;
      const result = await fetchJson('/admin/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, title, description }),
      });
      closeModal();
      showToast(result.message || 'Folder created.', 'success');
      logActivity('Created folder', result.path || name, 'success');
      if (result.path) {
        const parts = result.path.split('/');
        let current = '';
        for (const p of parts) {
          current = current ? `${current}/${p}` : p;
          state.openFolders.add(current);
        }
        saveUiPrefs();
      }
      await runSync({ silentToast: true, preserveCurrent: false });
    }

    async function createFile(mode = 'open') {
      syncModalQuestionsFromUI();
      const wizard = collectWizardState();
      const type = wizard.type;
      const folder = wizard.folder;
      const title = wizard.title;
      const description = wizard.description;
      const filename = wizard.filename;
      const icon = wizard.icon || '🗃️';
      const questions = state.modalQuestions;

      if (!title) {
        showToast('Title is required.', 'warn');
        setModalTab('setup');
        return;
      }

      if (validateQuestionListClient(questions).some(issue => issue.level === 'error')) {
        showToast('Fix the wizard validation issues before creating the file.', 'warn');
        setModalTab('questions');
        return;
      }

      const result = await fetchJson('/admin/create-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, folder, title, description, filename, icon, questions }),
      });
      showToast(result.message || 'File created.', 'success');
      logActivity('Created file', result.path || title, 'success');
      rememberRecent('recentFolders', folder);
      rememberRecent('recentPresets', wizard.presetKey);
      
      // Expand target folder before refresh so it shows up
      if (folder && folder !== '.') {
        const parts = folder.split('/');
        let current = '';
        for (const p of parts) {
          current = current ? `${current}/${p}` : p;
          state.openFolders.add(current);
        }
        saveUiPrefs();
      }
      
      await runSync({ silentToast: true, preserveCurrent: false });
      if (result.path) {
        if (mode === 'open') {
          closeModal();
          await loadFile(result.path);
          setTimeout(() => {
            const activeRow = document.querySelector('.tree-row.active');
            if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        } else {
          state.wizard = { ...wizard, title: '', filename: '', sourceRaw: '' };
          state.modalQuestions = buildStarterQuestions(getPresetByKey(wizard.presetKey).starterCount);
          renderNewFileModal();
          setModalTab('setup');
        }
      }
    }

    async function duplicateFile(sourcePath) {
      const folder = document.getElementById('duplicate-folder')?.value || '.';
      const filename = document.getElementById('duplicate-name')?.value || '';
      const result = await fetchJson('/admin/duplicate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: sourcePath, folder, filename }),
      });
      closeModal();
      showToast(result.message || 'Duplicate created.', 'success');
      logActivity('Duplicated file', `${sourcePath}\n→ ${result.path}`, 'success');
      await runSync({ silentToast: true, preserveCurrent: false });
      if (result.path) await loadFile(result.path);
    }

    async function moveFile() {
      const folder = document.getElementById('move-folder').value;
      const filename = document.getElementById('move-name').value;
      const previous = state.currentFile;
      const result = await fetchJson('/admin/move-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: state.currentFile, folder, filename }),
      });
      closeModal();
      showToast(result.message || 'File moved.', 'success');
      logActivity('Moved file', `${previous}\n→ ${result.path}`, 'success');
      state.currentFile = result.path;
      await runSync({ silentToast: true, preserveCurrent: false });
      await loadFile(result.path, { keepTab: false });
    }

    async function deleteFile() {
      const deleted = state.currentFile;
      const result = await fetchJson('/admin/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: state.currentFile }),
      });
      closeModal();
      showToast(result.message || 'File deleted.', 'success');
      logActivity('Deleted file', deleted, 'warn');
      state.currentFile = null;
      state.currentData = null;
      setDirty(false);
      await runSync({ silentToast: true, preserveCurrent: false });
      renderOverview();
    }

    async function executeDeleteFolder(folderPath) {
      const result = await fetchJson('/admin/delete-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
      showToast(result.message || 'Folder deleted.', 'success');
      logActivity('Deleted folder', folderPath + '\n' + (result.message || ''), 'warn');
      if (state.currentFile && state.currentFile.startsWith(folderPath + '/')) {
        state.currentFile = null;
        state.currentData = null;
        state.loadedMeta = null;
        state.validation = null;
        setDirty(false);
      }
      await runSync({ silentToast: true, preserveCurrent: false });
    }

    async function commitChanges() {
      const message = document.getElementById('commit-message').value;
      const result = await fetchJson('/admin/git-commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      showToast(result.message || 'Commit created.', 'success');
      logActivity('Git commit', result.output || result.message || '', 'success');
      await refreshWorkspace({ preserveCurrent: true });
      closeModal();
    }

    async function pullChanges() {
      const result = await fetchJson('/admin/git-pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      showToast(result.message || 'Pull completed.', 'success');
      logActivity('Git pull', result.output || result.message || '', 'success');
      await refreshWorkspace({ preserveCurrent: true });
      closeModal();
    }

    async function pushChanges() {
      const result = await fetchJson('/admin/git-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      showToast(result.message || 'Push completed.', 'success');
      logActivity('Git push', result.output || result.message || '', 'success');
      await refreshWorkspace({ preserveCurrent: true });
      closeModal();
    }

    async function gitSync() {
      const message = document.getElementById('commit-message').value;
      if (!message) {
        showToast('Commit message is required for sync.', 'warn');
        return;
      }
      
      showToast('Starting Git Sync...', 'info');
      logActivity('Git Sync started', 'Pulling, committing, and pushing...', 'info');
      
      try {
        // 1. Pull
        const pullRes = await fetchJson('/admin/git-pull', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        logActivity('Git Pull result', pullRes.output || pullRes.message, 'success');
        
        // 2. Commit (also does git add -A)
        const commitRes = await fetchJson('/admin/git-commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        logActivity('Git Commit result', commitRes.output || commitRes.message, 'success');
        
        // 3. Push
        const pushRes = await fetchJson('/admin/git-push', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        logActivity('Git Push result', pushRes.output || pushRes.message, 'success');
        
        showToast('Git Sync completed!', 'success');
        await refreshWorkspace({ preserveCurrent: true });
        closeModal();
      } catch (err) {
        showToast('Git Sync failed. Check activity log.', 'error');
        logActivity('Git Sync error', err.message || String(err), 'error');
      }
    }

    function getQuickOpenResults(query = '') {
      const lowered = String(query || '').toLowerCase().trim();
      const list = lowered
        ? state.files.filter(file => [file.path, file.title, file.uid, file.description].join(' ').toLowerCase().includes(lowered))
        : [...state.files];
      return list.slice(0, 18);
    }

    function renderQuickOpenResults() {
      const host = document.getElementById('quick-open-results');
      if (!host) return;
      const query = document.getElementById('quick-open-input')?.value || '';
      state.quickOpenQuery = query;
      const rows = getQuickOpenResults(query);
      host.innerHTML = rows.length ? rows.map(file => `
        <button class="meta-card" style="text-align:left; cursor:pointer;" onclick="closeModal(); requestLoadFile('${escapeHtml(file.path)}')">
          <div class="meta-label">${escapeHtml(file.type)}</div>
          <div class="meta-value">${escapeHtml(file.title || file.name)}</div>
          <div class="muted" style="margin-top:0.35rem;">${escapeHtml(file.path)}</div>
        </button>
      `).join('') : '<div class="empty-state">No files match this search.</div>';
    }

    function openQuickOpenModal() {
      openModal({
        title: 'Quick Open',
        subtitle: 'Jump to a file by path, title, or UID.',
        body: `
          <div class="field">
            <label>Search</label>
            <input class="text-input" id="quick-open-input" value="${escapeHtml(state.quickOpenQuery || '')}" placeholder="Type to filter files..." oninput="renderQuickOpenResults()">
          </div>
          <div id="quick-open-results" style="display:grid; gap:0.65rem; margin-top:1rem; max-height:60vh; overflow:auto;"></div>
        `,
        onOpen: () => {
          document.getElementById('quick-open-input')?.focus();
          renderQuickOpenResults();
        },
      });
    }

    function setupKeyboard() {
      window.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          if (state.currentFile) {
            event.preventDefault();
            saveFile();
          }
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          openQuickOpenModal();
          return;
        }
        if (event.key === 'Escape' && state.modalOpen) {
          closeModal();
          return;
        }
        if (event.key === 'Escape' && state.contextMenu) {
          closeContextMenu();
          return;
        }
        if (event.key === '/' && !state.modalOpen) {
          const tag = document.activeElement?.tagName?.toLowerCase();
          if (!['input', 'textarea', 'select'].includes(tag)) {
            event.preventDefault();
            document.getElementById('file-search')?.focus();
          }
        }
      });

      window.addEventListener('beforeunload', (event) => {
        if (!state.dirty) return;
        event.preventDefault();
        event.returnValue = '';
      });

      document.getElementById('modal').addEventListener('click', (event) => {
        if (event.target.id === 'modal') closeModal();
      });
      document.addEventListener('click', () => closeContextMenu());
      window.addEventListener('scroll', () => closeContextMenu(), true);
      document.addEventListener('contextmenu', (event) => {
        if (!event.target.closest('.tree-row') && !event.target.closest('.panel-header-main')) {
          closeContextMenu();
        }
      });
    }

    async function boot() {
      restoreTheme();
      setupKeyboard();
      renderActivity();
      await refreshWorkspace({ preserveCurrent: false });
      const lastFile = localStorage.getItem('admin-last-file');
      if (lastFile && state.files.some(file => file.path === lastFile)) {
        await loadFile(lastFile, { silent: true });
      }
      showToast('Dashboard ready. Search files with /, quick-open with Ctrl+K, and save with Ctrl+S.', 'info');
    }

    boot().catch((error) => {
      console.error(error);
      showToast(error.message || 'Failed to load dashboard.', 'error');
      logActivity('Dashboard error', error.message || String(error), 'error');
    });
  </script>
</body>
</html>
"""


def is_relative_to(path: Path, base: Path) -> bool:
    try:
        path.relative_to(base)
        return True
    except ValueError:
        return False


def to_posix(path: Path) -> str:
    return path.as_posix()


def normalize_rel_path(raw_path: str) -> str:
    cleaned = str(raw_path or "").strip().replace("\\", "/").strip("/")
    return "." if cleaned in {"", "."} else cleaned


def resolve_project_path(raw_path: str, *, must_exist: bool = False, file_only: bool = False) -> Path:
    rel = normalize_rel_path(raw_path)
    candidate = PROJECT_ROOT if rel == "." else (PROJECT_ROOT / rel).resolve()
    if not is_relative_to(candidate, PROJECT_ROOT):
        raise ValueError("Path escapes the project root.")
    if must_exist and not candidate.exists():
        raise FileNotFoundError("Path does not exist.")
    if file_only and candidate.suffix.lower() not in EDITABLE_SUFFIXES:
        raise ValueError("Only HTML files are editable through this dashboard.")
    return candidate


def relative_path(path: Path) -> str:
    return to_posix(path.relative_to(PROJECT_ROOT))


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIRS or name.startswith(".")


def slugify(text: str, *, default: str = "untitled") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug or default


def snakeify(text: str, *, default: str = "item") -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    slug = re.sub(r"_{2,}", "_", slug)
    return slug or default


def title_from_segment(segment: str) -> str:
    segment = segment.replace(".", " ").replace("-", " ").replace("_", " ")
    words = [word for word in segment.split() if word]
    return " ".join(word.capitalize() for word in words) or "Untitled"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def iter_html_files() -> list[Path]:
    html_files: list[Path] = []
    for root, dirs, files in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if not should_skip_dir(d)]
        for filename in files:
            if filename.lower().endswith(".html"):
                html_files.append(Path(root) / filename)
    return sorted(html_files, key=lambda item: relative_path(item).lower())


def scan_folders() -> list[str]:
    folders = ["."]
    for root, dirs, _files in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if not should_skip_dir(d)]
        rel = Path(root).relative_to(PROJECT_ROOT)
        if str(rel) != ".":
            folders.append(to_posix(rel))
    return sorted(set(folders))


def extract_assigned_literal(content: str, const_name: str, open_char: str, close_char: str) -> str | None:
    match = re.search(rf"const\s+{re.escape(const_name)}\s*=\s*{re.escape(open_char)}", content)
    if not match:
        return None
    start = content.find(open_char, match.start())
    if start == -1:
        return None
    depth = 0
    for index in range(start, len(content)):
        char = content[index]
        if char == open_char:
            depth += 1
        elif char == close_char:
            depth -= 1
            if depth == 0:
                return content[start : index + 1]
    return None


def sanitize_jsonish(block: str) -> str:
    block = re.sub(r"(?<!:)//.*", "", block)
    block = re.sub(r"/\*.*?\*/", "", block, flags=re.DOTALL)
    block = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', block)
    block = re.sub(
        r"'([^'\\]*(?:\\.[^'\\]*)*)'",
        lambda match: '"' + match.group(1).replace('"', '\\"') + '"',
        block,
    )
    block = re.sub(r",\s*([\]}])", r"\1", block)
    return block


def parse_jsonish(block: str) -> Any:
    return json.loads(block)


def parse_literal(content: str, const_name: str, open_char: str, close_char: str) -> Any | None:
    block = extract_assigned_literal(content, const_name, open_char, close_char)
    if block is None:
        return None
    try:
        return parse_jsonish(block)
    except json.JSONDecodeError:
        try:
            return parse_jsonish(sanitize_jsonish(block))
        except json.JSONDecodeError:
            return None


def parse_file_metadata(content: str) -> dict[str, Any]:
    quiz_config = parse_literal(content, "QUIZ_CONFIG", "{", "}")
    if isinstance(quiz_config, dict):
        questions = parse_literal(content, "QUESTIONS", "[", "]") or []
        return {
            "type": "quiz",
            "uid": quiz_config.get("uid"),
            "title": quiz_config.get("title"),
            "description": quiz_config.get("description"),
            "question_count": len(questions),
            "config": quiz_config,
            "questions": questions,
        }

    bank_config = parse_literal(content, "BANK_CONFIG", "{", "}")
    if isinstance(bank_config, dict):
        bank_questions = parse_literal(content, "QUESTION_BANK", "[", "]") or []
        return {
            "type": "bank",
            "uid": bank_config.get("uid"),
            "title": bank_config.get("title"),
            "description": bank_config.get("description"),
            "icon": bank_config.get("icon"),
            "question_count": len(bank_questions),
            "config": bank_config,
            "questions": bank_questions,
        }

    quizzes = parse_literal(content, "QUIZZES", "[", "]")
    if isinstance(quizzes, list):
        title_match = re.search(r"<title>(.*?)</title>", content, re.IGNORECASE | re.DOTALL)
        hero_match = re.search(
            r'<header class="hero">\s*<h1>(.*?)</h1>\s*<p>(.*?)</p>',
            content,
            re.IGNORECASE | re.DOTALL,
        )
        return {
            "type": "index",
            "title": title_match.group(1).strip() if title_match else None,
            "hero_title": hero_match.group(1).strip() if hero_match else "",
            "description": hero_match.group(2).strip() if hero_match else "",
            "question_count": len(quizzes),
            "quizzes": quizzes,
        }

    return {"type": "html", "question_count": 0}


def build_issue(level: str, message: str, *, field: str = "", code: str = "", index: int | None = None) -> dict[str, Any]:
    issue: dict[str, Any] = {"level": level, "message": message}
    if field:
        issue["field"] = field
    if code:
        issue["code"] = code
    if index is not None:
        issue["index"] = index
    return issue


def normalize_question_payload(question: Any) -> dict[str, Any]:
    if not isinstance(question, dict):
        return {"question": "", "options": [], "correct": 0, "explanation": ""}
    options = question.get("options")
    if not isinstance(options, list):
        options = []
    return {
        "question": str(question.get("question", "") or ""),
        "options": [str(option or "") for option in options],
        "correct": question.get("correct", 0),
        "explanation": str(question.get("explanation", "") or ""),
    }


def validate_question_list(questions: Any, *, field_prefix: str = "questions") -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    if not isinstance(questions, list):
        return [build_issue("error", "Question list could not be parsed.", field=field_prefix, code="questions_invalid")]

    if not questions:
        issues.append(build_issue("warning", "This file has no questions yet.", field=field_prefix, code="questions_empty"))
        return issues

    for index, raw_question in enumerate(questions):
        question = normalize_question_payload(raw_question)
        question_text = question["question"].strip()
        options = [option.strip() for option in question["options"]]
        correct = question["correct"]
        if not question_text:
            issues.append(
                build_issue(
                    "error",
                    f"Question {index + 1} is missing its prompt.",
                    field=f"{field_prefix}.{index}.question",
                    code="question_missing_text",
                    index=index,
                )
            )
        if len(options) < 2:
            issues.append(
                build_issue(
                    "error",
                    f"Question {index + 1} needs at least 2 options.",
                    field=f"{field_prefix}.{index}.options",
                    code="question_too_few_options",
                    index=index,
                )
            )
        elif any(not option for option in options):
            issues.append(
                build_issue(
                    "warning",
                    f"Question {index + 1} has blank option text.",
                    field=f"{field_prefix}.{index}.options",
                    code="question_blank_option",
                    index=index,
                )
            )
        try:
            correct_idx = int(correct)
        except (TypeError, ValueError):
            correct_idx = -1
        if correct_idx < 0 or correct_idx >= len(options):
            issues.append(
                build_issue(
                    "error",
                    f"Question {index + 1} has an invalid correct answer index.",
                    field=f"{field_prefix}.{index}.correct",
                    code="question_invalid_correct",
                    index=index,
                )
            )
    return issues


def is_external_href(url: str) -> bool:
    lowered = url.lower()
    return lowered.startswith(("http://", "https://", "mailto:", "tel:", "javascript:", "#"))


def resolve_index_target(base_folder: str, url: str) -> Path | None:
    target = re.split(r"[?#]", str(url or "").strip(), maxsplit=1)[0]
    if not target or is_external_href(target):
        return None
    target_path = (Path(base_folder) / target) if base_folder not in {"", "."} else Path(target)
    if target.endswith("/"):
        target_path = target_path / "index.html"
    candidate = (PROJECT_ROOT / target_path).resolve()
    if not is_relative_to(candidate, PROJECT_ROOT):
        return None
    if candidate.is_dir():
        candidate = candidate / "index.html"
    return candidate


def detect_uid_change(original_uid: str, new_uid: str) -> bool:
    return bool(original_uid and new_uid and original_uid != new_uid)


def validate_dashboard_content(path: str, content: str, *, original_uid: str = "") -> dict[str, Any]:
    normalized_path = normalize_rel_path(path or ".")
    meta = parse_file_metadata(content)
    issues: list[dict[str, Any]] = []
    meta_type = meta.get("type", "html")

    if meta_type == "quiz":
        if "/* [QUIZ_CONFIG_START] */" not in content or "/* [QUIZ_CONFIG_END] */" not in content:
            issues.append(build_issue("error", "Quiz config markers are missing.", field="config", code="quiz_config_markers"))
        if "/* [QUESTIONS_START] */" not in content or "/* [QUESTIONS_END] */" not in content:
            issues.append(build_issue("error", "Question markers are missing.", field="questions", code="quiz_question_markers"))
        uid = str(meta.get("uid") or "").strip()
        if not uid:
            issues.append(build_issue("error", "Quiz UID is required.", field="uid", code="uid_missing"))
        elif detect_uid_change(original_uid, uid):
            issues.append(build_issue("warning", "UID changed from the saved file. This can orphan learner progress.", field="uid", code="uid_changed"))
        issues.extend(validate_question_list(meta.get("questions"), field_prefix="questions"))
    elif meta_type == "bank":
        if "/* [BANK_CONFIG_START] */" not in content or "/* [BANK_CONFIG_END] */" not in content:
            issues.append(build_issue("error", "Bank config markers are missing.", field="config", code="bank_config_markers"))
        if "/* [QUESTION_BANK_START] */" not in content or "/* [QUESTION_BANK_END] */" not in content:
            issues.append(build_issue("error", "Question bank markers are missing.", field="questions", code="bank_question_markers"))
        uid = str(meta.get("uid") or "").strip()
        if not uid:
            issues.append(build_issue("error", "Bank UID is required.", field="uid", code="uid_missing"))
        elif detect_uid_change(original_uid, uid):
            issues.append(build_issue("warning", "UID changed from the saved file. This can orphan learner progress.", field="uid", code="uid_changed"))
        issues.extend(validate_question_list(meta.get("questions"), field_prefix="questions"))
    elif meta_type == "index":
        quizzes = meta.get("quizzes")
        if not isinstance(quizzes, list):
            issues.append(build_issue("error", "QUIZZES could not be parsed.", field="quizzes", code="index_cards_invalid"))
        else:
            base_folder = "." if "/" not in normalized_path else normalized_path.rsplit("/", 1)[0]
            for index, quiz in enumerate(quizzes):
                if not isinstance(quiz, dict):
                    issues.append(build_issue("error", f"Card {index + 1} is invalid.", field=f"quizzes.{index}", code="index_card_invalid", index=index))
                    continue
                url = str(quiz.get("url", "") or "").strip()
                if not url:
                    issues.append(build_issue("warning", f"Card {index + 1} is missing a URL.", field=f"quizzes.{index}.url", code="index_url_missing", index=index))
                    continue
                target = resolve_index_target(base_folder, url)
                if target is None:
                    continue
                if not target.exists():
                    issues.append(
                        build_issue(
                            "warning",
                            f"Card {index + 1} points to a missing file: {url}",
                            field=f"quizzes.{index}.url",
                            code="index_url_missing_target",
                            index=index,
                        )
                    )

    errors = [issue for issue in issues if issue["level"] == "error"]
    warnings = [issue for issue in issues if issue["level"] == "warning"]
    return {"meta": meta, "errors": errors, "warnings": warnings}


def infer_icon(meta_type: str, name: str) -> str:
    if name == "index.html" or meta_type == "index":
        return "🏠"
    if meta_type == "quiz":
        return "📝"
    if meta_type == "bank":
        return "🗃️"
    return "📄"


def collect_file_records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for html_path in iter_html_files():
        content = read_text(html_path)
        meta = parse_file_metadata(content)
        rel = relative_path(html_path)
        stat = html_path.stat()
        records.append(
            {
                "path": rel,
                "name": html_path.name,
                "folder": to_posix(html_path.parent.relative_to(PROJECT_ROOT))
                if html_path.parent != PROJECT_ROOT
                else ".",
                "type": meta.get("type", "html"),
                "title": meta.get("title") or html_path.stem,
                "description": meta.get("description") or "",
                "uid": meta.get("uid") or "",
                "question_count": meta.get("question_count", 0),
                "icon": infer_icon(meta.get("type", "html"), html_path.name),
                "modified": stat.st_mtime,
            }
        )
    records.sort(key=lambda record: record["path"].lower())
    return records


def duplicate_file_content(source_content: str, destination_folder: str, destination_stem: str) -> tuple[str, str | None]:
    meta = parse_file_metadata(source_content)
    new_uid = derive_uid(destination_folder, destination_stem)
    if meta.get("type") == "quiz":
        config = copy.deepcopy(meta.get("config") or {})
        config["uid"] = new_uid
        config["title"] = config.get("title") or title_from_segment(destination_stem)
        content = create_quiz_html(config, copy.deepcopy(meta.get("questions") or []))
        return content, new_uid
    if meta.get("type") == "bank":
        config = copy.deepcopy(meta.get("config") or {})
        config["uid"] = new_uid
        config["title"] = config.get("title") or title_from_segment(destination_stem)
        config["icon"] = config.get("icon") or "🗃️"
        content = create_bank_html(config, copy.deepcopy(meta.get("questions") or []))
        return content, new_uid
    return source_content, None


def find_existing_uids() -> set[str]:
    uids: set[str] = set()
    for path in iter_html_files():
        meta = parse_file_metadata(read_text(path))
        uid = meta.get("uid")
        if uid:
            uids.add(uid)
    return uids


def derive_uid(folder: str, stem: str) -> str:
    parts = [] if folder in {"", "."} else folder.split("/")
    parts.append(stem)
    return snakeify("_".join(parts), default="quiz_file")


def ensure_unique_html_path(folder_path: Path, stem: str) -> Path:
    candidate = folder_path / f"{stem}.html"
    counter = 2
    while candidate.exists():
        candidate = folder_path / f"{stem}-{counter}.html"
        counter += 1
    return candidate


def relative_prefix(folder_rel: str) -> str:
    if folder_rel in {"", "."}:
        return ""
    depth = len(Path(folder_rel).parts)
    return "../" * depth


def build_index_page_context(folder_rel: str, title: str = "", description: str = "") -> dict[str, str]:
    parts = [] if folder_rel in {"", "."} else folder_rel.split("/")
    prefix = relative_prefix(folder_rel)
    if not parts:
        page_title = "MU61 Quiz"
        hero_title = "Select your <span>subject</span>"
        hero_description = description or "Choose a section to begin."
        topbar_title = "MU61 Quiz"
        back_link = ""
    elif len(parts) == 1:
        subject = title or title_from_segment(parts[0])
        page_title = f"MU61 Quiz - {subject}"
        hero_title = f"Select your <span>{subject} exam</span>"
        hero_description = description or f"{subject} quizzes and resources."
        topbar_title = page_title
        back_link = f'<a href="../index.html" class="icon-btn back-btn" title="Back">←</a>'
    else:
        subject = title_from_segment(parts[0])
        scope = title or " ".join(title_from_segment(part) for part in parts[1:])
        page_title = f"MU61 Quiz - {subject} {scope}"
        hero_title = f"Select your <span>{subject} {scope}</span>"
        hero_description = description or f"{scope} quizzes and folders for {subject}."
        topbar_title = page_title
        back_link = f'<a href="../index.html" class="icon-btn back-btn" title="Back">←</a>'

    return {
        "page_title": page_title,
        "hero_title": hero_title,
        "hero_description": hero_description,
        "topbar_title": topbar_title,
        "prefix": prefix,
        "back_link": back_link,
    }


def create_quiz_html(config: dict[str, Any], questions: list[dict[str, Any]] | None = None) -> str:
    questions = questions or [
        {
            "question": "Sample question?",
            "options": ["A", "B", "C", "D"],
            "correct": 0,
            "explanation": "Sample explanation.",
        }
    ]
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
(function(){{var t=localStorage.getItem('quiz-theme')||'dark';var s=document.createElement('style');
s.textContent='html,body{{background:'+(t==='light'?'#f3f0eb':'#0d1117')+';color:'+(t==='light'?'#1c1917':'#e6edf3')+';margin:0;padding:0;overflow:hidden;height:100%}}';
document.head.appendChild(s)}})();
</script>
<title>{config['title']}</title>
</head>
<body>
<script>
/* [QUIZ_CONFIG_START] */
const QUIZ_CONFIG = {json.dumps(config, indent=2)};
/* [QUIZ_CONFIG_END] */

/* [QUESTIONS_START] */
const QUESTIONS = {json.dumps(questions, indent=2)};
/* [QUESTIONS_END] */
</script>
<script>
(function(){{
  window.__QUIZ_ENGINE_BASE='../'.repeat(Math.max(0,location.pathname.split('/').filter(Boolean).length-2));
  document.write('<scr'+'ipt src="'+window.__QUIZ_ENGINE_BASE+'quiz-engine.js"><\\/scr'+'ipt>');
}})();
</script>
</body>
</html>
"""

PDF_EXPORTER_HTML = r"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PDF Exporter - Built-in</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    :root {
      --bg: #0d1117; --surface: #161b22; --surface2: #1c2330; --border: #30363d;
      --text: #e6edf3; --text-muted: #8b949e; --accent: #f0a500; --correct: #2ea043;
      --wrong: #da3633; --radius: 12px; --shadow: 0 4px 24px rgba(0,0,0,0.4);
    }
    [data-theme="light"] {
      --bg: #f3f0eb; --surface: #ffffff; --surface2: #f8f6f1; --border: #d0ccc5;
      --text: #1c1917; --text-muted: #78716c; --accent: #c27803; --shadow: 0 4px 24px rgba(0,0,0,0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { margin: 0; font-family: 'Outfit', sans-serif; color: var(--text); background: var(--bg); line-height: 1.6; min-height: 100vh; display: flex; flex-direction: column; }
    .topbar { position: sticky; top: 0; background: var(--surface); border-bottom: 1px solid var(--border); padding: 0.75rem 1.5rem; display: flex; align-items: center; justify-content: space-between; z-index: 100; }
    .topbar-title { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-weight: 700; }
    .container { max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; width: 100%; flex: 1; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; margin-bottom: 2rem; box-shadow: var(--shadow); }
    .controls { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 2rem; background: var(--surface2); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border); align-items: center; justify-content: center; }
    .btn { padding: 0.6rem 1.2rem; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-weight: 600; cursor: pointer; transition: 0.2s; font-family: 'Outfit', sans-serif; }
    .btn:hover { border-color: var(--accent); color: var(--accent); }
    .btn-primary { background: var(--accent); color: #000; border-color: var(--accent); }
    .btn-success { background: var(--correct); color: white; border-color: var(--correct); }
    .status-msg { margin-top: 1rem; font-weight: 500; text-align: center; }
    .status-msg.error { color: var(--wrong); }
    .status-msg.success { color: var(--correct); }
    .toggle-wrap { display: flex; align-items: center; gap: 0.5rem; user-select: none; cursor: pointer; font-weight: 500; }
    .toggle-wrap input { cursor: pointer; }
    
    /* Preview & Print Area */
    #print-area { background: white; color: black; padding: 2.5rem; border-radius: 8px; box-shadow: var(--shadow); display: none; margin-top: 2rem; }
    [data-theme="dark"] #print-area { color: black; }
    
    .quiz-header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 2rem; padding-bottom: 1rem; }
    .quiz-header h1 { font-family: 'Playfair Display', serif; font-size: 2.2rem; margin-bottom: 0.5rem; }
    .quiz-header p { font-size: 1.1rem; color: #444; }
    
    .question-item { margin-bottom: 2rem; page-break-inside: avoid; }
    .question-text { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.75rem; }
    .options-list { list-style: none; margin-left: 1rem; }
    .option-item { margin-bottom: 0.4rem; display: flex; gap: 0.75rem; }
    .option-letter { font-weight: 700; min-width: 1.5rem; }
    .answer-key { margin-top: 0.75rem; padding: 0.75rem; background: #f0f0f0; border-left: 4px solid #000; font-size: 0.95rem; }
    .answer-key.hidden { display: none; }
    .answer-key strong { color: #d32f2f; }
    
    /* 2-Column Layout */
    .textbook-layout { column-count: 2; column-gap: 2.5rem; column-rule: 1px solid #ccc; }
    .textbook-layout .quiz-header { column-span: all; margin-bottom: 1.5rem; padding-bottom: 0.75rem; }
    .textbook-layout .question-item { break-inside: avoid; margin-bottom: 1.5rem; }
    
    /* Styled Mode */
    .styled-output .quiz-header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; border-radius: 16px; padding: 2.5rem 2rem; border: none; }
    .styled-output .quiz-header h1 { color: #fff; }
    .styled-output .quiz-header p { color: rgba(255,255,255,0.8); }
    .styled-output .question-item { background: #fff; border: 1.5px solid #e0e0e0; border-radius: 14px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .styled-output .q-badge { display: inline-block; background: var(--accent); color: #000; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 6px; margin-bottom: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .styled-output .option-item { border: 1.5px solid #e8e8e8; background: #fafafa; border-radius: 10px; padding: 0.75rem 1rem; }
    .styled-output .option-letter { width: 26px; height: 26px; border-radius: 7px; background: #f0f0f0; border: 1.5px solid #d0d0d0; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
    
    /* MCQ Notes Mode */
    .mcq-notes-layout .question-item { margin-bottom: 0.75rem; }
    .mcq-notes-layout .question-text { font-size: 0.9rem; margin-bottom: 0.35rem; }
    .mcq-notes-layout .compact-answer { font-size: 0.9rem; font-weight: 600; color: var(--correct); margin-left: 20px; }
    
    @media print {
      body { background: white !important; color: black !important; }
      .topbar, .card, .controls, .no-print { display: none !important; }
      .container { max-width: none; margin: 0; padding: 0; }
      #print-area { display: block !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
      .styled-output .question-item { box-shadow: none !important; }
    }
  </style>
</head>
<body>
  <div class="topbar no-print">
    <div class="topbar-title">Built-in PDF Exporter</div>
    <button class="btn" onclick="toggleTheme()">☀️</button>
  </div>
  
  <div class="container">
    <div class="card">
      <h2 style="margin-top:0">Export Quiz to PDF</h2>
      <p class="muted" style="margin-bottom:1.5rem;">Rendering logic synced with QuizTool PDF Exporter.</p>
      
      <div style="display: flex; gap: 0.5rem;">
        <input type="text" id="quiz-url" style="flex:1; padding: 0.7rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); color: var(--text);" placeholder="Enter quiz URL...">
        <button class="btn btn-primary" onclick="loadFromUrl()">Load Quiz</button>
      </div>
      <div id="status" class="status-msg"></div>
    </div>

    <div id="preview-controls" class="controls" style="display: none;">
      <label class="toggle-wrap"><input type="checkbox" id="show-answers" checked onchange="updatePreview()"> <span>Show Answers</span></label>
      <label class="toggle-wrap"><input type="checkbox" id="two-column" onchange="updatePreview()"> <span>2-Column</span></label>
      <label class="toggle-wrap"><input type="checkbox" id="styled-mode" onchange="updatePreview()"> <span>✨ Styled</span></label>
      <label class="toggle-wrap"><input type="checkbox" id="mcq-notes-mode" onchange="updatePreview()"> <span>📝 MCQ Notes</span></label>
      
      <div style="margin-left: auto; display: flex; align-items: center; gap: 1rem;">
        <label class="toggle-wrap" title="Lower quality is safer for very long quizzes"><input type="checkbox" id="high-quality"> <span>HQ (Scale 2)</span></label>
        <button class="btn btn-success" onclick="generatePdfFile()">💾 Save PDF File</button>
        <button class="btn btn-primary" onclick="window.print()">🖨️ Print Dialog</button>
      </div>
    </div>
    
    <div id="print-area"></div>
  </div>

  <script>
    let quizData = { config: {}, questions: [] };

    async function loadFromUrl() {
      const url = document.getElementById('quiz-url').value.trim();
      if (!url) return;
      const status = document.getElementById('status');
      status.textContent = 'Fetching quiz file...';
      status.className = 'status-msg';

      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        const content = await resp.text();
        
        const findBlock = (start, end, fallbackRegex) => {
          const startIdx = content.indexOf(start);
          const endIdx = content.indexOf(end);
          if (startIdx !== -1 && endIdx !== -1) {
            const block = content.slice(startIdx + start.length, endIdx);
            const match = block.match(/(const|let|var)\s+\w+\s*=\s*([\s\S]*?);?$/);
            if (match) return match[2].trim();
          }
          const generalMatch = content.match(fallbackRegex);
          return generalMatch ? generalMatch[2].trim() : null;
        };

        const configJson = findBlock('/* [QUIZ_CONFIG_START] */', '/* [QUIZ_CONFIG_END] */', /(const|let|var)\s+QUIZ_CONFIG\s*=\s*([\s\S]*?);?(\n|\r|$)/) ||
                          findBlock('/* [BANK_CONFIG_START] */', '/* [BANK_CONFIG_END] */', /(const|let|var)\s+BANK_CONFIG\s*=\s*([\s\S]*?);?(\n|\r|$)/);
        
        const questionsJson = findBlock('/* [QUESTIONS_START] */', '/* [QUESTIONS_END] */', /(const|let|var)\s+QUESTIONS\s*=\s*([\s\S]*?);?(\n|\r|$)/) ||
                             findBlock('/* [QUESTION_BANK_START] */', '/* [QUESTION_BANK_END] */', /(const|let|var)\s+QUESTION_BANK\s*=\s*([\s\S]*?);?(\n|\r|$)/);

        if (!configJson || !questionsJson) throw new Error('Could not find quiz data blocks in the file.');

        quizData.config = new Function('return ' + configJson)();
        quizData.questions = new Function('return ' + questionsJson)();

        status.textContent = `Loaded "${quizData.config.title}" (${quizData.questions.length} questions).`;
        status.className = 'status-msg success';
        document.getElementById('preview-controls').style.display = 'flex';
        updatePreview();
      } catch (err) {
        status.textContent = `Error: ${err.message}`;
        status.className = 'status-msg error';
      }
    }

    function updatePreview() {
      const showAnswers = document.getElementById('show-answers').checked;
      const useTwoColumn = document.getElementById('two-column').checked;
      const useStyled = document.getElementById('styled-mode').checked;
      const useMcqNotes = document.getElementById('mcq-notes-mode').checked;
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      const area = document.getElementById('print-area');
      
      area.className = '';
      if (useTwoColumn) area.classList.add('textbook-layout');
      if (useStyled) area.classList.add('styled-output');
      if (useMcqNotes) area.classList.add('mcq-notes-layout');

      let html = '';
      
      // Header
      if (useStyled) {
        html += `<div class="quiz-header">
          ${quizData.config.icon ? `<div style="font-size:2.5rem; margin-bottom:0.5rem;">${quizData.config.icon}</div>` : ''}
          <h1>${quizData.config.title}</h1>
          <p>${quizData.config.description || ''}</p>
        </div>`;
      } else {
        html += `<div class="quiz-header">
          <h1>${quizData.config.title}</h1>
          <p>${quizData.config.description || ''}</p>
        </div>`;
      }

      quizData.questions.forEach((q, i) => {
        if (useMcqNotes) {
          html += `<div class="question-item">
            <div class="question-text">${i + 1}. ${q.question}</div>
            <div class="compact-answer">${letters[q.correct]}. ${q.options[q.correct]}</div>
          </div>`;
        } else if (useStyled) {
          html += `<div class="question-item">
            <div class="q-badge">Question ${i + 1}</div>
            <div class="question-text">${q.question}</div>
            <div class="options-list">
              ${q.options.map((opt, oi) => `<div class="option-item"><span class="option-letter">${letters[oi]}</span><span class="option-text">${opt}</span></div>`).join('')}
            </div>
            ${showAnswers ? `<div class="answer-key"><strong>✓ Correct: ${letters[q.correct]}. ${q.options[q.correct]}</strong>${q.explanation ? `<div style="margin-top:0.4rem; font-size:0.85rem; color:#555;">${q.explanation}</div>` : ''}</div>` : ''}
          </div>`;
        } else {
          html += `<div class="question-item">
            <div class="question-text">${i + 1}. ${q.question}</div>
            <div class="options-list">
              ${q.options.map((opt, oi) => `<div class="option-item"><span class="option-letter">${letters[oi]}.</span><span class="option-text">${opt}</span></div>`).join('')}
            </div>
            <div class="answer-key ${showAnswers ? '' : 'hidden'}"><strong>Correct Answer: ${letters[q.correct]}</strong>${q.explanation ? `<div style="margin-top:0.4rem;">${q.explanation}</div>` : ''}</div>
          </div>`;
        }
      });

      area.innerHTML = html;
      area.style.display = 'block';
    }

    async function generatePdfFile() {
      const element = document.getElementById('print-area');
      const filename = (quizData.config.title || 'quiz').toLowerCase().replace(/[^a-z0-9]/g, '-') + '.pdf';
      const useHq = document.getElementById('high-quality').checked;
      
      const opt = { 
        margin: 0.5, 
        filename, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { 
          scale: useHq ? 2 : 1, 
          useCORS: true,
          logging: false 
        }, 
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } 
      };
      
      try {
        const btn = document.querySelector('.btn-success');
        btn.disabled = true; btn.textContent = 'Generating...';
        await html2pdf().set(opt).from(element).save();
        btn.disabled = false; btn.textContent = '💾 Save PDF File';
      } catch (err) { 
        console.error(err);
        alert('Error: ' + err.message + '\n\nTry disabling "HQ" mode or use the "Print Dialog" button for very long quizzes.');
        const btn = document.querySelector('.btn-success');
        btn.disabled = false; btn.textContent = '💾 Save PDF File';
      }
    }

    function toggleTheme() {
      const html = document.documentElement;
      const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('quiz-theme', newTheme);
    }

    (function() {
      const params = new URLSearchParams(window.location.search);
      const url = params.get('url');
      if (url) { document.getElementById('quiz-url').value = url; loadFromUrl(); }
      const theme = localStorage.getItem('quiz-theme');
      if (theme) document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>
</body>
</html>
"""


def create_bank_html(config: dict[str, Any], questions: list[dict[str, Any]] | None = None) -> str:
    questions = questions or [
        {
            "question": "Sample question?",
            "options": ["A", "B", "C", "D"],
            "correct": 0,
            "explanation": "Sample explanation.",
        }
    ]
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
(function(){{var t=localStorage.getItem('quiz-theme')||'dark';var s=document.createElement('style');
s.textContent='html,body{{background:'+(t==='light'?'#f3f0eb':'#0d1117')+';color:'+(t==='light'?'#1c1917':'#e6edf3')+';margin:0;padding:0;overflow:hidden;height:100%}}';
document.head.appendChild(s)}})();
</script>
<title>{config['title']}</title>
</head>
<body>
<script>
/* [BANK_CONFIG_START] */
const BANK_CONFIG = {json.dumps(config, indent=2)};
/* [BANK_CONFIG_END] */

/* [QUESTION_BANK_START] */
const QUESTION_BANK = {json.dumps(questions, indent=2)};
/* [QUESTION_BANK_END] */
</script>
<script>
(function(){{
  window.__QUIZ_ENGINE_BASE='../'.repeat(Math.max(0,location.pathname.split('/').filter(Boolean).length-2));
  document.write('<scr'+'ipt src="'+window.__QUIZ_ENGINE_BASE+'bank-engine.js"><\\/scr'+'ipt>');
}})();
</script>
</body>
</html>
"""


def create_index_html(folder_rel: str, title: str = "", description: str = "") -> str:
    ctx = build_index_page_context(folder_rel, title=title, description=description)
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
(function(){{var t=localStorage.getItem('quiz-theme')||'dark';var s=document.createElement('style');
s.textContent='html,body{{background:'+(t==='light'?'#f3f0eb':'#0d1117')+';color:'+(t==='light'?'#1c1917':'#e6edf3')+';margin:0;padding:0;min-height:100%}}';
document.head.appendChild(s)}})();
</script>
<title>{ctx['page_title']}</title>
<meta name="theme-color" content="#0d1117">
<link rel="icon" type="image/svg+xml" href="{ctx['prefix']}favicon.svg">
<link rel="apple-touch-icon" href="{ctx['prefix']}favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{ctx['prefix']}index-engine.css">
<link rel="manifest" href="{ctx['prefix']}manifest.webmanifest">
</head>
<body>
  <div class="topbar">
    {ctx['back_link']}
    <div class="topbar-title">{ctx['topbar_title']}</div>
    <button class="icon-btn btn-tracker" onclick="openTrackerDashboard()" title="Question Tracker">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 5-9"/></svg>
      <span class="tracker-badge" id="tracker-badge-count"></span>
    </button>
    <button class="icon-btn" id="theme-toggle" onclick="toggleTheme()" title="Toggle theme">☀</button>
  </div>

  <div class="container">
    <header class="hero">
      <h1>{ctx['hero_title']}</h1>
      <p>{ctx['hero_description']}</p>
    </header>
    <div class="quiz-grid" id="quiz-grid"></div>
    <div class="footer-note">Made By: <a href="https://github.com/eyad-elghareeb/QuizTool">QuizTool</a></div>
{TRACKER_MODAL_HTML}

<script src="{ctx['prefix']}index-engine.js"></script>
<script>
(function(){{
  var s=localStorage.getItem('quiz-theme');
  if(s) document.documentElement.setAttribute('data-theme', s);
  if(window.__updateThemeIcon) window.__updateThemeIcon();
  if(window.renderQuizzes) window.renderQuizzes();
}})();
</script>
<script>
if ('serviceWorker' in navigator) {{
  window.addEventListener('load', function () {{
    navigator.serviceWorker.register('{ctx['prefix']}sw.js').catch(function () {{}});
  }});
}}
</script>
</body>
</html>
"""


def get_project_name() -> str:
    manifest = PROJECT_ROOT / "manifest.webmanifest"
    if manifest.exists():
        try:
            data = json.loads(read_text(manifest))
            return data.get("name") or data.get("short_name") or PROJECT_ROOT.name
        except Exception:
            pass
    return PROJECT_ROOT.name


def get_builtin_tools() -> list[dict[str, str]]:
    return [
        {
            "id": key,
            "label": meta["label"],
            "description": meta["description"],
        }
        for key, meta in BUILTIN_TOOLS.items()
    ]


def run_subprocess(args: list[str], cwd: Path | None = None, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd or PROJECT_ROOT),
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def git_available() -> bool:
    if not (PROJECT_ROOT / ".git").exists():
        return False
    try:
        result = run_subprocess(["git", "rev-parse", "--is-inside-work-tree"])
        return result.returncode == 0
    except FileNotFoundError:
        return False


def get_git_status() -> dict[str, Any]:
    if not git_available():
        return {
            "available": False,
            "branch": None,
            "dirtyCount": 0,
            "changedPaths": [],
            "ahead": 0,
            "behind": 0,
        }

    branch = run_subprocess(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    upstream = run_subprocess(["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
    ahead = 0
    behind = 0
    if upstream.returncode == 0 and upstream.stdout.strip():
        counts = run_subprocess(
            ["git", "rev-list", "--left-right", "--count", f"{branch}...{upstream.stdout.strip()}"]
        )
        if counts.returncode == 0:
            raw_counts = counts.stdout.strip().split()
            if len(raw_counts) == 2:
                ahead = int(raw_counts[0])
                behind = int(raw_counts[1])

    short = run_subprocess(["git", "status", "--short"]).stdout.splitlines()
    changed_paths = []
    for line in short:
        if not line.strip():
            continue
        status = line[:2].strip() or "??"
        path = line[3:] if len(line) > 3 else line
        changed_paths.append({"status": status, "path": path})

    return {
        "available": True,
        "branch": branch,
        "dirtyCount": len(changed_paths),
        "changedPaths": changed_paths,
        "ahead": ahead,
        "behind": behind,
    }


def parse_github_remote(remote: str) -> dict[str, str] | None:
    remote = (remote or "").strip()
    patterns = [
        r"github\.com[:/](?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?/?$",
        r"https?://[^@/]+@github\.com/(?P<owner>[^/]+)/(?P<repo>[^/.]+)(?:\.git)?/?$",
    ]
    for pattern in patterns:
        match = re.search(pattern, remote)
        if match:
            return {"owner": match.group("owner"), "repo": match.group("repo")}
    return None


def get_git_remote_url() -> str:
    if not git_available():
        return ""
    result = run_subprocess(["git", "remote", "get-url", "origin"])
    return result.stdout.strip() if result.returncode == 0 else ""


def read_deploy_metadata() -> dict[str, Any] | None:
    if not DEPLOY_METADATA_PATH.exists():
        return None
    try:
        data = json.loads(read_text(DEPLOY_METADATA_PATH))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def ensure_local_gitignore_entry() -> None:
    gitignore = PROJECT_ROOT / ".gitignore"
    entry = ".quiztool/"
    if not gitignore.exists():
        write_text(gitignore, f"{entry}\n")
        return
    content = read_text(gitignore)
    if entry not in content.splitlines():
        suffix = "" if content.endswith("\n") else "\n"
        write_text(gitignore, f"{content}{suffix}{entry}\n")


def write_deploy_metadata(metadata: dict[str, Any]) -> None:
    ensure_local_gitignore_entry()
    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
    write_text(DEPLOY_METADATA_PATH, json.dumps(metadata, indent=2))


def inferred_github_metadata() -> dict[str, Any] | None:
    remote = get_git_remote_url()
    parsed = parse_github_remote(remote)
    if not parsed:
        return None
    branch_result = run_subprocess(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    branch = branch_result.stdout.strip() if branch_result.returncode == 0 else "main"
    owner = parsed["owner"]
    repo = parsed["repo"]
    return {
        "provider": "github",
        "projectName": repo,
        "liveUrl": f"https://{owner}.github.io/{repo}/",
        "providerUrl": f"https://github.com/{owner}/{repo}",
        "github": {"owner": owner, "repo": repo, "branch": branch or "main"},
        "inferred": True,
    }


def get_deploy_metadata() -> dict[str, Any] | None:
    return read_deploy_metadata() or inferred_github_metadata()


def http_json_request(method: str, url: str, token: str | None = None, json_data: Any = None,
                      body: bytes | None = None, headers: dict[str, str] | None = None,
                      timeout: int = 60) -> tuple[int, Any]:
    import urllib.error
    import urllib.request

    req_headers = {"User-Agent": "QuizTool-Admin-Dashboard"}
    if token:
        req_headers["Authorization"] = f"Bearer {token}"
    if headers:
        req_headers.update(headers)
    req_body = body
    if json_data is not None:
        req_body = json.dumps(json_data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=req_body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            text = raw.decode("utf-8") if raw else ""
            try:
                payload = json.loads(text) if text else None
            except Exception:
                payload = {"message": text}
            return resp.status, payload
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8") if exc.fp else ""
        try:
            return exc.code, json.loads(text)
        except Exception:
            return exc.code, {"message": text}
    except Exception as exc:
        return 0, {"message": str(exc)}


def github_request(method: str, path: str, token: str, timeout: int = 30) -> tuple[int, Any]:
    return http_json_request(
        method,
        f"https://api.github.com{path}",
        token=None,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=timeout,
    )


def netlify_request(method: str, path: str, token: str, json_data: Any = None,
                    body: bytes | None = None, content_type: str | None = None,
                    timeout: int = 60) -> tuple[int, Any]:
    headers = {"Content-Type": content_type} if content_type else None
    return http_json_request(
        method,
        f"https://api.netlify.com/api/v1{path}",
        token=token,
        json_data=json_data,
        body=body,
        headers=headers,
        timeout=timeout,
    )


def vercel_request(method: str, path: str, token: str, json_data: Any = None,
                   timeout: int = 60) -> tuple[int, Any]:
    return http_json_request(method, f"https://api.vercel.com{path}", token=token, json_data=json_data, timeout=timeout)


def should_skip_deploy_dir(name: str) -> bool:
    return name in DEPLOY_SKIP_DIRS or name.startswith(".")


def build_project_zip_for_deploy() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(PROJECT_ROOT):
            dirs[:] = [d for d in dirs if not should_skip_deploy_dir(d)]
            root_path = Path(root)
            for filename in files:
                path = root_path / filename
                rel = relative_path(path)
                if rel == "admin-dashboard.bat":
                    continue
                zf.write(path, rel)
    return buf.getvalue()


def vercel_files_from_zip(zip_bytes: bytes) -> list[dict[str, str]]:
    files = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            files.append({
                "file": info.filename.replace("\\", "/"),
                "data": base64.b64encode(zf.read(info.filename)).decode("ascii"),
                "encoding": "base64",
            })
    return files


def verify_provider_token(provider: str, token: str) -> tuple[bool, str]:
    if provider == "github":
        status, data = github_request("GET", "/user", token, timeout=15)
        return status == 200, (data or {}).get("message", "Invalid GitHub token")
    if provider == "netlify":
        status, data = netlify_request("GET", "/user", token, timeout=15)
        return status == 200, (data or {}).get("message", "Invalid Netlify token")
    if provider == "vercel":
        status, data = vercel_request("GET", "/v2/user", token, timeout=15)
        msg = ((data or {}).get("error") or {}).get("message") or (data or {}).get("message", "Invalid Vercel token")
        return status == 200, msg
    return False, "Unknown provider."


def deploy_to_github(metadata: dict[str, Any], token: str, commit_message: str) -> dict[str, Any]:
    if not git_available():
        raise RuntimeError("Git is not available for this repository.")
    github = metadata.get("github") or {}
    owner = github.get("owner")
    repo = github.get("repo")
    branch = github.get("branch") or "main"
    if not owner or not repo:
        raise RuntimeError("GitHub deployment metadata is missing owner or repo.")

    ensure_local_gitignore_entry()
    pull_result = run_subprocess(["git", "pull", "--rebase", "--autostash"])
    if pull_result.returncode != 0:
        raise RuntimeError((pull_result.stdout or pull_result.stderr).strip() or "Git pull failed.")

    add_result = run_subprocess(["git", "add", "-A"])
    if add_result.returncode != 0:
        raise RuntimeError(add_result.stderr.strip() or "Git add failed.")

    changed = run_subprocess(["git", "diff", "--cached", "--quiet"])
    committed = False
    if changed.returncode != 0:
        commit_result = run_subprocess(["git", "commit", "-m", commit_message or "Update quiz project files"])
        if commit_result.returncode != 0:
            raise RuntimeError((commit_result.stdout or commit_result.stderr).strip() or "Git commit failed.")
        committed = True

    remote_url = f"https://{owner}@github.com/{owner}/{repo}.git"
    run_subprocess(["git", "remote", "set-url", "origin", remote_url])

    askpass_dir = Path(tempfile.gettempdir()) / "quiztool-admin-askpass"
    askpass_dir.mkdir(parents=True, exist_ok=True)
    if sys.platform == "win32":
        askpass_script = askpass_dir / "askpass-github.bat"
        askpass_script.write_text(
            '@echo off\n'
            'echo %1 | findstr /i "Username" >nul\n'
            'if %errorlevel%==0 (echo %GIT_USERNAME%) else (echo %GIT_PASSWORD%)\n',
            encoding="utf-8",
        )
    else:
        askpass_script = askpass_dir / "askpass-github.sh"
        askpass_script.write_text(
            '#!/bin/sh\n'
            'case "$1" in *Username*) printf "%s\\n" "$GIT_USERNAME" ;; *) printf "%s\\n" "$GIT_PASSWORD" ;; esac\n',
            encoding="utf-8",
        )
        askpass_script.chmod(0o700)

    env = os.environ.copy()
    env["GIT_USERNAME"] = owner
    env["GIT_PASSWORD"] = token
    env["GIT_ASKPASS"] = str(askpass_script)
    env["GIT_TERMINAL_PROMPT"] = "0"
    try:
        push_result = run_subprocess(["git", "push", "origin", branch], env=env)
        if push_result.returncode != 0:
            raise RuntimeError(push_result.stderr.strip() or "Git push failed.")
    finally:
        try:
            askpass_script.unlink()
        except OSError:
            pass

    return {
        "provider": "github",
        "liveUrl": metadata.get("liveUrl") or f"https://{owner}.github.io/{repo}/",
        "providerUrl": metadata.get("providerUrl") or f"https://github.com/{owner}/{repo}",
        "message": "GitHub Pages deploy pushed successfully." if committed else "No file changes to commit; pushed current branch.",
    }


def deploy_to_netlify(metadata: dict[str, Any], token: str) -> dict[str, Any]:
    site = metadata.get("netlify") or {}
    site_id = site.get("siteId")
    if not site_id:
        raise RuntimeError("Netlify deployment metadata is missing siteId.")

    zip_bytes = build_project_zip_for_deploy()
    status, deploy_data = netlify_request(
        "POST",
        f"/sites/{site_id}/deploys",
        token,
        body=zip_bytes,
        content_type="application/zip",
        timeout=120,
    )
    if status not in (200, 201) or not deploy_data:
        raise RuntimeError((deploy_data or {}).get("message", "Failed to upload Netlify deploy."))

    deploy_id = deploy_data.get("id")
    deploy_state = deploy_data.get("state")
    if deploy_id and deploy_state != "ready":
        deadline = time.time() + 90
        while time.time() < deadline:
            time.sleep(2)
            poll_status, poll_data = netlify_request("GET", f"/deploys/{deploy_id}", token, timeout=20)
            if poll_status == 200 and poll_data:
                deploy_data = poll_data
                deploy_state = poll_data.get("state")
                if deploy_state == "ready":
                    break
                if deploy_state in {"error", "failed"}:
                    raise RuntimeError(poll_data.get("error_message") or poll_data.get("message") or "Netlify deploy failed.")

    live_url = deploy_data.get("ssl_url") or deploy_data.get("deploy_ssl_url") or metadata.get("liveUrl")
    metadata["liveUrl"] = live_url
    metadata["providerUrl"] = metadata.get("providerUrl") or live_url
    write_deploy_metadata(metadata)
    return {
        "provider": "netlify",
        "liveUrl": live_url,
        "providerUrl": metadata.get("providerUrl") or live_url,
        "message": "Netlify deploy completed." if deploy_state == "ready" else "Netlify accepted the deploy and is still processing.",
    }


def deploy_to_vercel(metadata: dict[str, Any], token: str) -> dict[str, Any]:
    vercel = metadata.get("vercel") or {}
    project_name = vercel.get("projectName") or metadata.get("projectName")
    if not project_name:
        raise RuntimeError("Vercel deployment metadata is missing projectName.")

    zip_bytes = build_project_zip_for_deploy()
    deploy_body = {
        "name": project_name,
        "project": project_name,
        "target": "production",
        "files": vercel_files_from_zip(zip_bytes),
        "projectSettings": {
            "framework": None,
            "buildCommand": None,
            "devCommand": None,
            "installCommand": None,
            "outputDirectory": None,
        },
        "meta": {"source": "quiztool-admin-dashboard"},
    }
    status, deploy_data = vercel_request(
        "POST",
        "/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1",
        token,
        json_data=deploy_body,
        timeout=180,
    )
    if status not in (200, 201) or not deploy_data:
        err = (deploy_data or {}).get("error") or {}
        raise RuntimeError(err.get("message") or (deploy_data or {}).get("message", "Failed to create Vercel deployment."))

    deployment_id = deploy_data.get("id")
    ready_state = deploy_data.get("readyState") or deploy_data.get("status")
    if deployment_id and ready_state not in {"READY", "ERROR", "CANCELED"}:
        deadline = time.time() + 90
        while time.time() < deadline:
            time.sleep(2)
            poll_status, poll_data = vercel_request("GET", f"/v13/deployments/{deployment_id}", token, timeout=20)
            if poll_status == 200 and poll_data:
                deploy_data = poll_data
                ready_state = poll_data.get("readyState") or poll_data.get("status")
                if ready_state in {"READY", "ERROR", "CANCELED"}:
                    break
    if ready_state == "ERROR":
        raise RuntimeError(deploy_data.get("errorMessage") or deploy_data.get("errorCode") or "Vercel deployment failed.")
    if ready_state == "CANCELED":
        raise RuntimeError("Vercel deployment was canceled.")

    raw_url = deploy_data.get("url") or deploy_data.get("aliasFinal") or ""
    live_url = raw_url if raw_url.startswith("http") else f"https://{raw_url}"
    provider_url = deploy_data.get("inspectorUrl") or live_url
    metadata["liveUrl"] = live_url
    metadata["providerUrl"] = provider_url
    metadata.setdefault("vercel", {})["deploymentUrl"] = live_url
    write_deploy_metadata(metadata)
    return {
        "provider": "vercel",
        "liveUrl": live_url,
        "providerUrl": provider_url,
        "message": "Vercel deploy completed." if ready_state == "READY" else "Vercel accepted the deployment and is still building.",
    }


def build_summary() -> dict[str, Any]:
    files = collect_file_records()
    quiz_count = sum(1 for file in files if file["type"] == "quiz")
    bank_count = sum(1 for file in files if file["type"] == "bank")
    index_count = sum(1 for file in files if file["type"] == "index")
    total_questions = sum(int(file["question_count"] or 0) for file in files if file["type"] in {"quiz", "bank"})
    return {
        "totalHtmlFiles": len(files),
        "quizCount": quiz_count,
        "bankCount": bank_count,
        "indexCount": index_count,
        "folderCount": len(scan_folders()),
        "totalQuestions": total_questions,
    }


@app.get("/admin/")
def admin() -> str:
    return render_template_string(DASHBOARD_HTML, project_name=get_project_name())


@app.get("/admin/files")
def get_files() -> Any:
    return jsonify({"files": collect_file_records(), "folders": scan_folders()})


@app.get("/admin/project-state")
def get_project_state() -> Any:
    return jsonify(
        {
            "projectName": get_project_name(),
            "summary": build_summary(),
            "git": get_git_status(),
            "deploy": get_deploy_metadata(),
            "builtinTools": get_builtin_tools(),
        }
    )


@app.get("/admin/deploy-info")
def deploy_info() -> Any:
    metadata = get_deploy_metadata()
    return jsonify({
        "configured": bool(metadata),
        "deploy": metadata,
        "git": get_git_status(),
    })


@app.post("/admin/provider-verify")
def provider_verify() -> Any:
    payload = request.get_json(silent=True) or {}
    provider = str(payload.get("provider", "")).strip().lower()
    token = str(payload.get("token", "")).strip()
    if provider not in {"github", "netlify", "vercel"}:
        return jsonify({"message": "Provider must be github, netlify, or vercel."}), 400
    if not token:
        return jsonify({"message": "Token is required."}), 400
    ok, message = verify_provider_token(provider, token)
    if not ok:
        return jsonify({"message": message}), 401
    return jsonify({"message": f"{provider.title()} token verified.", "provider": provider})


@app.post("/admin/provider-deploy")
def provider_deploy() -> Any:
    payload = request.get_json(silent=True) or {}
    provider = str(payload.get("provider", "")).strip().lower()
    token = str(payload.get("token", "")).strip()
    commit_message = str(payload.get("message", "")).strip() or "Update quiz project files"
    metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else get_deploy_metadata()

    if provider not in {"github", "netlify", "vercel"}:
        return jsonify({"message": "Provider must be github, netlify, or vercel."}), 400
    if not token:
        return jsonify({"message": "Token is required."}), 400
    if not metadata:
        return jsonify({"message": "Deployment metadata is missing. Configure a provider before deploying."}), 400
    metadata["provider"] = provider

    ok, verify_message = verify_provider_token(provider, token)
    if not ok:
        return jsonify({"message": verify_message}), 401

    sync_result = run_subprocess([sys.executable, str(SYNC_SCRIPT)], cwd=PROJECT_ROOT) if SYNC_SCRIPT.exists() else None
    if sync_result and sync_result.returncode != 0:
        return jsonify({
            "message": "Sync failed before deploy.",
            "output": (sync_result.stdout or sync_result.stderr).strip(),
        }), 500

    try:
        if provider == "github":
            result = deploy_to_github(metadata, token, commit_message)
            write_deploy_metadata(metadata)
        elif provider == "netlify":
            result = deploy_to_netlify(metadata, token)
        else:
            result = deploy_to_vercel(metadata, token)
    except Exception as exc:
        return jsonify({"message": str(exc)}), 500

    return jsonify({
        "message": result.get("message", "Deploy completed."),
        "provider": provider,
        "liveUrl": result.get("liveUrl"),
        "providerUrl": result.get("providerUrl"),
        "syncOutput": sync_result.stdout.strip() if sync_result else "",
    })


@app.get("/admin/load-file")
def load_file() -> Any:
    path = request.args.get("path", "")
    if not path:
        return jsonify({"message": "Missing file path."}), 400
    try:
        file_path = resolve_project_path(path, must_exist=True, file_only=True)
    except FileNotFoundError:
        return jsonify({"message": "File not found."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    content = read_text(file_path)
    return jsonify({"content": content, "meta": parse_file_metadata(content)})


@app.get("/admin/preview/<path:filename>")
def preview_file(filename: str) -> Any:
    normalized = normalize_rel_path(filename)
    suffix = Path(normalized).suffix.lower()

    if suffix != ".html":
        try:
            asset_path = resolve_project_path(normalized, must_exist=True)
        except FileNotFoundError:
            return "Not Found", 404
        except ValueError as exc:
            return str(exc), 400
        if asset_path.is_dir():
            return "Not Found", 404
        if asset_path.suffix.lower() not in ASSET_SUFFIXES:
            return "Unsupported asset type.", 404
        return send_file(asset_path)

    try:
        file_path = resolve_project_path(normalized, must_exist=True, file_only=True)
    except FileNotFoundError:
        return "Not Found", 404
    except ValueError as exc:
        return str(exc), 400

    content = read_text(file_path)
    # Fix engine base path for preview. We must account for the /admin/preview/ prefix
    # by replacing the dynamic location-based logic with a fixed relative path.
    depth = len(Path(normalized).parent.parts) if normalized != "." else 0
    prefix = '../' * depth
    content = re.sub(
        r"window\.__QUIZ_ENGINE_BASE\s*=\s*['\"].*?['\"]\s*\.repeat\(Math\.max\(0,\s*location\.pathname\.split\(\s*['\"/].*?['\"]\s*\)\.filter\(Boolean\)\.length\s*-\s*\d+\)\);?",
        f"window.__QUIZ_ENGINE_BASE='{prefix}';",
        content,
        flags=re.MULTILINE
    )
    return content, 200, {"Content-Type": "text/html; charset=utf-8"}


@app.post("/admin/save-file")
def save_file() -> Any:
    payload = request.get_json(silent=True) or {}
    path = payload.get("path", "")
    content = payload.get("content")
    confirm_uid_change = bool(payload.get("confirm_uid_change"))
    if not path or content is None:
        return jsonify({"message": "Missing path or content."}), 400
    try:
        file_path = resolve_project_path(path, must_exist=True, file_only=True)
    except FileNotFoundError:
        return jsonify({"message": "File not found."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    original_content = read_text(file_path)
    original_uid = str(parse_file_metadata(original_content).get("uid") or "")
    validation = validate_dashboard_content(relative_path(file_path), str(content), original_uid=original_uid)
    if validation["errors"]:
        return (
            jsonify(
                {
                    "message": "Validation failed. Fix the highlighted issues before saving.",
                    "validation": validation,
                }
            ),
            400,
        )
    if any(issue.get("code") == "uid_changed" for issue in validation["warnings"]) and not confirm_uid_change:
        return (
            jsonify(
                {
                    "message": "UID change requires confirmation because it can orphan stored progress.",
                    "validation": validation,
                    "requires_uid_confirmation": True,
                }
            ),
            409,
        )

    write_text(file_path, str(content))
    return jsonify({"message": f"Saved {relative_path(file_path)}."})


@app.post("/admin/validate-file")
def validate_file() -> Any:
    payload = request.get_json(silent=True) or {}
    path = str(payload.get("path", "") or "").strip()
    content = payload.get("content")
    original_uid = str(payload.get("original_uid", "") or "")
    if not path or content is None:
        return jsonify({"message": "Missing path or content."}), 400
    validation = validate_dashboard_content(path, str(content), original_uid=original_uid)
    return jsonify(
        {
            "message": "Validation completed.",
            "validation": validation,
            "ok": not validation["errors"],
        }
    )


@app.post("/admin/create-folder")
def create_folder() -> Any:
    payload = request.get_json(silent=True) or {}
    raw_name = payload.get("name", "")
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    folder_rel = normalize_rel_path(raw_name)
    if folder_rel == ".":
        return jsonify({"message": "Please provide a folder path."}), 400

    try:
        folder_path = resolve_project_path(folder_rel)
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if folder_path.exists():
        return jsonify({"message": "Folder already exists."}), 400

    folder_path.mkdir(parents=True, exist_ok=False)
    index_path = folder_path / "index.html"
    write_text(index_path, create_index_html(folder_rel, title=title, description=description))
    return jsonify({"message": f'Created folder "{folder_rel}".', "path": relative_path(index_path)})


@app.post("/admin/create-file")
def create_file() -> Any:
    payload = request.get_json(silent=True) or {}
    file_type = str(payload.get("type", "")).strip().lower()
    folder_rel = normalize_rel_path(payload.get("folder", "."))
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    filename_hint = str(payload.get("filename", "")).strip()
    icon = str(payload.get("icon", "🗃️")).strip() or "🗃️"

    if file_type not in {"quiz", "bank"}:
        return jsonify({"message": "Type must be quiz or bank."}), 400
    if not title:
        return jsonify({"message": "Title is required."}), 400

    try:
        folder_path = resolve_project_path(folder_rel, must_exist=True)
    except FileNotFoundError:
        return jsonify({"message": "Target folder does not exist."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    if not folder_path.is_dir():
        return jsonify({"message": "Target path is not a folder."}), 400

    base_stem = slugify(filename_hint or title, default="untitled")
    if file_type == "bank" and not filename_hint and not base_stem.startswith("all-"):
        base_stem = f"all-{base_stem}"

    file_path = ensure_unique_html_path(folder_path, base_stem)
    uid = derive_uid(folder_rel, file_path.stem)

    questions = payload.get("questions")
    if file_type == "quiz":
        content = create_quiz_html({"uid": uid, "title": title, "description": description}, questions)
    else:
        content = create_bank_html({"uid": uid, "title": title, "description": description, "icon": icon}, questions)

    write_text(file_path, content)
    return jsonify(
        {
            "message": f'Created {file_type} file "{file_path.name}".',
            "path": relative_path(file_path),
            "uid": uid,
        }
    )


@app.post("/admin/duplicate-file")
def duplicate_file() -> Any:
    payload = request.get_json(silent=True) or {}
    raw_path = str(payload.get("path", "") or "").strip()
    folder_rel = normalize_rel_path(payload.get("folder", "."))
    filename_hint = str(payload.get("filename", "") or "").strip()
    if not raw_path:
        return jsonify({"message": "Source path is required."}), 400
    try:
        source = resolve_project_path(raw_path, must_exist=True, file_only=True)
        target_folder = resolve_project_path(folder_rel, must_exist=True)
    except FileNotFoundError:
        return jsonify({"message": "Source or target path was not found."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    if not target_folder.is_dir():
        return jsonify({"message": "Target path is not a folder."}), 400

    base_stem = slugify(filename_hint or f"{source.stem}-copy", default="untitled")
    destination = ensure_unique_html_path(target_folder, base_stem)
    source_content = read_text(source)
    destination_folder = normalize_rel_path(relative_path(target_folder) if target_folder != PROJECT_ROOT else ".")
    content, uid = duplicate_file_content(source_content, destination_folder, destination.stem)
    write_text(destination, content)
    return jsonify(
        {
            "message": f'Created duplicate "{destination.name}".',
            "path": relative_path(destination),
            "uid": uid,
        }
    )


@app.post("/admin/move-file")
def move_file() -> Any:
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", "")
    folder_rel = normalize_rel_path(payload.get("folder", "."))
    filename = slugify(str(payload.get("filename", "")).strip() or Path(raw_path).stem, default="untitled")

    try:
        source = resolve_project_path(raw_path, must_exist=True, file_only=True)
        target_folder = resolve_project_path(folder_rel, must_exist=True)
    except FileNotFoundError:
        return jsonify({"message": "Source or target path was not found."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    if not target_folder.is_dir():
        return jsonify({"message": "Target path is not a folder."}), 400

    destination = target_folder / f"{filename}.html"
    if destination.exists() and destination != source:
        return jsonify({"message": "A file with that name already exists in the target folder."}), 400

    shutil.move(str(source), str(destination))
    return jsonify({"message": "File moved successfully.", "path": relative_path(destination)})


@app.post("/admin/delete-file")
def delete_file() -> Any:
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", "")
    try:
        file_path = resolve_project_path(raw_path, must_exist=True, file_only=True)
    except FileNotFoundError:
        return jsonify({"message": "File not found."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    file_path.unlink()
    return jsonify({"message": f"Deleted {relative_path(file_path)}."})


@app.post("/admin/delete-folder")
def delete_folder() -> Any:
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", "")
    folder_rel = normalize_rel_path(raw_path)
    if folder_rel == ".":
        return jsonify({"message": "Cannot delete the root folder."}), 400
    try:
        folder_path = resolve_project_path(folder_rel, must_exist=True)
    except FileNotFoundError:
        return jsonify({"message": "Folder not found."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    if not folder_path.is_dir():
        return jsonify({"message": "Path is not a folder."}), 400

    # Count files before deleting
    file_count = 0
    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if not should_skip_dir(d)]
        for filename in files:
            if filename.lower().endswith(".html"):
                file_count += 1

    shutil.rmtree(folder_path)
    return jsonify({"message": f"Deleted folder '{folder_rel}' with {file_count} HTML file(s)."})


@app.post("/admin/convert-file")
def convert_file() -> Any:
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("path", "")
    try:
        file_path = resolve_project_path(raw_path, must_exist=True, file_only=True)
    except FileNotFoundError:
        return jsonify({"message": "File not found."}), 404
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400

    content = read_text(file_path)
    meta = parse_file_metadata(content)
    if meta["type"] == "quiz":
        questions = copy.deepcopy(meta.get("questions") or [])
        config = {
            "uid": meta.get("uid") or derive_uid(normalize_rel_path(relative_path(file_path.parent)), file_path.stem),
            "title": meta.get("title") or file_path.stem,
            "description": meta.get("description") or "",
            "icon": "🗃️",
        }
        write_text(file_path, create_bank_html(config, questions))
        return jsonify({"message": "Converted quiz to question bank while preserving UID."})
    if meta["type"] == "bank":
        questions = copy.deepcopy(meta.get("questions") or [])
        config = {
            "uid": meta.get("uid") or derive_uid(normalize_rel_path(relative_path(file_path.parent)), file_path.stem),
            "title": meta.get("title") or file_path.stem,
            "description": meta.get("description") or "",
        }
        write_text(file_path, create_quiz_html(config, questions))
        return jsonify({"message": "Converted question bank to quiz while preserving UID."})
    return jsonify({"message": "Only quiz and bank files can be converted."}), 400


@app.post("/admin/run-sync")
def run_sync() -> Any:
    if not SYNC_SCRIPT.exists():
        return jsonify({"message": "Sync script not found."}), 404

    result = run_subprocess([sys.executable, str(SYNC_SCRIPT)], cwd=PROJECT_ROOT)
    message = "Sync completed successfully." if result.returncode == 0 else "Sync completed with errors."
    return jsonify(
        {
            "message": message,
            "returncode": result.returncode,
            "output": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    )


@app.post("/admin/git-commit")
def git_commit() -> Any:
    if not git_available():
        return jsonify({"message": "Git is not available for this repository."}), 400
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message", "")).strip() or "Update quiz project files"

    add_result = run_subprocess(["git", "add", "-A"])
    if add_result.returncode != 0:
        return jsonify({"message": "Git add failed.", "output": add_result.stderr.strip()}), 500

    commit_result = run_subprocess(["git", "commit", "-m", message])
    if commit_result.returncode != 0:
        return jsonify(
            {
                "message": "Git commit failed.",
                "output": (commit_result.stdout or commit_result.stderr).strip(),
            }
        ), 500

    return jsonify({"message": "Commit created successfully.", "output": commit_result.stdout.strip()})


@app.post("/admin/git-pull")
def git_pull() -> Any:
    if not git_available():
        return jsonify({"message": "Git is not available for this repository."}), 400

    pull_result = run_subprocess(["git", "pull", "--rebase", "--autostash"])
    if pull_result.returncode != 0:
        return jsonify(
            {
                "message": "Git pull failed.",
                "output": (pull_result.stdout or pull_result.stderr).strip(),
            }
        ), 500
    return jsonify({"message": "Pull completed successfully.", "output": pull_result.stdout.strip()})


@app.post("/admin/git-push")
def git_push() -> Any:
    if not git_available():
        return jsonify({"message": "Git is not available for this repository."}), 400

    push_result = run_subprocess(["git", "push"])
    if push_result.returncode != 0:
        return jsonify({"message": "Git push failed.", "output": push_result.stderr.strip()}), 500
    return jsonify({"message": "Push completed successfully.", "output": push_result.stdout.strip()})


@app.get("/admin/pdf-exporter")
def pdf_exporter() -> Any:
    return render_template_string(PDF_EXPORTER_HTML)


@app.get("/")
def root_index() -> Any:
    return send_from_directory(PROJECT_ROOT, "index.html")


@app.get("/<path:filename>")
def static_files(filename: str) -> Any:
    normalized = normalize_rel_path(filename)
    if any(part.startswith(".") or part in SKIP_DIRS for part in Path(normalized).parts):
        return jsonify({"message": "Unsupported asset type."}), 404
    candidate = (PROJECT_ROOT / filename).resolve()
    if not is_relative_to(candidate, PROJECT_ROOT):
        return jsonify({"message": "Invalid path."}), 400
    if not candidate.exists() or candidate.is_dir():
        return jsonify({"message": "File not found."}), 404
    if candidate.suffix.lower() not in ASSET_SUFFIXES:
        return jsonify({"message": "Unsupported asset type."}), 404
    return send_from_directory(PROJECT_ROOT, filename)


def open_browser() -> None:
    webbrowser.open(f"http://{HOST}:{PORT}/admin/")


if __name__ == "__main__":
    # Support --port argument and QUIZTOOL_ADMIN_PORT env var
    # so the generator can launch the dashboard on a different port (5501)
    _port = PORT
    if os.environ.get("QUIZTOOL_ADMIN_PORT"):
        try:
            _port = int(os.environ["QUIZTOOL_ADMIN_PORT"])
        except ValueError:
            pass
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            try:
                _port = int(sys.argv[idx + 1])
            except ValueError:
                pass
    PORT = _port

    print(f"Starting Admin Dashboard for {get_project_name()}")
    print(f"Opening http://{HOST}:{PORT}/admin/ in your browser")
    print("Press Ctrl+C to stop")
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        threading.Timer(1.0, open_browser).start()
    app.run(host=HOST, port=PORT, debug=True)
