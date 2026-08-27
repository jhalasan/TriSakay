export * from './colors';
export * from './spacing';
export * from './radius';
export * from './typography';
export * from './elevation';
export * from './motion';
export * from './gradients';
export * from './scale';

import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography } from './typography';
import { elevation } from './elevation';
import { motion } from './motion';
import { gradients } from './gradients';

export const theme = { colors, spacing, radius, typography, elevation, motion, gradients } as const;
