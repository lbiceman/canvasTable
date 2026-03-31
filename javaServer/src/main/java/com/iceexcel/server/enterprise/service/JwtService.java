package com.iceexcel.server.enterprise.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

/**
 * JWT Token 服务
 * Token 有效期 8 小时，刷新 Token 有效期 7 天
 */
@Service
public class JwtService {

    private final SecretKey key;
    private static final long TOKEN_TTL = 8 * 60 * 60 * 1000L; // 8h
    private static final long REFRESH_TTL = 7 * 24 * 60 * 60 * 1000L; // 7d

    public JwtService(@Value("${jwt.secret:ice-excel-enterprise-secret-key-2026-minimum-256-bits!!}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    /** 生成访问 Token */
    public String generateToken(String userId, String email, String role) {
        return Jwts.builder()
                .subject(userId)
                .claims(Map.of("email", email, "role", role))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + TOKEN_TTL))
                .signWith(key)
                .compact();
    }

    /** 生成刷新 Token */
    public String generateRefreshToken(String userId) {
        return Jwts.builder()
                .subject(userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + REFRESH_TTL))
                .signWith(key)
                .compact();
    }

    /** 验证并解析 Token */
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** 从 Token 获取用户 ID */
    public String getUserId(String token) {
        return parseToken(token).getSubject();
    }

    /** 检查 Token 是否过期 */
    public boolean isExpired(String token) {
        try {
            return parseToken(token).getExpiration().before(new Date());
        } catch (Exception e) {
            return true;
        }
    }

    /** 获取 Token 过期时间戳 */
    public long getExpiry(String token) {
        return parseToken(token).getExpiration().getTime();
    }
}
