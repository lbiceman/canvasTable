package com.iceexcel.server.config;

import com.iceexcel.server.websocket.CollabWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * WebSocket 配置类
 * 注册 WebSocket 端点，允许所有来源连接
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CollabWebSocketHandler collabWebSocketHandler;

    public WebSocketConfig(CollabWebSocketHandler collabWebSocketHandler) {
        this.collabWebSocketHandler = collabWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(collabWebSocketHandler, "/")
                .setAllowedOrigins("*");
    }
}
