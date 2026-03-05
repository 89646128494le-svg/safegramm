/**
 * Единая точка входа для zustand: только named exports, default = create (для совместимости).
 * Так не подключается оригинальный пакет с deprecated default.
 */
import { create, useStore } from 'zustand-original';

export { create, useStore };
export default create;
