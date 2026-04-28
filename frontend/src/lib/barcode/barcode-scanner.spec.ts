/**
 * @jest-environment jsdom
 */
import { createHidScanner } from './barcode-scanner';

describe('HID barcode scanner adapter (S19.5)', () => {
  it('emits a barcode after rapid keystrokes terminated by Enter', () => {
    const scanner = createHidScanner();
    const codes: string[] = [];
    scanner.start((c) => codes.push(c));

    const keys = '1234567890';
    for (const k of keys) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(codes).toEqual(['1234567890']);
    scanner.stop();
  });

  it('drops short manual input (< 4 chars)', () => {
    const scanner = createHidScanner();
    const codes: string[] = [];
    scanner.start((c) => codes.push(c));

    for (const k of 'AB') {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
    }
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(codes).toEqual([]);
    scanner.stop();
  });
});
