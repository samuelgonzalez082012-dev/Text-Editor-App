/**
 * This file is loaded via the <script> tag in the index.html file and will
 * be executed in the renderer process for that window. No Node.js APIs are
 * available in this process because `nodeIntegration` is turned off and
 * `contextIsolation` is turned on. Use the contextBridge API in `preload.js`
 * to expose Node.js functionality from the main process.
 */
(function () {
  var KEY = 'bbdocs.v1';
  var $ = function (s) { return document.querySelector(s); };
  var app = $('#app'), editor = $('#editor'), titleEl = $('#title'), listEl = $('#doclist');
  var statusEl = $('#status'), statsEl = $('#stats'), fontSel = $('#font'), blockSel = $('#block');
  var linkBar = $('#linkbar'), linkIn = $('#linkurl'), toast = $('#toast');
  var state = { docs: [], current: null };
  var saveTimer = null, toastTimer = null, lastRange = null, storageOK = true;

  function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }
  function isNarrow() { return window.matchMedia('(max-width: 759px)').matches; }
  function currentDoc() { return state.docs.find(function (d) { return d.id === state.current; }); }

  function welcomeDoc() {
    return {
      id: uid(), title: 'Welcome', font: 'sans', updated: Date.now(),
      html: '<h1>Welcome</h1><p>This is a bare bones place to write. Everything you type is saved in this browser as you go.</p>' +
        '<h2>Things to try</h2><ul><li>Select some text, then use the toolbar or press <b>Ctrl+B</b> / <b>⌘B</b>.</li>' +
        '<li>Change the paragraph style or the font from the toolbar.</li>' +
        '<li>Start another document from the list on the left.</li></ul>' +
        '<p>Delete this page whenever you like.</p>'
    };
  }
  function blankDoc() { return { id: uid(), title: '', font: (window.workspaceSettings && window.workspaceSettings.defaultFont) || 'sans', html: '<p><br></p>', updated: Date.now() }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && Array.isArray(s.docs)) state = s; }
    } catch (e) { storageOK = false; }
    if (!state.docs.length) { var w = welcomeDoc(); state = { docs: [w], current: w.id }; }
    if (!currentDoc()) state.current = state.docs[0].id;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); storageOK = true; }
    catch (e) { storageOK = false; }
  }
  function setStatus(saving) {
    statusEl.textContent = saving ? 'Saving…' : (storageOK ? 'Saved in this browser' : 'Not saved: browser storage is unavailable');
  }
  function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    var d = currentDoc(); if (!d) return;
    d.html = editor.innerHTML; persist(); setStatus(false);
  }
  function queueSave() {
    var d = currentDoc(); if (!d) return;
    d.html = editor.innerHTML; d.updated = Date.now();
    setStatus(true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { persist(); setStatus(false); renderList(); }, 400);
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function renderList() {
    listEl.textContent = '';
    state.docs.slice().sort(function (a, b) { return b.updated - a.updated; }).forEach(function (d) {
      var li = document.createElement('li');
      if (d.id === state.current) li.className = 'current';
      var open = document.createElement('button');
      open.type = 'button'; open.className = 'doc'; open.dataset.id = d.id;
      var t = document.createElement('span'); t.className = 't'; t.textContent = d.title || 'Untitled document';
      var dt = document.createElement('span'); dt.className = 'd'; dt.textContent = fmtDate(d.updated);
      open.appendChild(t); open.appendChild(dt);
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'del'; del.dataset.id = d.id; del.textContent = 'Delete';
      del.setAttribute('aria-label', 'Delete ' + (d.title || 'Untitled document'));
      li.appendChild(open); li.appendChild(del);
      listEl.appendChild(li);
    });
  }

  function updateEmpty() {
    var empty = editor.innerText.trim() === '' && editor.children.length <= 1 && !editor.querySelector('ul,ol,img');
    Array.prototype.forEach.call(editor.querySelectorAll('[data-ph]'), function (n) { n.removeAttribute('data-ph'); });
    if (empty && editor.firstElementChild) editor.firstElementChild.setAttribute('data-ph', 'Start writing…');
  }
  function updateStats() {
    var text = editor.innerText.trim();
    var words = text ? text.split(/\s+/).length : 0;
    var mins = Math.max(1, Math.round(words / 230));
    statsEl.textContent = words.toLocaleString() + (words === 1 ? ' word' : ' words') + ' · ' + text.length.toLocaleString() + ' characters' + (words ? ' · ' + mins + ' min read' : '');
  }

  function openDoc(id, keepSidebar) {
    flush();
    state.current = id;
    var d = currentDoc();
    titleEl.value = d.title || '';
    editor.innerHTML = d.html || '<p><br></p>';
    if (!editor.firstElementChild) editor.innerHTML = '<p><br></p>';
    editor.setAttribute('data-font', d.font || 'sans');
    fontSel.value = d.font || 'sans';
    updateEmpty(); updateStats(); renderList(); persist(); setStatus(false);
    hideLink();
    $('#canvas').scrollTop = 0;
    if (isNarrow() && !keepSidebar) app.classList.remove('open');
  }

  function newDoc() {
    var d = blankDoc();
    state.docs.push(d);
    openDoc(d.id);
    editor.focus();
  }
  function deleteDoc(id) {
    state.docs = state.docs.filter(function (d) { return d.id !== id; });
    if (!state.docs.length) state.docs.push(blankDoc());
    if (id === state.current) { state.current = null; openDoc(state.docs[0].id, true); }
    else { persist(); renderList(); }
  }

  listEl.addEventListener('click', function (e) {
    var del = e.target.closest('.del');
    if (del) {
      if (del.classList.contains('armed')) { deleteDoc(del.dataset.id); return; }
      del.classList.add('armed'); del.textContent = 'Sure?';
      setTimeout(function () { if (del.isConnected) { del.classList.remove('armed'); del.textContent = 'Delete'; } }, 3000);
      return;
    }
    var open = e.target.closest('.doc');
    if (open && open.dataset.id !== state.current) openDoc(open.dataset.id);
    else if (open && isNarrow()) app.classList.remove('open');
  });
  $('#newdoc').addEventListener('click', newDoc);
  $('#sbtoggle').addEventListener('click', function () {
    app.classList.toggle(isNarrow() ? 'open' : 'collapsed');
  });
  $('#scrim').addEventListener('click', function () { app.classList.remove('open'); });

  titleEl.addEventListener('input', function () {
    var d = currentDoc(); if (!d) return;
    d.title = titleEl.value; d.updated = Date.now(); setStatus(true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { d.html = editor.innerHTML; persist(); setStatus(false); renderList(); }, 400);
  });
  titleEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); editor.focus(); } });

  /* Selection tracking, so toolbar controls that take focus can still act on the text */
  function inEditor(node) { return node && editor.contains(node.nodeType === 3 ? node.parentNode : node); }
  function restoreRange() {
    editor.focus();
    if (lastRange) { var s = getSelection(); s.removeAllRanges(); s.addRange(lastRange); }
  }
  document.addEventListener('selectionchange', function () {
    var s = getSelection();
    if (s.rangeCount && inEditor(s.anchorNode)) { lastRange = s.getRangeAt(0).cloneRange(); syncToolbar(); }
  });
  function syncToolbar() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cmd]'), function (b) {
      var c = b.dataset.cmd;
      if (c === 'undo' || c === 'redo' || c === 'removeFormat') return;
      var on = false; try { on = document.queryCommandState(c); } catch (e) {}
      b.classList.toggle('on', !!on);
    });
    var v = 'p'; try { v = (document.queryCommandValue('formatBlock') || 'p').toLowerCase().replace(/[<>]/g, ''); } catch (e) {}
    if (['h1', 'h2', 'h3', 'blockquote'].indexOf(v) < 0) v = 'p';
    blockSel.value = v;
  }
  function afterEdit() { queueSave(); updateEmpty(); updateStats(); syncToolbar(); }

  function exec(cmd, val) { editor.focus(); document.execCommand(cmd, false, val); afterEdit(); }

  $('#tools').addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) e.preventDefault();
  });
  $('#tools').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cmd]');
    if (b) exec(b.dataset.cmd);
  });

  blockSel.addEventListener('change', function () {
    restoreRange(); document.execCommand('formatBlock', false, blockSel.value); afterEdit();
  });
  fontSel.addEventListener('change', function () {
    var d = currentDoc(); if (!d) return;
    d.font = fontSel.value; editor.setAttribute('data-font', d.font); queueSave(); editor.focus();
  });

  function colorCmd(input, cmd, glyph) {
    input.addEventListener('change', function () {
      restoreRange();
      document.execCommand('styleWithCSS', false, true);
      document.execCommand(cmd, false, input.value);
      document.execCommand('styleWithCSS', false, false);
      glyph.style.setProperty('--sw', input.value);
      afterEdit();
    });
  }
  colorCmd($('#fgcolor'), 'foreColor', $('#fgglyph'));
  colorCmd($('#bgcolor'), 'hiliteColor', $('#bgglyph'));
  $('#fgglyph').style.setProperty('--sw', '#d93b3b');

  /* Links */
  function showLink() {
    var s = getSelection();
    var a = s.anchorNode && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentNode : s.anchorNode).closest && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentNode : s.anchorNode).closest('a');
    linkIn.value = a ? a.getAttribute('href') : '';
    linkBar.hidden = false; linkIn.focus(); linkIn.select();
  }
  function hideLink() { linkBar.hidden = true; }
  function applyLink() {
    var url = linkIn.value.trim();
    if (!url) { hideLink(); return; }
    if (!/^(https?:\/\/|mailto:)/i.test(url)) url = 'https://' + url;
    restoreRange();
    if (lastRange && lastRange.collapsed) {
      var esc = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      document.execCommand('insertHTML', false, '<a href="' + esc + '">' + esc + '</a>&nbsp;');
    } else {
      document.execCommand('createLink', false, url);
    }
    hideLink(); afterEdit();
  }
  $('#linkbtn').addEventListener('click', showLink);
  $('#linkok').addEventListener('click', applyLink);
  $('#linkcancel').addEventListener('click', function () { hideLink(); restoreRange(); });
  $('#linkrm').addEventListener('click', function () { restoreRange(); document.execCommand('unlink'); hideLink(); afterEdit(); });
  linkIn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
    if (e.key === 'Escape') { hideLink(); restoreRange(); }
  });

  /* Editing behavior */
  editor.addEventListener('input', afterEdit);
  editor.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (text == null) return;
    e.preventDefault();
    document.execCommand('insertText', false, text);
  });
  editor.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      var s = getSelection();
      var n = s.anchorNode && (s.anchorNode.nodeType === 3 ? s.anchorNode.parentNode : s.anchorNode);
      if (n && n.closest && n.closest('li')) { e.preventDefault(); exec(e.shiftKey ? 'outdent' : 'indent'); }
    }
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  /* Copy out. Downloads are blocked inside an artifact, so copying is the way to take text elsewhere. */
  function showToast(msg) {
    toast.textContent = msg; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.hidden = true; }, 2200);
  }
  function copyOut(text, label) {
    var done = function () { showToast(label + ' copied'); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      if (ok) done(); else showToast('Copy was blocked here. Select the text and copy it directly.');
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  $('#copytext').addEventListener('click', function () { copyOut(editor.innerText, 'Text'); });
  $('#copyhtml').addEventListener('click', function () { copyOut(editor.innerHTML, 'HTML'); });


  /* Workspace navigation, dashboard and persistent preferences (Phase 2). */
  var SETTINGS_KEY = 'texteditor.settings.v1';
  var defaults = { theme: 'system', accent: '#315bd6', defaultFont: 'sans' };
  var workspaceSettings = Object.assign({}, defaults);
  try { workspaceSettings = Object.assign({}, defaults, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) {}
  window.workspaceSettings = workspaceSettings;

  function applySettings() {
    if (workspaceSettings.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', workspaceSettings.theme);
    document.documentElement.style.setProperty('--accent', workspaceSettings.accent);
    document.documentElement.style.setProperty('--accent-soft', workspaceSettings.theme === 'dark' ? 'color-mix(in srgb, ' + workspaceSettings.accent + ' 22%, #20293a)' : 'color-mix(in srgb, ' + workspaceSettings.accent + ' 11%, white)');
    $('#theme-setting').value = workspaceSettings.theme;
    $('#accent-setting').value = workspaceSettings.accent;
    $('#default-font-setting').value = workspaceSettings.defaultFont;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(workspaceSettings)); } catch (e) {}
  }

  function showView(view) {
    $('#homeview').hidden = view !== 'home';
    $('#documentsview').hidden = view !== 'documents';
    $('#editorview').hidden = view !== 'editor';
    $('#viewlabel').textContent = view === 'home' ? 'Home' : view === 'documents' ? 'Documents' : 'Editor';
    document.querySelectorAll('[data-view]').forEach(function (b) { b.classList.toggle('active', b.dataset.view === view); });
    if (view === 'home' || view === 'documents') renderWorkspace();
    if (isNarrow()) app.classList.remove('open');
  }

  function makeDocumentCard(d, compact) {
    var card = document.createElement('button');
    card.type = 'button'; card.className = compact ? 'recent-card' : 'library-row';
    var icon = document.createElement('span'); icon.className = compact ? 'recent-card-icon' : 'library-icon'; icon.textContent = '▤';
    var copy = document.createElement('span');
    if (!compact) copy.className = 'library-row-copy';
    var name = document.createElement(compact ? 'strong' : 'strong'); name.textContent = d.title || 'Untitled document';
    var date = document.createElement('small'); date.textContent = 'Edited ' + fmtDate(d.updated);
    copy.appendChild(name); copy.appendChild(date);
    card.appendChild(icon); card.appendChild(copy);
    card.addEventListener('click', function () { openDoc(d.id); });
    return card;
  }

  function renderWorkspace() {
    var ordered = state.docs.slice().sort(function (a, b) { return b.updated - a.updated; });
    $('#doccount').textContent = ordered.length.toLocaleString();
    $('#librarycount').textContent = ordered.length + (ordered.length === 1 ? ' document' : ' documents');
    var recent = $('#recentgrid'); recent.textContent = '';
    if (!ordered.length) {
      var empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No documents yet. Create your first document to get started.'; recent.appendChild(empty);
    } else ordered.slice(0, 6).forEach(function (d) { recent.appendChild(makeDocumentCard(d, true)); });
    var library = $('#librarylist'); library.textContent = '';
    if (!ordered.length) {
      var emptyLibrary = document.createElement('div'); emptyLibrary.className = 'empty-state'; emptyLibrary.textContent = 'Your document library is empty.'; library.appendChild(emptyLibrary);
    } else ordered.forEach(function (d) { library.appendChild(makeDocumentCard(d, false)); });
  }

  function openSettings() {
    $('#settingsbackdrop').hidden = false;
    $('#theme-setting').focus();
  }
  function closeSettings() { $('#settingsbackdrop').hidden = true; }
  function saveSetting(key, value) {
    workspaceSettings[key] = value;
    applySettings();
  }

  document.querySelectorAll('[data-view]').forEach(function (button) {
    button.addEventListener('click', function () { showView(button.dataset.view); });
  });
  $('#brandhome').addEventListener('click', function (e) { e.preventDefault(); showView('home'); });
  $('#homecreate').addEventListener('click', newDoc);
  $('#librarycreate').addEventListener('click', newDoc);
  $('#viewall').addEventListener('click', function () { showView('documents'); });
  $('#settingsbtn').addEventListener('click', openSettings);
  $('#topsettings').addEventListener('click', openSettings);
  $('#closesettings').addEventListener('click', closeSettings);
  $('#done-settings').addEventListener('click', closeSettings);
  $('#settingsbackdrop').addEventListener('click', function (e) { if (e.target === $('#settingsbackdrop')) closeSettings(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSettings(); });
  $('#theme-setting').addEventListener('change', function (e) { saveSetting('theme', e.target.value); });
  $('#accent-setting').addEventListener('input', function (e) { saveSetting('accent', e.target.value); });
  $('#default-font-setting').addEventListener('change', function (e) { saveSetting('defaultFont', e.target.value); });
  $('#resetsettings').addEventListener('click', function () { workspaceSettings = Object.assign({}, defaults); window.workspaceSettings = workspaceSettings; applySettings(); });
  $('#appversion').textContent = window.desktopApp && window.desktopApp.version ? window.desktopApp.version : '0.2.0';
  applySettings();

  /* Start */
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  if (isNarrow()) app.classList.remove('open');
  load();
  openDoc(state.current, true);
})();