/**
 * Shim to avoid zustand's "Default export is deprecated" warning.
 * We re-export from zustand-original (aliased to real zustand) and set default = create.
 */
import { create, useStore } from 'zustand-original';

export { create, useStore };
export default create;
