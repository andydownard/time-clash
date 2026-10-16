// The bundled question bank. Vite inlines every bank/<subject>-<grade>.json at build time. No network.
import { buildBank } from '../bankLoader';
import type { QuestionBank } from '../types';

const files = import.meta.glob('./*.json', { eager: true, import: 'default' });

export const BANK: QuestionBank = buildBank(files);
