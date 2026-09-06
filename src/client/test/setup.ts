import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

const dialogProto = HTMLDialogElement.prototype;
if (typeof dialogProto.showModal !== 'function') {
  dialogProto.showModal = function showModal() {
    this.setAttribute('open', '');
  };
}
if (typeof dialogProto.close !== 'function') {
  dialogProto.close = function close() {
    this.removeAttribute('open');
  };
}

afterEach(() => {
  cleanup();
});
