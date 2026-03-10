package com.iceexcel.server.repository;

import com.iceexcel.server.entity.OperationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 操作历史 Repository，提供操作的存储和按修订号范围查询功能。
 */
public interface OperationRepository extends JpaRepository<OperationEntity, Long> {

    /**
     * 按 roomId 查询指定修订号之后的操作，按修订号升序排列。
     */
    List<OperationEntity> findByRoomIdAndRevisionGreaterThanOrderByRevisionAsc(
            String roomId, int sinceRevision);

    /**
     * 按 roomId 查询所有操作，按修订号升序排列。
     */
    List<OperationEntity> findByRoomIdOrderByRevisionAsc(String roomId);
}
