package com.iceexcel.server.enterprise.service;

import com.iceexcel.server.enterprise.entity.AuditLogEntity;
import com.iceexcel.server.enterprise.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;

/**
 * 审计日志服务
 * 记录所有认证、权限、数据、管理事件
 */
@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /** 事件类型到分类的映射 */
    private static final Map<String, String> EVENT_CATEGORIES = Map.ofEntries(
        Map.entry("LOGIN", "auth"), Map.entry("LOGIN_FAILED", "auth"),
        Map.entry("LOGOUT", "auth"), Map.entry("TOKEN_REFRESH", "auth"),
        Map.entry("PASSWORD_CHANGE", "auth"), Map.entry("SSO_ASSERTION", "auth"),
        Map.entry("PERMISSION_GRANT", "permission"), Map.entry("PERMISSION_REVOKE", "permission"),
        Map.entry("ROLE_CHANGE", "permission"), Map.entry("SHARE_CREATED", "permission"),
        Map.entry("SHARE_REVOKED", "permission"),
        Map.entry("CELL_EDIT", "data"), Map.entry("CELL_PROTECT", "data"),
        Map.entry("SHEET_LOCK", "data"), Map.entry("SHEET_UNLOCK", "data"),
        Map.entry("BULK_UPDATE", "data"), Map.entry("DATA_EXPORTED", "data"),
        Map.entry("USER_INVITED", "admin"), Map.entry("USER_REMOVED", "admin"),
        Map.entry("POLICY_CHANGED", "admin"), Map.entry("WORKBOOK_CREATED", "admin")
    );

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /** 记录审计事件 */
    public void log(String eventType, String userId, String userName,
                    String target, String detail, String ip) {
        AuditLogEntity entity = new AuditLogEntity();
        entity.setTimestamp(System.currentTimeMillis());
        entity.setUserId(userId);
        entity.setUserName(userName);
        entity.setEventType(eventType);
        entity.setCategory(EVENT_CATEGORIES.getOrDefault(eventType, "data"));
        entity.setTarget(target);
        entity.setDetail(detail);
        entity.setIp(ip != null ? ip : "");
        auditLogRepository.save(entity);
    }

    /** 查询审计日志 */
    public Page<AuditLogEntity> query(String category, String userId, int page, int pageSize) {
        PageRequest pageRequest = PageRequest.of(page, pageSize, Sort.by(Sort.Direction.DESC, "timestamp"));

        if (category != null && userId != null) {
            return auditLogRepository.findByCategoryAndUserId(category, userId, pageRequest);
        } else if (category != null) {
            return auditLogRepository.findByCategory(category, pageRequest);
        } else if (userId != null) {
            return auditLogRepository.findByUserId(userId, pageRequest);
        }
        return auditLogRepository.findAll(pageRequest);
    }
}
