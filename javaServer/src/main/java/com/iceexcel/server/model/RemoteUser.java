package com.iceexcel.server.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 远程用户信息，与 TypeScript RemoteUser 接口对应
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RemoteUser {

    private String userId;
    private String userName;
    private String color;
    private Selection selection;
    private long lastActive;

    public RemoteUser() {
    }

    public RemoteUser(String userId, String userName, String color) {
        this.userId = userId;
        this.userName = userName;
        this.color = color;
        this.selection = null;
        this.lastActive = System.currentTimeMillis();
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }

    public Selection getSelection() { return selection; }
    public void setSelection(Selection selection) { this.selection = selection; }

    public long getLastActive() { return lastActive; }
    public void setLastActive(long lastActive) { this.lastActive = lastActive; }
}
