import { EventEmitter } from 'events';

// A simple event emitter to broadcast Firestore permission errors globally.
export const errorEmitter = new EventEmitter();
