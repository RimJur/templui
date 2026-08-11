(function () {
  'use strict';
  // Safari/iOS < 17 does not know the :popover-open selector and throws a
  // SyntaxError DOMException on matches() instead of returning false (#583).
  function matchesPopoverOpen(el) {
    if (!el) return false;
    try {
      return el.matches(':popover-open');
    } catch (e) {
      return false;
    }
  }

  // Segments show this before they hold a value, mirroring the native
  // <input type="time"> placeholder.
  const EMPTY = '--';

  // How long a half-typed segment keeps its first digit. Past this the next
  // keystroke starts a fresh number, which is what the native widget does.
  const TYPE_RESET_MS = 1200;

  const NEXT_SEGMENT = { hour: 'minute', minute: 'period' };
  const PREV_SEGMENT = { period: 'minute', minute: 'hour' };

  /**
   * Reactive Binding for hidden inputs
   *
   * Problem: Setting input.value programmatically (e.g., via Datastar/Alpine)
   * does NOT fire 'input' events - this is standard browser behavior since the 90s.
   *
   * Solution: Override the value setter to dispatch 'input' events on change.
   * This is the same pattern used by Vue.js, MobX, and other reactive frameworks.
   */
  function enableReactiveBinding(input) {
    if (input._tui) return;
    input._tui = true;

    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (!desc?.set) return;

    Object.defineProperty(input, 'value', {
      get: desc.get,
      set(v) {
        const old = this.value;
        desc.set.call(this, v);
        if (old !== v) {
          this.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      configurable: true
    });
  }

  // Utility functions
  function pad(n) {
    return n.toString().padStart(2, '0');
  }

  function wrap(value, modulo) {
    return ((value % modulo) + modulo) % modulo;
  }

  function parseTime(str) {
    const match = str?.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const [_, hour, minute] = match.map(Number);
    return (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) ? { hour, minute } : null;
  }

  // Accepts what a person is likely to paste: "9:30", "09.30", "9:30 pm".
  function parseTimeLoose(str) {
    const match = str?.match(/^(\d{1,2})[:.\s]?(\d{2})\s*([ap])\.?m?\.?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (match[3]) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (match[3].toLowerCase() === 'p' ? 12 : 0);
    }
    return (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) ? { hour, minute } : null;
  }

  function formatTime(hour, minute, use12Hours) {
    if (hour === null || minute === null) return null;

    if (use12Hours) {
      const h = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${pad(h)}:${pad(minute)} ${hour >= 12 ? 'PM' : 'AM'}`;
    }
    return `${pad(hour)}:${pad(minute)}`;
  }

  // The hour as the 12-hour segment shows it (1-12).
  function to12(hour) {
    return hour % 12 === 0 ? 12 : hour % 12;
  }

  // A 12-hour segment reading plus a period, as a 24-hour hour.
  function to24(hour12, period) {
    if (hour12 === 12) return period === 'PM' ? 12 : 0;
    return period === 'PM' ? hour12 + 12 : hour12;
  }

  function isValidTime(hour, minute, minTime, maxTime) {
    if (!minTime && !maxTime) return true;
    const timeInMinutes = hour * 60 + minute;

    if (minTime) {
      const minInMinutes = minTime.hour * 60 + minTime.minute;
      if (timeInMinutes < minInMinutes) return false;
    }

    if (maxTime) {
      const maxInMinutes = maxTime.hour * 60 + maxTime.minute;
      if (timeInMinutes > maxInMinutes) return false;
    }

    return true;
  }

  // The bounds of a segment. 12-hour clocks have no hour zero.
  function segmentRange(kind, use12Hours) {
    if (kind !== 'hour') return { min: 0, max: 59 };
    return use12Hours ? { min: 1, max: 12 } : { min: 0, max: 23 };
  }

  // DOM helpers
  function findRoot(element) {
    return element?.closest('[data-tui-timepicker-root]') || null;
  }

  function findTrigger(element) {
    return findRoot(element)?.querySelector('[data-tui-timepicker="true"]') || null;
  }

  function getElements(trigger) {
    const root = findRoot(trigger);
    const popup = root?.querySelector('[data-tui-timepicker-popup]');
    if (!popup) return null;

    return {
      root,
      trigger,
      popup,
      hourList: popup.querySelector('[data-tui-timepicker-hour-list]'),
      minuteList: popup.querySelector('[data-tui-timepicker-minute-list]'),
      hiddenInput: root?.querySelector('[data-tui-timepicker-hidden-input]')
    };
  }

  function getSegments(trigger) {
    return {
      hour: trigger.querySelector('[data-tui-timepicker-segment="hour"]'),
      minute: trigger.querySelector('[data-tui-timepicker-segment="minute"]'),
      period: trigger.querySelector('[data-tui-timepicker-segment="period"]')
    };
  }

  function segmentKind(segment) {
    return segment?.getAttribute('data-tui-timepicker-segment') || '';
  }

  function focusSegment(trigger, kind) {
    const segment = getSegments(trigger)[kind];
    if (!segment || segment.disabled) return false;
    segment.focus();
    segment.select();
    return true;
  }

  function isPopoverOpen(trigger) {
    return matchesPopoverOpen(findRoot(trigger)?.querySelector('[data-tui-popover-content]'));
  }

  function closePopover(trigger) {
    const root = findRoot(trigger);
    const popoverContent = root?.querySelector('[data-tui-popover-content]');
    if (!matchesPopoverOpen(popoverContent)) return;

    try {
      popoverContent.hidePopover();
    } catch {
      // ignore
    }
  }

  // The trigger is a manual popover trigger, so opening it is our job: a click
  // has to tell "focus this segment" apart from "open the dropdown".
  function togglePopover(trigger) {
    const popoverRoot = findRoot(trigger)?.querySelector('[data-tui-popover-root]');
    if (!popoverRoot?.id || !window.tui?.popover) return;
    window.tui.popover.toggle(popoverRoot.id);
  }

  // State management
  function getState(trigger) {
    const hour = trigger.dataset.tuiTimepickerCurrentHour !== undefined
      ? parseInt(trigger.dataset.tuiTimepickerCurrentHour)
      : null;
    const use12Hours = trigger.getAttribute('data-tui-timepicker-use12hours') === 'true';

    // With an hour set the period is implied by it; the stored one only carries
    // an AM/PM chosen before any hour was.
    let period = null;
    if (use12Hours) {
      period = hour !== null
        ? (hour >= 12 ? 'PM' : 'AM')
        : (trigger.dataset.tuiTimepickerCurrentPeriod || null);
    }

    return {
      hour,
      minute: trigger.dataset.tuiTimepickerCurrentMinute !== undefined
        ? parseInt(trigger.dataset.tuiTimepickerCurrentMinute)
        : null,
      period,
      use12Hours,
      step: parseInt(trigger.getAttribute('data-tui-timepicker-step') || '1'),
      minTime: parseTime(trigger.getAttribute('data-tui-timepicker-min-time')),
      maxTime: parseTime(trigger.getAttribute('data-tui-timepicker-max-time')),
      amLabel: trigger.getAttribute('data-tui-timepicker-am-label') || 'AM',
      pmLabel: trigger.getAttribute('data-tui-timepicker-pm-label') || 'PM'
    };
  }

  function setState(trigger, hour, minute, period) {
    if (hour !== null && hour !== undefined) {
      trigger.dataset.tuiTimepickerCurrentHour = hour;
    } else {
      delete trigger.dataset.tuiTimepickerCurrentHour;
    }

    if (minute !== null && minute !== undefined) {
      trigger.dataset.tuiTimepickerCurrentMinute = minute;
    } else {
      delete trigger.dataset.tuiTimepickerCurrentMinute;
    }

    if (period) {
      trigger.dataset.tuiTimepickerCurrentPeriod = period;
    } else if (hour === null || hour === undefined) {
      delete trigger.dataset.tuiTimepickerCurrentPeriod;
    }

    updateDisplay(trigger);
  }

  // Set while the component writes the hidden input itself, so its own echo is
  // not mistaken for an outside change.
  let writingHiddenInput = false;

  // Display updates
  function writeSegment(segment, text, valueNow) {
    if (!segment) return;
    if (segment.value !== text) segment.value = text;

    const label = segment.getAttribute('aria-label') || '';
    if (text === EMPTY) {
      segment.removeAttribute('aria-valuenow');
      segment.setAttribute('aria-valuetext', label ? `Empty ${label}` : 'Empty');
    } else {
      segment.setAttribute('aria-valuenow', String(valueNow));
      segment.setAttribute('aria-valuetext', text);
    }
  }

  function updateDisplay(trigger) {
    const state = getState(trigger);
    const elements = getElements(trigger);
    const segments = getSegments(trigger);

    if (state.hour !== null) {
      const shown = state.use12Hours ? to12(state.hour) : state.hour;
      writeSegment(segments.hour, pad(shown), shown);
    } else {
      writeSegment(segments.hour, EMPTY);
    }

    if (state.minute !== null) {
      writeSegment(segments.minute, pad(state.minute), state.minute);
    } else {
      writeSegment(segments.minute, EMPTY);
    }

    if (segments.period) {
      if (state.period) {
        const isPM = state.period === 'PM';
        writeSegment(segments.period, isPM ? state.pmLabel : state.amLabel, isPM ? 1 : 0);
      } else {
        writeSegment(segments.period, EMPTY);
      }
    }

    // Update hidden input. The reactive binding turns this assignment into an
    // 'input' event, so flag it: a half-filled field clears the hidden value,
    // and reading that back as "no time" would wipe the segment still holding
    // one.
    if (elements?.hiddenInput) {
      writingHiddenInput = true;
      try {
        elements.hiddenInput.value = (state.hour !== null && state.minute !== null) ?
          formatTime(state.hour, state.minute, false) : '';
      } finally {
        writingHiddenInput = false;
      }
    }

    // Update selections if popup is visible
    if (elements?.hourList && elements?.minuteList) {
      updateSelections(elements, state);
    }
  }

  function updateSelections(elements, state) {
    // Update hour buttons
    elements.hourList.querySelectorAll('[data-tui-timepicker-hour]').forEach(btn => {
      const hour = parseInt(btn.getAttribute('data-tui-timepicker-hour'));
      let isSelected = false;

      if (state.hour !== null) {
        if (state.use12Hours) {
          isSelected = (hour === state.hour) ||
                      (hour === 0 && state.hour === 12) ||
                      (hour === state.hour - 12 && state.hour > 12);
        } else {
          isSelected = hour === state.hour;
        }
      }

      btn.setAttribute('data-tui-timepicker-selected', isSelected);

      // Check validity
      let valid = false;
      for (let m = 0; m < 60; m++) {
        if (isValidTime(hour, m, state.minTime, state.maxTime)) {
          valid = true;
          break;
        }
      }

      btn.disabled = !valid;
      btn.classList.toggle('opacity-50', !valid);
      btn.classList.toggle('cursor-not-allowed', !valid);
    });

    // Update minute buttons
    elements.minuteList.querySelectorAll('[data-tui-timepicker-minute]').forEach(btn => {
      const minute = parseInt(btn.getAttribute('data-tui-timepicker-minute'));
      const isSelected = minute === state.minute;
      const valid = state.hour === null || isValidTime(state.hour, minute, state.minTime, state.maxTime);

      btn.setAttribute('data-tui-timepicker-selected', isSelected);
      btn.disabled = !valid;
      btn.classList.toggle('opacity-50', !valid);
      btn.classList.toggle('cursor-not-allowed', !valid);
    });

    // Update AM/PM buttons
    const amBtn = elements.popup.querySelector('[data-tui-timepicker-period="AM"]');
    const pmBtn = elements.popup.querySelector('[data-tui-timepicker-period="PM"]');

    if (amBtn && pmBtn) {
      const isAM = state.period !== 'PM';
      amBtn.setAttribute('data-tui-timepicker-active', isAM);
      pmBtn.setAttribute('data-tui-timepicker-active', !isAM);
    }
  }

  // Writing a segment back into state
  function applySegmentValue(trigger, kind, value) {
    const state = getState(trigger);

    if (kind === 'minute') {
      setState(trigger, state.hour, value, state.period);
      return;
    }

    if (kind === 'hour') {
      const hour = state.use12Hours ? to24(value, state.period || 'AM') : value;
      setState(trigger, hour, state.minute, state.use12Hours ? (hour >= 12 ? 'PM' : 'AM') : undefined);
    }
  }

  function applyPeriod(trigger, period) {
    const state = getState(trigger);
    if (state.hour === null) {
      // No hour to re-base yet, so just remember the choice.
      trigger.dataset.tuiTimepickerCurrentPeriod = period;
      updateDisplay(trigger);
      return;
    }
    setState(trigger, to24(to12(state.hour), period), state.minute, period);
  }

  function clearSegment(trigger, kind) {
    const state = getState(trigger);

    if (kind === 'hour') {
      // Keep the period: it was on screen, and dropping the hour should not
      // silently flip PM back to AM when the next hour is typed.
      setState(trigger, null, state.minute, state.period);
      return;
    }
    if (kind === 'minute') {
      setState(trigger, state.hour, null, state.period);
      return;
    }
    // The 24-hour hour encodes the period, so AM/PM can only be emptied while
    // no hour is set.
    if (state.hour === null) {
      delete trigger.dataset.tuiTimepickerCurrentPeriod;
      updateDisplay(trigger);
    }
  }

  // Typing buffer: a segment holds its first digit briefly so "1" then "2"
  // reads as 12 rather than 2.
  function readBuffer(segment) {
    const at = parseInt(segment.dataset.tuiTimepickerBufferAt || '0', 10);
    if (!at || Date.now() - at > TYPE_RESET_MS) return '';
    return segment.dataset.tuiTimepickerBuffer || '';
  }

  function writeBuffer(segment, value) {
    if (value) {
      segment.dataset.tuiTimepickerBuffer = value;
      segment.dataset.tuiTimepickerBufferAt = String(Date.now());
    } else {
      delete segment.dataset.tuiTimepickerBuffer;
      delete segment.dataset.tuiTimepickerBufferAt;
    }
  }

  // Decides what a digit means given what is already half-typed. Mirrors the
  // native widget: a digit that cannot take a second one completes at once.
  function consumeDigit(kind, use12Hours, buffer, digit) {
    const { min, max } = segmentRange(kind, use12Hours);

    if (buffer) {
      const combined = parseInt(buffer, 10) * 10 + digit;
      if (combined >= min && combined <= max) {
        return { value: combined, complete: true, buffer: '' };
      }
    }

    if (digit >= min && digit * 10 > max) {
      return { value: digit, complete: true, buffer: '' };
    }

    // Still ambiguous. Show the digit; only commit it if it is a legal value
    // on its own (a 12-hour clock has no hour zero).
    return { value: digit >= min ? digit : null, complete: false, buffer: String(digit) };
  }

  function handleDigit(trigger, segment, kind, digit) {
    const state = getState(trigger);
    const outcome = consumeDigit(kind, state.use12Hours, readBuffer(segment), digit);

    writeBuffer(segment, outcome.buffer);

    if (outcome.value !== null) {
      applySegmentValue(trigger, kind, outcome.value);
    } else {
      // Nothing legal to store yet, so show the keystroke on its own.
      writeSegment(segment, pad(digit), digit);
    }

    if (outcome.complete) {
      const next = NEXT_SEGMENT[kind];
      if (next) focusSegment(trigger, next);
    }
  }

  function stepSegment(trigger, kind, delta) {
    const state = getState(trigger);

    if (kind === 'period') {
      applyPeriod(trigger, state.period === 'PM' ? 'AM' : 'PM');
      return;
    }

    if (kind === 'hour') {
      const { min, max } = segmentRange(kind, state.use12Hours);
      if (state.hour === null) {
        applySegmentValue(trigger, 'hour', delta > 0 ? min : max);
        return;
      }
      const current = state.use12Hours ? to12(state.hour) : state.hour;
      const span = max - min + 1;
      applySegmentValue(trigger, 'hour', wrap(current - min + delta, span) + min);
      return;
    }

    const step = state.step > 0 ? state.step : 1;
    if (state.minute === null) {
      applySegmentValue(trigger, 'minute', delta > 0 ? 0 : Math.floor(59 / step) * step);
      return;
    }
    // Snap onto the step grid first, so arrowing off an off-grid value lands
    // on the same values the dropdown offers.
    const onGrid = Math.round(state.minute / step) * step;
    applySegmentValue(trigger, 'minute', wrap(onGrid + delta * step, 60));
  }

  // Nudges a complete time onto the step grid and inside min/max. Runs when
  // focus leaves the field rather than per keystroke, so it never fights a
  // half-typed value.
  function settle(trigger) {
    const state = getState(trigger);
    if (state.hour === null || state.minute === null) return;

    let minute = state.minute;
    if (state.step > 1) {
      minute = Math.round(minute / state.step) * state.step;
      if (minute > 59) minute -= state.step;
    }

    let hour = state.hour;
    const total = hour * 60 + minute;
    if (state.minTime && total < state.minTime.hour * 60 + state.minTime.minute) {
      hour = state.minTime.hour;
      minute = state.minTime.minute;
    } else if (state.maxTime && total > state.maxTime.hour * 60 + state.maxTime.minute) {
      hour = state.maxTime.hour;
      minute = state.maxTime.minute;
    }

    if (hour !== state.hour || minute !== state.minute) {
      setState(trigger, hour, minute, state.use12Hours ? (hour >= 12 ? 'PM' : 'AM') : undefined);
    }
  }

  // Keyboard
  document.addEventListener('keydown', (e) => {
    const segment = e.target.closest?.('[data-tui-timepicker-segment]');
    if (!segment || segment.disabled) return;

    const trigger = findTrigger(segment);
    if (!trigger) return;

    const kind = segmentKind(segment);
    const key = e.key;

    // Alt+Arrow works the dropdown, the way the native control does. The
    // opener itself is out of the tab order so a form does not gain a stop per
    // picker; every value it offers can be typed instead.
    if (e.altKey && (key === 'ArrowDown' || key === 'ArrowUp')) {
      e.preventDefault();
      if (key === 'ArrowDown') {
        if (!isPopoverOpen(trigger)) togglePopover(trigger);
      } else if (isPopoverOpen(trigger)) {
        closePopover(trigger);
      }
      return;
    }

    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      stepSegment(trigger, kind, key === 'ArrowUp' ? 1 : -1);
      return;
    }

    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const target = key === 'ArrowLeft' ? PREV_SEGMENT[kind] : NEXT_SEGMENT[kind];
      if (target && focusSegment(trigger, target)) e.preventDefault();
      return;
    }

    if (key === 'Home' || key === 'End') {
      e.preventDefault();
      if (kind === 'period') {
        applyPeriod(trigger, key === 'Home' ? 'AM' : 'PM');
      } else {
        const { min, max } = segmentRange(kind, getState(trigger).use12Hours);
        applySegmentValue(trigger, kind, key === 'Home' ? min : max);
      }
      return;
    }

    if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      writeBuffer(segment, '');
      clearSegment(trigger, kind);
      return;
    }

    if (key === 'Enter') {
      // Only swallow Enter to dismiss the dropdown; otherwise it should still
      // submit the surrounding form.
      if (isPopoverOpen(trigger)) {
        e.preventDefault();
        closePopover(trigger);
        settle(trigger);
      }
      return;
    }

    if (kind === 'period') {
      const lower = key.toLowerCase();
      if (lower === 'a' || lower === 'p') {
        e.preventDefault();
        applyPeriod(trigger, lower === 'p' ? 'PM' : 'AM');
      } else if (key.length === 1) {
        e.preventDefault();
      }
      return;
    }

    if (key >= '0' && key <= '9') {
      e.preventDefault();
      handleDigit(trigger, segment, kind, Number(key));
      return;
    }

    // Swallow any other printable key: the value is state-driven, so letting
    // it land in the box would show something the component does not hold.
    if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
    }
  });

  // Pointer
  document.addEventListener('mousedown', (e) => {
    const trigger = e.target.closest?.('[data-tui-timepicker="true"]');
    if (!trigger) return;
    if (e.target.closest('[data-tui-timepicker-segment], [data-tui-timepicker-toggle]')) return;

    // Clicking the field's padding should put the caret somewhere useful
    // rather than nowhere.
    e.preventDefault();
    focusSegment(trigger, 'hour');
  });

  document.addEventListener('focusin', (e) => {
    const segment = e.target.closest?.('[data-tui-timepicker-segment]');
    if (!segment) return;
    writeBuffer(segment, '');
    segment.select();
  });

  document.addEventListener('focusout', (e) => {
    const segment = e.target.closest?.('[data-tui-timepicker-segment]');
    if (!segment) return;

    writeBuffer(segment, '');

    const trigger = findTrigger(segment);
    const root = findRoot(segment);
    if (!trigger) return;
    // Moving between this component's own segments is not leaving the field.
    if (root && e.relatedTarget && root.contains(e.relatedTarget)) return;

    settle(trigger);
  });

  document.addEventListener('paste', (e) => {
    const segment = e.target.closest?.('[data-tui-timepicker-segment]');
    if (!segment || segment.disabled) return;

    const text = (e.clipboardData?.getData('text') || '').trim();
    const parsed = parseTime(text) || parseTimeLoose(text);
    if (!parsed) return;

    e.preventDefault();
    const trigger = findTrigger(segment);
    if (trigger) setState(trigger, parsed.hour, parsed.minute);
  });

  // Event handlers
  document.addEventListener('click', (e) => {
    const target = e.target;

    // Dropdown toggle
    const toggle = target.closest?.('[data-tui-timepicker-toggle]');
    if (toggle && !toggle.disabled) {
      const trigger = findTrigger(toggle);
      if (trigger) togglePopover(trigger);
      return;
    }

    // Hour selection
    if (target.matches('[data-tui-timepicker-hour]') && !target.disabled) {
      const trigger = findTrigger(target);
      if (!trigger) return;

      const state = getState(trigger);
      let hour = parseInt(target.getAttribute('data-tui-timepicker-hour'));

      if (state.use12Hours) {
        // 0 is how the list spells 12; honour a period picked before the hour.
        hour = to24(hour === 0 ? 12 : hour, state.period || 'AM');
      }

      if (!isValidTime(hour, state.minute, state.minTime, state.maxTime)) {
        // Find first valid minute
        for (let m = 0; m < 60; m += state.step) {
          if (isValidTime(hour, m, state.minTime, state.maxTime)) {
            setState(trigger, hour, m);
            return;
          }
        }
      } else {
        setState(trigger, hour, state.minute);
      }
      return;
    }

    // Minute selection
    if (target.matches('[data-tui-timepicker-minute]') && !target.disabled) {
      const trigger = findTrigger(target);
      if (!trigger) return;

      const state = getState(trigger);
      const minute = parseInt(target.getAttribute('data-tui-timepicker-minute'));

      if (state.hour === null || isValidTime(state.hour, minute, state.minTime, state.maxTime)) {
        setState(trigger, state.hour, minute);
      }
      return;
    }

    // AM/PM selection
    if (target.matches('[data-tui-timepicker-period]')) {
      const trigger = findTrigger(target);
      if (!trigger) return;

      const state = getState(trigger);
      const period = target.getAttribute('data-tui-timepicker-period');

      if (state.hour === null) {
        applyPeriod(trigger, period);
        return;
      }

      const newHour = to24(to12(state.hour), period);

      if (newHour !== state.hour) {
        if (!isValidTime(newHour, state.minute, state.minTime, state.maxTime)) {
          // Find first valid minute
          for (let m = 0; m < 60; m += state.step) {
            if (isValidTime(newHour, m, state.minTime, state.maxTime)) {
              setState(trigger, newHour, m, period);
              return;
            }
          }
        } else {
          setState(trigger, newHour, state.minute, period);
        }
      }
      return;
    }

    // Done button
    if (target.matches('[data-tui-timepicker-done]')) {
      const trigger = findTrigger(target);
      if (trigger) {
        closePopover(trigger);
        settle(trigger);
      }
      return;
    }
  });

  // Handle hidden input value changes (for reactive frameworks) and the
  // virtual-keyboard path, where a keystroke arrives as an edit rather than a
  // keydown we can intercept.
  document.addEventListener('input', (e) => {
    const segment = e.target.closest?.('[data-tui-timepicker-segment]');
    if (segment) {
      const trigger = findTrigger(segment);
      if (trigger) handleSegmentInput(trigger, segment);
      return;
    }

    if (writingHiddenInput) return;
    if (!e.target.matches('[data-tui-timepicker-hidden-input]')) return;

    const trigger = findTrigger(e.target);
    if (trigger) {
      const parsed = parseTime(e.target.value);
      if (parsed) {
        setState(trigger, parsed.hour, parsed.minute);
      } else {
        setState(trigger, null, null);
      }
    }
  });

  function handleSegmentInput(trigger, segment) {
    const kind = segmentKind(segment);
    const raw = segment.value || '';

    if (kind === 'period') {
      const letter = raw.replace(/[^apAP]/g, '').slice(-1).toLowerCase();
      if (letter) applyPeriod(trigger, letter === 'p' ? 'PM' : 'AM');
      else updateDisplay(trigger);
      return;
    }

    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      clearSegment(trigger, kind);
      return;
    }

    const { min, max } = segmentRange(kind, getState(trigger).use12Hours);
    const value = parseInt(digits.slice(-2), 10);
    if (Number.isNaN(value) || value < min || value > max) {
      // Put back what the component actually holds.
      updateDisplay(trigger);
      return;
    }
    applySegmentValue(trigger, kind, value);
  }

  // Form reset
  document.addEventListener('reset', (e) => {
    if (!e.target.matches('form')) return;

    e.target.querySelectorAll('[data-tui-timepicker-root]').forEach(root => {
      const trigger = root.querySelector('[data-tui-timepicker="true"]');
      if (!trigger) return;

      setState(trigger, null, null);
      const elements = getElements(trigger);
      if (elements?.hiddenInput) {
        elements.hiddenInput.value = '';
      }
    });
  });

  // Initialize timepickers
  function initializeTimePickers() {
    document.querySelectorAll('[data-tui-timepicker-root]').forEach(root => {
      const trigger = root.querySelector('[data-tui-timepicker="true"]');
      const hiddenInput = root.querySelector('[data-tui-timepicker-hidden-input]');
      if (!trigger) return;
      if (!hiddenInput || hiddenInput._tui) return;

      // Read initial value from hidden input
      const initialValue = hiddenInput.value;
      if (initialValue) {
        const parsed = parseTime(initialValue);
        if (parsed) {
          setState(trigger, parsed.hour, parsed.minute);
        }
      }

      // Enable reactive binding for hidden input
      enableReactiveBinding(hiddenInput);
      updateDisplay(trigger);
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTimePickers);
  } else {
    initializeTimePickers();
  }

  // MutationObserver for dynamically added elements
  new MutationObserver(initializeTimePickers).observe(document.body, { childList: true, subtree: true });

  // Scroll to selected values when timepicker popover opens
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target.getAttribute('data-tui-popover-open') !== 'true') continue;
      const popup = m.target.querySelector('[data-tui-timepicker-popup]');
      if (!popup) continue;

      requestAnimationFrame(() => {
        popup.querySelector('[data-tui-timepicker-hour-list] [data-tui-timepicker-selected="true"]')?.scrollIntoView({ block: 'center' });
        popup.querySelector('[data-tui-timepicker-minute-list] [data-tui-timepicker-selected="true"]')?.scrollIntoView({ block: 'center' });
      });
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-tui-popover-open'], subtree: true });
})();
