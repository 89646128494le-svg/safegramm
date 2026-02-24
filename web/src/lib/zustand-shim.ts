/**
 * Shim: only named exports to avoid zustand's "Default export is deprecated" warning.
 * Use: import { create } from 'zustand'
 */
import { create, useStore } from 'zustand-original';

export { create, useStore };
