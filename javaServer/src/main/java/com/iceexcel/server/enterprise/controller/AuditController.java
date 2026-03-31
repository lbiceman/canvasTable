package com.iceexcel.server.enterprise.controller;

import com.iceexcel.server.enterprise.entity.AuditLogEntity;
import com.iceexcel.server.enterprise.service.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 审计日志 REST 控制器
 */
@RestController
@RequestMapping("/api/audit")
@CrossOrigin(origins = "*")
public class AuditController {

    private final AuditLogService auditLogService;

    public AuditController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    /** 记录审计事件 */
    @PostMapping("/log")
    public ResponseEntity<Map<String, Object>> log(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        auditLogService.log(
                body.getOrDefault("eventType", ""),
                body.getOrDefault("userId", ""),
                body.getOrDefault("userName", ""),
                body.getOrDefault("target", ""),
                body.getOrDefault("detail", ""),
                request.getRemoteAddr()
        );
        return ResponseEntity.ok(Map.of("success", true));
    }

    /** 查询审计日志 */
    @GetMapping("/logs")
    public ResponseEntity<Map<String, Object>> query(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        Page<AuditLogEntity> result = auditLogService.query(category, userId, page, pageSize);
        return ResponseEntity.ok(Map.of(
                "entries", result.getContent(),
                "total", result.getTotalElements(),
                "page", page,
                "pageSize", pageSize
        ));
    }
}
