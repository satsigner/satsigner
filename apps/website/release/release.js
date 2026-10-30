(function () {
  var R = window.RELEASE;
  var STORE = 'release-kit:v1';
  var state = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('kit-toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 1400);
  }

  function copy(text, label) {
    var done = function () { toast('Copied ' + label); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = el('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      done();
    }
  }

  function copyButton(get, label) {
    var b = el('button', { type: 'button', class: 'kit-link-button', text: 'Copy' });
    b.addEventListener('click', function () { copy(get(), label); });
    return b;
  }

  // Ticks shared by blockers and checklist so progress covers both.
  function tick(id) { return !!(state.ticks && state.ticks[id]); }
  function setTick(id, on) {
    state.ticks = state.ticks || {};
    if (on) state.ticks[id] = true; else delete state.ticks[id];
    save();
    progress();
  }

  var allTicks = [];

  function storeLabel(id) {
    var store = R.stores.filter(function (st) { return st.id === id; })[0];
    return store ? store.label : 'All stores';
  }

  function progress() {
    var done = allTicks.filter(tick).length;
    var box = document.getElementById('kit-progress');
    box.querySelector('i').style.width = (allTicks.length ? done / allTicks.length * 100 : 0) + '%';
    box.querySelector('span').textContent = done + ' of ' + allTicks.length + ' done';
  }

  function checkbox(id, onChange) {
    var input = el('input', { type: 'checkbox' });
    input.checked = tick(id);
    input.addEventListener('change', function () { setTick(id, input.checked); onChange(input.checked); });
    allTicks.push(id);
    return input;
  }

  document.getElementById('kit-meta').textContent =
    R.app.name + ' · ' + R.app.bundleId + ' · iOS ' + R.app.version;

  // Public pages, with a live reachability check.
  var pages = document.getElementById('kit-pages');
  [['Privacy Policy', '/privacy-policy/'], ['Terms of Use', '/terms/'], ['Support', '/support/'], ['Marketing', '/']].forEach(function (p) {
    var dot = el('span', { class: 'kit-dot' });
    var url = R.app.site + p[1];
    pages.appendChild(el('li', {}, [dot, el('a', { href: p[1], text: p[0] }), el('code', { text: url }), copyButton(function () { return url; }, p[0] + ' URL')]));
    fetch(p[1], { method: 'HEAD' }).then(function (r) { dot.classList.add(r.ok ? 'is-ok' : 'is-bad'); }, function () { dot.classList.add('is-bad'); });
  });

  // Blockers.
  var blockers = document.getElementById('kit-blockers');
  R.blockers.forEach(function (b, i) {
    var id = 'blocker:' + i;
    var card = el('div', { class: 'kit-card kit-blocker' });
    var sync = function (on) { card.classList.toggle('is-done', on); };
    card.appendChild(el('label', {}, [checkbox(id, sync), el('h3', { text: storeLabel(b.store) + ' · ' + b.title })]));
    card.appendChild(el('p', { text: b.body }));
    card.appendChild(el('p', { class: 'kit-where', text: b.where }));
    sync(tick(id));
    blockers.appendChild(card);
  });

  // Checklist.
  var checklist = document.getElementById('kit-checklist');
  R.checklist.forEach(function (g) {
    var group = el('div', { class: 'kit-group' }, [el('h3', { text: g.group })]);
    g.items.forEach(function (item) {
      var id = 'check:' + g.group + ':' + item;
      var row = el('label', { class: 'kit-check' });
      var sync = function (on) { row.classList.toggle('is-done', on); };
      row.appendChild(checkbox(id, sync));
      row.appendChild(el('span', { text: item }));
      sync(tick(id));
      group.appendChild(row);
    });
    checklist.appendChild(group);
  });

  // Listing fields with limits and local drafts.
  var fields = document.getElementById('kit-fields');
  var lastGroup;
  state.drafts = state.drafts || {};
  R.fields.forEach(function (f) {
    var groupTitle = storeLabel(f.store) + ' · ' + f.group;
    if (groupTitle !== lastGroup) {
      fields.appendChild(el('h3', { class: 'kit-group-title', text: groupTitle }));
      lastGroup = groupTitle;
    }
    var box = el('div', { class: 'kit-field' });
    var input = f.multiline ? el('textarea', { rows: Math.min(18, f.value.split('\n').length + 1) }) : el('input', { type: 'text' });
    input.value = state.drafts[f.key] != null ? state.drafts[f.key] : f.value;
    var count = el('span', { class: 'kit-count' });
    var reset = el('button', { type: 'button', class: 'kit-link-button', text: 'Reset' });

    function sync() {
      var len = input.value.length;
      if (f.limit) {
        count.textContent = len + ' / ' + f.limit;
        count.classList.toggle('is-over', len > f.limit);
      }
      var edited = input.value !== f.value;
      box.classList.toggle('is-edited', edited);
      reset.hidden = !edited;
    }

    input.addEventListener('input', function () {
      if (input.value === f.value) delete state.drafts[f.key];
      else state.drafts[f.key] = input.value;
      save();
      sync();
    });
    reset.addEventListener('click', function () {
      input.value = f.value;
      delete state.drafts[f.key];
      save();
      sync();
    });

    box.appendChild(el('div', { class: 'kit-field-head' }, [
      el('strong', { text: f.label }),
      el('div', { class: 'kit-field-tools' }, [count, reset, copyButton(function () { return input.value; }, f.label)])
    ]));
    box.appendChild(input);
    if (f.note) box.appendChild(el('p', { class: 'kit-note', text: f.note }));
    sync();
    fields.appendChild(box);
  });

  // Compliance.
  var compliance = document.getElementById('kit-compliance');
  R.answers.forEach(function (a) {
    var card = el('div', { class: 'kit-card' }, [
      el('h3', { text: storeLabel(a.store) + ' · ' + a.title + ': ' + a.answer })
    ]);
    a.notes.forEach(function (p) { card.appendChild(el('p', { text: p })); });
    compliance.appendChild(card);
  });

  var purpose = document.getElementById('kit-purpose');
  R.purposeStrings.forEach(function (p) {
    var card = el('div', { class: 'kit-card kit-purpose' }, [
      el('code', { text: p.key }),
      copyButton(function () { return p.value; }, p.key),
      el('p', { text: p.value })
    ]);
    if (p.note) card.appendChild(el('p', { class: 'kit-where', text: p.note }));
    purpose.appendChild(card);
  });

  // Graphic formats.
  var formats = el('div', { class: 'kit-formats' });
  R.formats.forEach(function (f) {
    formats.appendChild(el('div', { class: 'kit-card kit-format' }, [
      el('span', { class: 'kit-tag' + (f.required ? '' : ' is-optional'), text: f.required ? 'Required' : 'Optional' }),
      el('strong', { text: f.label }),
      el('code', { text: f.w + ' × ' + f.h }),
      el('p', { class: 'kit-where', text: f.note })
    ]));
  });
  document.getElementById('kit-formats').appendChild(formats);

  progress();
})();
