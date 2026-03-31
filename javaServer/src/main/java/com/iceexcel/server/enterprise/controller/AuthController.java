package com.iceexcel.server.enterprise.controller;

import com.iceexcel.server.enterprise.service.AuditLogService;
import com.iceexcel.server.enterprise.service.AuthenticationService;
import com.iceexcel.server.enterprise.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 认证 REST 控制器
 * 提供登录、登出、Token 刷新接口
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthenticationService authService;
    private final AuditLogService auditLogService;
    private final JwtService jwtService;

    public AuthController(AuthenticationService authService,
                          AuditLogService auditLogService,
                          JwtService jwtService) {
        this.authService = authService;
        this.auditLogService = auditLogService;
        this.jwtService = jwtService;
    }

    /** 邮箱密码登录 */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String email = body.get("email");
        String password = body.get("password");
        String ip = request.getRemoteAddr();
        Map<String, Object> result = authService.login(email, password, ip);
        return ResponseEntity.ok(result);
    }

    /** 登出 */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest request) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                String token = authHeader.substring(7);
                String userId = jwtService.getUserId(token);
                auditLogService.log("LOGOUT", userId, "", "系统", "用户登出", request.getRemoteAddr());
            } catch (Exception ignored) {
                // Token 无效时忽略
            }
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** 刷新 Token */
    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refresh(@RequestBody Map<String, String> body) {
        String refreshToken = body.get("refreshToken");
        Map<String, Object> result = authService.refreshToken(refreshToken);
        return ResponseEntity.ok(result);
    }
}
