
type MessageHandler = (data: any) => void;

class SocketService {
  private socket: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private statusHandlers: Set<(status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING') => void> = new Set();
  private status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' = 'DISCONNECTED';

  private setStatus(newStatus: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING') {
    this.status = newStatus;
    this.statusHandlers.forEach(handler => handler(newStatus));
  }

  getStatus() {
    return this.status;
  }

  onStatusChange(handler: (status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING') => void) {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    
    this.setStatus('CONNECTING');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}`);

    this.socket.onopen = () => {
      console.log('Connected to WebSocket server');
      this.reconnectAttempts = 0;
      this.setStatus('CONNECTED');
    };

    this.socket.onmessage = (event) => {
      try {
        const { type, payload } = JSON.parse(event.data);
        const typeHandlers = this.handlers.get(type);
        if (typeHandlers) {
          typeHandlers.forEach(handler => handler(payload));
        }
      } catch (e) {
        console.error('Error parsing WebSocket message', e);
      }
    };

    this.socket.onclose = () => {
      console.log('Disconnected from WebSocket server');
      this.setStatus('DISCONNECTED');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
      }
    };
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: MessageHandler) {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.delete(handler);
    }
  }
}

export const socketService = new SocketService();
