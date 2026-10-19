// Loading states for iframes: every .iframe-wrapper (message preview, settings forms, contact
// card) and the compose popup show a skeleton overlay from the moment a new src is set until the
// document has loaded. Gmail never shows a white hole.
function watch(frame) {
  if (frame.dataset.gmLoad) return;
  frame.dataset.gmLoad = '1';
  const wrap = frame.parentElement;
  if (!wrap) return;
  const overlay = document.createElement('div');
  overlay.className = 'gm-frame-loading';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML =
    '<div class="gm-skel gm-skel-title"></div><div class="gm-skel gm-skel-row"></div><div class="gm-skel gm-skel-row short"></div><div class="gm-skel gm-skel-block"></div>';
  wrap.append(overlay);
  const isBlank = () =>
    !frame.getAttribute('src') || /blank|_blank\.html$/.test(frame.getAttribute('src'));
  const show = () => {
    if (!isBlank()) wrap.classList.add('gm-loading');
  };
  const hide = () => wrap.classList.remove('gm-loading');
  new MutationObserver(show).observe(frame, { attributes: true, attributeFilter: ['src'] });
  frame.addEventListener('load', hide);
  frame.gmShowLoading = show;
}

// core navigates content frames with rcmail.location_href(url, contentWindow, true) — no src
// attribute change to observe — so wrap it and flag the matching wrapper.
function hookLocationHref() {
  const rc = window.rcmail;
  if (!rc || rc.gm_location_hooked) return;
  rc.gm_location_hooked = true;
  const orig = rc.location_href;
  rc.location_href = function (url, target, frame) {
    if (frame && target && target !== window) {
      for (const f of document.querySelectorAll('.iframe-wrapper > iframe')) {
        if (f.contentWindow === target && !/_blank\.html|about:blank/.test(String(url))) {
          f.gmShowLoading?.();
        }
      }
    }
    return orig.call(this, url, target, frame);
  };
}

export const loading = {
  watch,
  init() {
    document.querySelectorAll('.iframe-wrapper > iframe').forEach(watch);
    hookLocationHref();
  },
};
