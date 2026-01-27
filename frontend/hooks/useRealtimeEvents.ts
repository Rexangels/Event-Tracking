import { useState, useEffect, useCallback, useRef } from 'react';
import { IntelligenceEvent, EventType, EventSeverity } from '../types';

interface WebSocketMessage {
    type: string;
    event?: any;
    event_id?: string;
    message?: string;
    level?: string;
    verified?: boolean;
}

interface UseRealtimeEventsOptions {
    onEventCreated?: (event: IntelligenceEvent) => void;
    onEventUpdated?: (event: IntelligenceEvent) => void;
    onEventVerified?: (eventId: string, verified: boolean) => void;
    onSystemAlert?: (message: string, level: string) => void;
}

export function useRealtimeEvents(options: UseRealtimeEventsOptions = {}) {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Refs for state and options to prevent effect re-runs
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const optionsRef = useRef(options);

    // Update options ref whenever options change
    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const maxReconnectAttempts = 5;
    const baseReconnectDelay = 1000;

    const connect = useCallback(() => {
        // Don't connect if we're already connected or connecting
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        // WebSocket URL - adjust based on environment
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // @ts-ignore - Vite env access
        const wsHost = import.meta.env.VITE_WS_HOST || 'localhost:8000';
        const wsUrl = `${wsProtocol}//${wsHost}/ws/events/`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WebSocket] Connected to Sentinel Core');
                setIsConnected(true);
                setConnectionError(null);
                reconnectAttemptsRef.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data: WebSocketMessage = JSON.parse(event.data);
                    const currentOptions = optionsRef.current;

                    switch (data.type) {
                        case 'connection_established':
                            console.log('[WebSocket] ', data.message);
                            break;

                        case 'event_created':
                            if (data.event && currentOptions.onEventCreated) {
                                currentOptions.onEventCreated(transformEvent(data.event));
                            }
                            break;

                        case 'event_updated':
                            if (data.event && currentOptions.onEventUpdated) {
                                currentOptions.onEventUpdated(transformEvent(data.event));
                            }
                            break;

                        case 'event_verified':
                            if (data.event_id && currentOptions.onEventVerified) {
                                currentOptions.onEventVerified(data.event_id, data.verified || false);
                            }
                            break;

                        case 'system_alert':
                            if (data.message && currentOptions.onSystemAlert) {
                                currentOptions.onSystemAlert(data.message, data.level || 'info');
                            }
                            break;

                        case 'pong':
                            // Heartbeat response
                            break;

                        default:
                        // console.log('[WebSocket] Unknown message type:', data.type);
                    }
                } catch (err) {
                    console.error('[WebSocket] Failed to parse message:', err);
                }
            };

            ws.onclose = (event) => {
                // Only attempt reconnect if it wasn't a clean disconnect (1000)
                setIsConnected(false);
                wsRef.current = null;

                if (event.code !== 1000 && event.code !== 1001) {
                    console.log('[WebSocket] Disconnected unexpectedly:', event.code);

                    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                        const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
                        reconnectAttemptsRef.current++;
                        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

                        reconnectTimeoutRef.current = setTimeout(connect, delay);
                    } else {
                        setConnectionError('Unable to connect to real-time feed. Please refresh the page.');
                    }
                } else {
                    console.log('[WebSocket] Client disconnected cleanly');
                }
            };

            ws.onerror = (error) => {
                console.error('[WebSocket] Error event:', error);
                // Don't set error state immediately here, let onclose handle it to allow for reconnects
            };

        } catch (err) {
            console.error('[WebSocket] Failed to create connection:', err);
            setConnectionError('Failed to establish WebSocket connection');
        }
    }, []); // Empty dependency array - connect function is stable!

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close(1000, 'Client disconnect');
            wsRef.current = null;
        }
        setIsConnected(false);
    }, []);

    const sendPing = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
            }));
        }
    }, []);

    const subscribeToRegion = useCallback((region: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'subscribe_region',
                region
            }));
        }
    }, []);

    // Connect on mount
    useEffect(() => {
        connect();

        const heartbeatInterval = setInterval(sendPing, 30000);

        return () => {
            clearInterval(heartbeatInterval);
            disconnect();
        };
    }, [connect, disconnect, sendPing]);

    return {
        isConnected,
        connectionError,
        connect,
        disconnect,
        subscribeToRegion
    };
}

// Transform backend event to frontend format
function transformEvent(backendEvent: any): IntelligenceEvent {
    return {
        id: backendEvent.id,
        timestamp: backendEvent.created_at,
        type: mapCategoryToType(backendEvent.category),
        severity: mapSeverity(backendEvent.severity),
        title: backendEvent.title || 'Untitled Event',
        description: backendEvent.description,
        location: `Lat: ${backendEvent.latitude?.toFixed(4)}, Lng: ${backendEvent.longitude?.toFixed(4)}`,
        region: 'Unknown Region',
        coords: {
            lat: backendEvent.latitude || 0,
            lng: backendEvent.longitude || 0
        },
        source: 'INTERNAL_REPORT',
        verified: backendEvent.status === 'VERIFIED',
        metadata: {
            trust_score: backendEvent.trust_score,
            media: backendEvent.media_attachments
        },
        media_attachments: backendEvent.media_attachments
    };
}

function mapSeverity(severity: string): EventSeverity {
    switch (severity?.toUpperCase()) {
        case 'LOW': return EventSeverity.LOW;
        case 'MEDIUM': return EventSeverity.MEDIUM;
        case 'HIGH': return EventSeverity.HIGH;
        case 'CRITICAL': return EventSeverity.CRITICAL;
        default: return EventSeverity.LOW;
    }
}

function mapCategoryToType(category: string): EventType {
    switch (category?.toUpperCase()) {
        case 'SENSORY': return EventType.SENSORY;
        case 'HUMAN_REPORT': return EventType.HUMAN_REPORT;
        case 'API_FEED': return EventType.API_FEED;
        case 'GEOPOLITICAL': return EventType.GEOPOLITICAL;
        case 'ENVIRONMENTAL': return EventType.ENVIRONMENTAL;
        default: return EventType.HUMAN_REPORT;
    }
}
