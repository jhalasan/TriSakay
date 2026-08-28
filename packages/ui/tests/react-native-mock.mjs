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

// The stubs below exist purely so component modules can be *imported*
// (and their module-level code, e.g. StyleSheet.create calls, executed)
// without crashing in Node — tests here only pull pure functions out of
// component files, they never render anything, so these never need to
// behave like real React Native primitives.
const stubComponent = () => null;

export const View = stubComponent;
export const Text = stubComponent;
export const Image = stubComponent;
export const Pressable = stubComponent;
export const ActivityIndicator = stubComponent;
export const Modal = stubComponent;
export const TextInput = stubComponent;
export const Switch = stubComponent;

export const Animated = {
  Value: class {
    constructor(value) {
      this._value = value;
    }
  },
  timing: () => ({ start: () => {} }),
  View: stubComponent,
};

export const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};

export const Platform = {
  OS: 'ios',
  select: (spec) => (spec.ios !== undefined ? spec.ios : spec.default),
};

export default {
  Dimensions,
  Easing,
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Animated,
  StyleSheet,
  Platform,
};
