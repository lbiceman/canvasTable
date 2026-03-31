package com.iceexcel.server.enterprise.repository;

import com.iceexcel.server.enterprise.entity.AuditLogEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * 审计日志数据仓库
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLogEntity, String> {
    Page<AuditLogEntity> findByCategory(String category, Pageable pageable);
    Page<AuditLogEntity> findByUserId(String userId, Pageable pageable);
    Page<AuditLogEntity> findByCategoryAndUserId(String category, String userId, Pageable pageable);
    Page<AuditLogEntity> findByTimestampBetween(Long start, Long end, Pageable pageable);
}
