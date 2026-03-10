package com.iceexcel.server.model;

import org.springframework.web.socket.WebSocketSession;

/**
 * 客户端连接信息，与 TypeScript ClientConnection 接口对应
 */
public class ClientConnection {

    private String userId;
    private String userName;
    private String color;
    private WebSocketSession session;

    public ClientConnection() {
    }

    public ClientConnection(String userId, String userName, String color, WebSocketSession session) {
        this.userId = userId;
        this.userName = userName;
        this.color = color;
        this.session = session;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public WebSocketSession getSession() { return session; }
    public void setSession(WebSocketSession session) { this.session = session; }
}
