import '@testing-library/jest-dom';

// jsdom doesn't implement scrollIntoView — mock it globally so components
// that call ref.scrollIntoView() don't throw during tests.
window.HTMLElement.prototype.scrollIntoView = jest.fn();
