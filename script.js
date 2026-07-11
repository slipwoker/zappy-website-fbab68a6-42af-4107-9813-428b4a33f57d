/* ZAPPY_STOREFRONT_RUNTIME_BOOTSTRAP_V1 */
(function() {
  'use strict';
  var runtimeLoaded = false;
  var runtimePromise = null;
  var runtimeSrc = '/storefront-runtime.js';
  var immediatePath = /\/(?:products?|product|category|cart|checkout|account|order-success|courses?|lesson|my-learning|certificate)(?:\/|$|[?#])/i;
  function hasCriticalCommerceDom() {
    return !!document.querySelector('#zappy-product-grid,#zappy-product-detail,#cart-items,#checkout-form,.checkout-page,.cart-page,.order-success-page,[data-product-id],.product-detail-page');
  }
  function getHomepageDynamicCommerceTargets() {
    return Array.prototype.slice.call(document.querySelectorAll('#zappy-featured-products,#zappy-featured-categories'));
  }
  function shouldLoadImmediately() {
    return immediatePath.test(window.location.pathname || '/') || hasCriticalCommerceDom();
  }
  function loadRuntime() {
    if (runtimeLoaded) return Promise.resolve();
    if (runtimePromise) return runtimePromise;
    runtimePromise = new Promise(function(resolve, reject) {
      var existing = document.querySelector('script[data-zappy-storefront-runtime="true"]');
      if (existing) {
        // A previously failed/already-complete tag never fires load again.
        // Treat complete tags as loaded; drop failed tags and recreate.
        if (existing.getAttribute('data-zappy-load-error') === 'true') {
          existing.parentNode && existing.parentNode.removeChild(existing);
        } else if (existing.getAttribute('data-zappy-loaded') === 'true' || existing.readyState === 'complete') {
          runtimeLoaded = true;
          resolve();
          return;
        } else {
          existing.addEventListener('load', function() {
            existing.setAttribute('data-zappy-loaded', 'true');
            runtimeLoaded = true;
            resolve();
          }, { once: true });
          existing.addEventListener('error', function(error) {
            existing.setAttribute('data-zappy-load-error', 'true');
            reject(error);
          }, { once: true });
          return;
        }
      }
      var restoreDOMContentLoaded = installLateDOMContentLoadedReplay();
      var script = document.createElement('script');
      script.src = runtimeSrc;
      script.defer = true;
      script.setAttribute('data-zappy-storefront-runtime', 'true');
      script.onload = function() {
        script.setAttribute('data-zappy-loaded', 'true');
        restoreDOMContentLoaded();
        runtimeLoaded = true;
        resolve();
      };
      script.onerror = function(error) {
        script.setAttribute('data-zappy-load-error', 'true');
        restoreDOMContentLoaded();
        reject(error);
      };
      document.head.appendChild(script);
    }).catch(function(error) {
      runtimePromise = null;
      throw error;
    });
    return runtimePromise;
  }
  function installLateDOMContentLoadedReplay() {
    if (document.readyState === 'loading') return function() {};
    var original = document.addEventListener;
    var restored = false;
    document.addEventListener = function(type, listener, options) {
      if (type === 'DOMContentLoaded' && listener) {
        setTimeout(function() {
          try {
            if (typeof listener === 'function') {
              listener.call(document, new Event('DOMContentLoaded'));
            } else if (listener && typeof listener.handleEvent === 'function') {
              listener.handleEvent(new Event('DOMContentLoaded'));
            }
          } catch (error) {
            setTimeout(function() { throw error; }, 0);
          }
        }, 0);
        return;
      }
      return original.call(document, type, listener, options);
    };
    return function() {
      if (!restored) {
        restored = true;
        document.addEventListener = original;
      }
    };
  }
  function scheduleHomepageDynamicRuntimeLoad() {
    if (runtimeLoaded || runtimePromise) return false;
    var targets = getHomepageDynamicCommerceTargets();
    if (!targets.length) return false;
    var triggered = false;
    var observer = null;
    var trigger = function() {
      if (triggered || runtimeLoaded || runtimePromise) return;
      triggered = true;
      if (observer) observer.disconnect();
      targets.forEach(function(target) {
        ['pointerenter', 'focusin', 'touchstart', 'pointerdown'].forEach(function(eventName) {
          target.removeEventListener(eventName, trigger);
        });
      });
      loadRuntime();
    };
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function(entries) {
        if (entries.some(function(entry) { return entry.isIntersecting; })) trigger();
      }, { rootMargin: '300px 0px' });
      targets.forEach(function(target) { observer.observe(target); });
    } else {
      setTimeout(trigger, 1200);
    }
    targets.forEach(function(target) {
      ['pointerenter', 'focusin', 'touchstart', 'pointerdown'].forEach(function(eventName) {
        target.addEventListener(eventName, trigger, { once: true, passive: true });
      });
    });
    return true;
  }
  function replayAfterLoad(event) {
    var target = event.target;
    if (!target || runtimeLoaded || runtimePromise) return;
    var interactive = target.closest && target.closest('button,a,[role="button"],input,select,textarea,.mobile-toggle,.hamburger,.cart-link,.login-link,.nav-search-toggle,.zappy-products-dropdown');
    if (!interactive) return;
    loadRuntime().then(function() {
      if (typeof target.click === 'function' && event.type === 'click') {
        setTimeout(function() { try { target.click(); } catch (_) {} }, 0);
      }
    });
  }
  window.__zappyLoadStorefrontRuntime = loadRuntime;
  function onReady() {
    if (shouldLoadImmediately()) {
      loadRuntime();
    } else {
      scheduleHomepageDynamicRuntimeLoad();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }
  ['click', 'focusin', 'pointerdown', 'touchstart', 'keydown'].forEach(function(eventName) {
    document.addEventListener(eventName, replayAfterLoad, { capture: true, passive: eventName !== 'click' && eventName !== 'keydown' });
  });
  if (!shouldLoadImmediately()) {
    var lateLoad = function() { loadRuntime(); };
    setTimeout(function() {
      if (runtimeLoaded || runtimePromise) return;
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(lateLoad, { timeout: 2000 });
      } else {
        lateLoad();
      }
    }, 12000);
  }
})();