package com.omok.ai.listener;

import com.omok.ai.service.GameRoomService;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);
    private final GameRoomService gameRoomService;

    public WebSocketEventListener(GameRoomService gameRoomService) {
        this.gameRoomService = gameRoomService;
    }

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId = headerAccessor.getFirstNativeHeader("userId");
        if (userId != null) {
            headerAccessor.getSessionAttributes().put("userId", userId);
            log.info("WebSocket Session Connected for userId: {}", userId);
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String userIdStr = (String) headerAccessor.getSessionAttributes().get("userId");
        
        if (userIdStr != null) {
            try {
                Long userId = Long.parseLong(userIdStr);
                log.info("WebSocket Session Disconnected for userId: {}", userId);
                gameRoomService.handleUserDisconnect(userId);
            } catch (NumberFormatException e) {
                log.error("Invalid userId in session: {}", userIdStr);
            }
        }
    }
}

