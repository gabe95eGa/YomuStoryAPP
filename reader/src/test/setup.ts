import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom doesn't lay out or scroll. Browser QA separately covers actual scrolling.
Element.prototype.scrollIntoView = vi.fn();
window.scrollTo = vi.fn();
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
}
beforeEach(() => { window.history.replaceState(null, '', '/'); localStorage.clear(); });
afterEach(() => { cleanup(); });
