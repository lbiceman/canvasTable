package com.iceexcel.server.repository;

import com.iceexcel.server.entity.RoomEntity;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 房间数据 Repository，提供房间文档的存储和读取功能。
 */
public interface RoomRepository extends JpaRepository<RoomEntity, String> {
}
