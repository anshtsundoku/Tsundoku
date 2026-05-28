import { io } from 'socket.io-client';

// One shared socket for the whole app. Auto-reconnects.
export const socket = io('/', {
  path: '/socket.io',
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
