// Site-wide play records — the arcade high-score table, one line per game.
//
// On load, GET the records and fill each game's chip ("longest rally · 14 ·
// TG"). When a run ends, the game calls PlayRecords.report(game, score);
// beat the site record and the ended card grows an initials entry — two
// arcade letter slots, Enter to claim, Esc to wave it off. While the entry
// is open a capture-phase guard swallows keys and board clicks so Space
// can't restart the game mid-signature.
window.PlayRecords = (function () {
  var ENDPOINT = window.SCORES_ENDPOINT ||
    'https://tigo-design-portfolio.vercel.app/api/scores';
  var LABELS = { pong: 'longest rally', snake: 'longest snake', flappy: 'longest run' };
  var BOARDS = { pong: 'board', snake: 'snake-board', flappy: 'flappy-board' };
  var SLOTS = 2;                 // two letters to sign — keep .entry-slot count,
                                 // the input's maxlength, and api/scores.js in step

  var records = { pong: null, snake: null, flappy: null };
  var loaded = false;
  var offline = false;
  var entry = null;              // { game, score, letters, el, slots, status }

  function chipEl(game) { return document.getElementById('record-' + game); }

  function renderChip(game, pop) {
    var el = chipEl(game);
    if (!el) return;
    var val = el.querySelector('.record-val');
    el.classList.remove('is-offline');
    if (offline) {
      val.textContent = 'scoreboard offline';
      el.classList.add('is-offline');
    } else if (!loaded) {
      val.textContent = '…';
    } else if (!records[game]) {
      val.textContent = 'unclaimed';
    } else {
      val.textContent = records[game].score + ' · ' + records[game].initials;
    }
    if (pop) {
      el.classList.remove('is-pop');
      void el.offsetWidth;              // restart the animation
      el.classList.add('is-pop');
    }
  }

  function renderAll(pop) {
    for (var game in LABELS) renderChip(game, pop);
  }

  function refresh() {
    return fetch(ENDPOINT)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        records = data.records || records;
        loaded = true;
        offline = false;
        renderAll(false);
      })
      .catch(function () {
        offline = !loaded;
        renderAll(false);
      });
  }

  /* ---- the initials entry ---- */

  function buildEntry(game, score) {
    var board = document.getElementById(BOARDS[game]);
    if (!board) return null;
    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var el = document.createElement('div');
    el.className = 'record-entry';
    el.innerHTML =
      '<p class="entry-head"><strong>site record!</strong> ' +
      (coarse ? 'tap to sign your initials' : 'type your initials') + '</p>' +
      '<div class="entry-slots" aria-label="Your initials">' +
      '<span class="entry-slot is-cur"></span>' +
      '<span class="entry-slot"></span>' +
      '</div>' +
      '<input class="entry-input" type="text" maxlength="' + SLOTS + '" ' +
      'autocapitalize="characters" autocomplete="off" aria-label="Your initials" />' +
      '<p class="entry-hint">' +
      (coarse ? 'return to claim' : 'enter to claim &middot; esc to skip') + '</p>';
    board.appendChild(el);

    // the hidden input summons the OS keyboard on touch screens; on
    // desktop the capture-phase handler feeds the slots directly
    var inp = el.querySelector('.entry-input');
    el.addEventListener('click', function (e) {
      e.stopPropagation();
      if (inp) inp.focus({ preventScroll: true });
    });
    if (inp) {
      inp.addEventListener('input', function () {
        if (!entry || entry.busy) return;
        entry.letters = inp.value.toUpperCase().replace(/[^A-Z]/g, '')
          .slice(0, SLOTS).split('');
        renderSlots();
      });
    }
    if (coarse && inp) inp.focus({ preventScroll: true });

    return {
      game: game,
      score: score,
      letters: [],
      el: el,
      input: inp,
      slots: Array.prototype.slice.call(el.querySelectorAll('.entry-slot')),
      hint: el.querySelector('.entry-hint'),
      busy: false,
    };
  }

  function renderSlots() {
    if (!entry) return;
    entry.slots.forEach(function (slot, i) {
      slot.textContent = entry.letters[i] || '';
      slot.classList.toggle('is-cur',
        i === Math.min(entry.letters.length, entry.slots.length - 1));
    });
    // keep the hidden input mirrored so both input paths agree
    if (entry.input) entry.input.value = entry.letters.join('');
  }

  function closeEntry() {
    if (!entry) return;
    entry.el.remove();
    entry = null;
  }

  function submitEntry() {
    if (!entry || entry.busy || !entry.letters.length) return;
    entry.busy = true;
    entry.hint.textContent = 'claiming…';
    var claimed = { game: entry.game, score: entry.score, initials: entry.letters.join('') };
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(claimed),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        records = data.records || records;
        loaded = true;
        renderAll(true);
        if (!entry) return;
        if (data.beaten) {
          closeEntry();
        } else {
          // someone set a higher score while this run was being played out
          entry.hint.textContent = 'beaten moments ago — record is ' +
            (records[entry.game] ? records[entry.game].score : '?');
          entry.busy = false;
          setTimeout(closeEntry, 2600);
        }
      })
      .catch(function () {
        if (!entry) return;
        entry.hint.textContent = "couldn't reach the scoreboard";
        entry.busy = false;
        setTimeout(closeEntry, 2600);
      });
  }

  // Capture-phase guards: while the entry is open, letters land in the
  // slots and nothing leaks through to the games (Space restarts, clicks
  // start countdowns).
  function onKeyCapture(e) {
    if (!entry) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); closeEntry(); return; }
    if (e.key === 'Enter') { e.preventDefault(); submitEntry(); return; }
    // keys aimed at the hidden input flow through to it — its `input`
    // event keeps the slots in sync (the touch-keyboard path)
    if (entry.input && e.target === entry.input) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (!entry.busy) { entry.letters.pop(); renderSlots(); }
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      if (!entry.busy && entry.letters.length < SLOTS) {
        entry.letters.push(e.key.toUpperCase());
        renderSlots();
      }
      return;
    }
    // arrows, space, everything else: swallowed while signing
    e.preventDefault();
  }

  function onClickCapture(e) {
    if (!entry) return;
    var board = document.getElementById(BOARDS[entry.game]);
    if (board && board.contains(e.target)) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  /* ---- the games call this at game over ---- */
  function report(game, score) {
    if (!(game in LABELS)) return;
    if (!Number.isFinite(score) || score < 1) return;
    if (offline || !loaded) return;
    var current = records[game];
    if (current && score <= current.score) return;
    closeEntry();
    entry = buildEntry(game, score);
    renderSlots();
  }

  function init() {
    renderAll(false);
    refresh();
    document.addEventListener('keydown', onKeyCapture, true);
    document.addEventListener('click', onClickCapture, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { report: report, refresh: refresh };
})();
