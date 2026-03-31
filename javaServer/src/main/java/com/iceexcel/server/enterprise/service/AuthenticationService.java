package com.iceexcel.server.enterprise.service;

import com.iceexcel.server.enterprise.entity.UserEntity;
import com.iceexcel.server.enterprise.model.UserRole;
import com.iceexcel.server.enterprise.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * 认证服务
 * 支持邮箱密码登录，密码错误 5 次锁定 5 分钟
 */
@Service
public class AuthenticationService {

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION = 5 * 60 * 1000L; // 5 分钟

    public AuthenticationService(UserRepository userRepository, JwtService jwtService,
                                  AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.auditLogService = auditLogService;
    }

    /** 邮箱密码登录 */
    public Map<String, Object> login(String email, String password, String ip) {
        Optional<UserEntity> optUser = userRepository.findByEmail(email);
        if (optUser.isEmpty()) {
            auditLogService.log("LOGIN_FAILED", "unknown", email, "系统",
                    "用户不存在: " + email, ip);
            return Map.of("success", false, "error", "邮箱或密码错误");
        }

        UserEntity user = optUser.get();

        // 检查锁定状态
        if (user.getLockoutUntil() != null && System.currentTimeMillis() < user.getLockoutUntil()) {
            long remaining = (user.getLockoutUntil() - System.currentTimeMillis()) / 1000;
            return Map.of("success", false, "error", "账号已锁定，请 " + remaining + " 秒后重试",
                    "lockoutUntil", user.getLockoutUntil());
        }

        // 验证密码
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            user.setFailedAttempts(user.getFailedAttempts() + 1);
            if (user.getFailedAttempts() >= MAX_ATTEMPTS) {
                user.setLockoutUntil(System.currentTimeMillis() + LOCKOUT_DURATION);
                user.setFailedAttempts(0);
                userRepository.save(user);
                auditLogService.log("LOGIN_FAILED", user.getId(), user.getName(), "系统",
                        "密码错误次数过多，账号锁定 5 分钟", ip);
                return Map.of("success", false, "error", "密码错误次数过多，账号已锁定 5 分钟");
            }
            userRepository.save(user);
            int remaining = MAX_ATTEMPTS - user.getFailedAttempts();
            auditLogService.log("LOGIN_FAILED", user.getId(), user.getName(), "系统",
                    "密码错误（剩余 " + remaining + " 次）", ip);
            return Map.of("success", false, "error", "邮箱或密码错误（剩余 " + remaining + " 次尝试）");
        }

        // 登录成功
        user.setFailedAttempts(0);
        user.setLockoutUntil(null);
        userRepository.save(user);

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(user.getId());

        auditLogService.log("LOGIN", user.getId(), user.getName(), "系统", "邮箱密码登录", ip);

        return Map.of(
                "success", true,
                "user", Map.of(
                        "id", user.getId(),
                        "email", user.getEmail(),
                        "name", user.getName(),
                        "role", user.getRole().name(),
                        "tenantId", user.getTenantId(),
                        "authMethod", "password",
                        "token", token,
                        "refreshToken", refreshToken,
                        "tokenExpiry", jwtService.getExpiry(token)
                )
        );
    }

    /** 刷新 Token */
    public Map<String, Object> refreshToken(String refreshToken) {
        try {
            String userId = jwtService.getUserId(refreshToken);
            Optional<UserEntity> optUser = userRepository.findById(userId);
            if (optUser.isEmpty()) {
                return Map.of("success", false, "error", "用户不存在");
            }
            UserEntity user = optUser.get();
            String newToken = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
            String newRefreshToken = jwtService.generateRefreshToken(user.getId());
            return Map.of(
                    "token", newToken,
                    "refreshToken", newRefreshToken,
                    "expiry", jwtService.getExpiry(newToken)
            );
        } catch (Exception e) {
            return Map.of("success", false, "error", "Token 无效");
        }
    }

    /** 注册用户 */
    public UserEntity register(String email, String name, String password, UserRole role) {
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setName(name);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setRole(role);
        return userRepository.save(user);
    }

    /** 初始化默认管理员（如果不存在） */
    public void ensureDefaultAdmin() {
        if (!userRepository.existsByEmail("admin@iceexcel.com")) {
            register("admin@iceexcel.com", "管理员", "admin123", UserRole.SUPER_ADMIN);
        }
    }
}
