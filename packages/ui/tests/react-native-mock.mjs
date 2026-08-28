// Mock Dimensions for Node.js test environment
// At the 375px baseline, Dimensions.get('window').width should be 375
export const Dimensions = {
  get: (name) => {
    if (name === 'window') {
      return { width: 375 };
    }
    return {};
  },
};

// Mock Easing for Node.js test environment
export const Easing = {
  bezier: (p0, p1, p2, p3) => (t) => t,
  linear: (t) => t,
};

export default {
  Dimensions,
  Easing,
};
