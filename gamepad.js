/* 우리집 영상관: 표준 Xbox 호환 패드 입력. 이 페이지에서만 동작합니다. */
(function () {
  'use strict';
  if (typeof navigator.getGamepads !== 'function' || typeof window.requestAnimationFrame !== 'function') return;

  var DEADZONE = 0.55;
  var FIRST_REPEAT_MS = 360;
  var REPEAT_MS = 155;
  var DUPLICATE_GUARD_MS = 140;
  var previousDirection = '';
  var nextRepeatAt = 0;
  var previousA = false;
  var previousB = false;
  var currentPadIndex = -1;
  var lastPhysicalKeyAt = -Infinity;
  var lastGamepadAt = -Infinity;

  function reset() {
    previousDirection = '';
    nextRepeatAt = 0;
    previousA = false;
    previousB = false;
    currentPadIndex = -1;
  }

  // Steam Input 같은 키보드 변환 입력과 Gamepad API가 중복으로 들어오지 않도록 조정.
  window.addEventListener('keydown', function (event) {
    if (!event.isTrusted || !/^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Enter|Escape|Backspace|BrowserBack)$/.test(event.key)) return;
    var now = performance.now();
    if (now - lastGamepadAt < DUPLICATE_GUARD_MS) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    lastPhysicalKeyAt = now;
  }, true);

  function activePage() {
    return document.visibilityState !== 'hidden' &&
      (typeof document.hasFocus !== 'function' || document.hasFocus());
  }

  function firstStandardPad() {
    var pads;
    try { pads = navigator.getGamepads() || []; }
    catch (_) { return null; }
    for (var i = 0; i < pads.length; i++) {
      var pad = pads[i];
      if (pad && pad.connected !== false && pad.mapping === 'standard') return pad;
    }
    return null;
  }

  function pressed(pad, buttonIndex) {
    return !!(pad.buttons && pad.buttons[buttonIndex] &&
      (pad.buttons[buttonIndex].pressed || pad.buttons[buttonIndex].value > 0.6));
  }

  function direction(pad) {
    // 표준 게임패드: 십자키 12~15, 왼쪽 스틱 axes[0], axes[1].
    if (pressed(pad, 12)) return 'ArrowUp';
    if (pressed(pad, 13)) return 'ArrowDown';
    if (pressed(pad, 14)) return 'ArrowLeft';
    if (pressed(pad, 15)) return 'ArrowRight';
    var x = pad.axes && typeof pad.axes[0] === 'number' ? pad.axes[0] : 0;
    var y = pad.axes && typeof pad.axes[1] === 'number' ? pad.axes[1] : 0;
    if (Math.abs(x) < DEADZONE && Math.abs(y) < DEADZONE) return '';
    if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'ArrowRight' : 'ArrowLeft';
    return y > 0 ? 'ArrowDown' : 'ArrowUp';
  }

  function navigables() {
    var listing = document.getElementById('listing');
    var scope = listing && !listing.hidden ? listing : document.getElementById('home');
    return scope ? Array.prototype.slice.call(scope.querySelectorAll('.remote-focus')) : [];
  }

  function sendKey(key) {
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: key, bubbles: true, cancelable: true
    }));
  }

  function move(key) {
    // 기존 키보드 방향키 로직과 포커스를 공유합니다.
    sendKey(key);
    var focused = document.activeElement;
    if (focused && navigables().indexOf(focused) !== -1 && typeof focused.scrollIntoView === 'function') {
      focused.scrollIntoView({block: 'nearest', inline: 'nearest'});
    }
  }

  function confirm() {
    var options = navigables();
    if (!options.length) return;
    var focused = document.activeElement;
    if (options.indexOf(focused) === -1) {
      focused = options[0];
      focused.focus();
    }
    if (typeof focused.click === 'function') focused.click();
  }

  function back() {
    // 홈페이지 밖의 영상 사이트에서는 이 스크립트 자체가 실행되지 않습니다.
    var listing = document.getElementById('listing');
    if (listing && !listing.hidden) sendKey('Escape');
  }

  function tick(now) {
    window.requestAnimationFrame(tick);
    if (!activePage()) { reset(); return; }
    var pad = firstStandardPad();
    if (!pad) { reset(); return; }
    if (currentPadIndex !== pad.index) { reset(); currentPadIndex = pad.index; }

    var key = direction(pad);
    if (key !== previousDirection) {
      previousDirection = key;
      nextRepeatAt = now + FIRST_REPEAT_MS;
      if (key && now - lastPhysicalKeyAt >= DUPLICATE_GUARD_MS) {
        lastGamepadAt = now;
        move(key);
      }
    } else if (key && now >= nextRepeatAt) {
      nextRepeatAt = now + REPEAT_MS;
      if (now - lastPhysicalKeyAt >= DUPLICATE_GUARD_MS) {
        lastGamepadAt = now;
        move(key);
      }
    }

    var a = pressed(pad, 0);
    var b = pressed(pad, 1);
    if (a && !previousA && now - lastPhysicalKeyAt >= DUPLICATE_GUARD_MS) {
      lastGamepadAt = now;
      confirm();
    } else if (b && !previousB && now - lastPhysicalKeyAt >= DUPLICATE_GUARD_MS) {
      lastGamepadAt = now;
      back();
    }
    previousA = a;
    previousB = b;
  }

  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') reset(); });
  window.requestAnimationFrame(tick);
}());
