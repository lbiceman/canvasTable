// ============================================================
// CSV 编码检测模块 — 纯 TypeScript 实现
// 基于字节特征自动识别 UTF-8 / GBK / Shift-JIS 编码
// ============================================================

/** 检测结果 */
export interface EncodingDetectResult {
  /** 检测到的编码名称（TextDecoder 兼容） */
  encoding: string;
  /** 置信度 0-1 */
  confidence: number;
}

/**
 * EncodingDetector — 文本编码检测器
 *
 * 检测策略（按优先级）：
 * 1. UTF-8 BOM 检测（EF BB BF）
 * 2. UTF-16 BOM 检测（FF FE / FE FF）
 * 3. UTF-8 有效性验证（多字节序列规则）
 * 4. Shift-JIS 字节范围检测
 * 5. GBK 字节范围检测
 * 6. 回退到 UTF-8
 */
export class EncodingDetector {
  /**
   * 检测字节数组的编码
   * 采样前 8KB 数据进行检测（足够判断编码）
   */
  detect(data: Uint8Array): EncodingDetectResult {
    // 采样大小：最多 8KB
    const sampleSize = Math.min(data.length, 8192);
    const sample = data.subarray(0, sampleSize);

    // 1. BOM 检测
    const bomResult = this.detectBOM(sample);
    if (bomResult) return bomResult;

    // 2. UTF-8 有效性验证
    const utf8Score = this.scoreUTF8(sample);
    if (utf8Score > 0.9) {
      return { encoding: 'utf-8', confidence: utf8Score };
    }

    // 3. Shift-JIS 检测（日文优先，因为 GBK 范围更广容易误判）
    const sjisScore = this.scoreShiftJIS(sample);

    // 4. GBK 检测
    const gbkScore = this.scoreGBK(sample);

    // 选择得分最高的编码
    if (sjisScore > gbkScore && sjisScore > 0.5) {
      return { encoding: 'shift-jis', confidence: sjisScore };
    }

    if (gbkScore > 0.5) {
      return { encoding: 'gbk', confidence: gbkScore };
    }

    // 如果 UTF-8 得分尚可，使用 UTF-8
    if (utf8Score > 0.5) {
      return { encoding: 'utf-8', confidence: utf8Score };
    }

    // 回退到 UTF-8
    return { encoding: 'utf-8', confidence: 0.3 };
  }

  /**
   * 使用检测到的编码解码字节数组为字符串
   */
  decode(data: Uint8Array, encoding?: string): string {
    const enc = encoding ?? this.detect(data).encoding;

    // 处理 UTF-8 BOM
    let bytes = data;
    if (enc === 'utf-8' && data.length >= 3 &&
        data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
      bytes = data.subarray(3);
    }

    try {
      const decoder = new TextDecoder(enc, { fatal: false });
      return decoder.decode(bytes);
    } catch {
      // TextDecoder 不支持该编码时回退到 UTF-8
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(bytes);
    }
  }

  /**
   * 检测 BOM（字节顺序标记）
   */
  private detectBOM(data: Uint8Array): EncodingDetectResult | null {
    if (data.length < 2) return null;

    // UTF-8 BOM: EF BB BF
    if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
      return { encoding: 'utf-8', confidence: 1.0 };
    }

    // UTF-16 LE BOM: FF FE
    if (data[0] === 0xFF && data[1] === 0xFE) {
      return { encoding: 'utf-16le', confidence: 1.0 };
    }

    // UTF-16 BE BOM: FE FF
    if (data[0] === 0xFE && data[1] === 0xFF) {
      return { encoding: 'utf-16be', confidence: 1.0 };
    }

    return null;
  }

  /**
   * 计算 UTF-8 有效性得分
   * 验证多字节序列是否符合 UTF-8 编码规则
   */
  private scoreUTF8(data: Uint8Array): number {
    let validMultiByte = 0;
    let invalidMultiByte = 0;
    let totalMultiByte = 0;
    let i = 0;

    while (i < data.length) {
      const byte = data[i];

      // ASCII 范围（0x00-0x7F）
      if (byte <= 0x7F) {
        i++;
        continue;
      }

      totalMultiByte++;

      // 2 字节序列（110xxxxx 10xxxxxx）
      if ((byte & 0xE0) === 0xC0) {
        if (i + 1 < data.length && (data[i + 1] & 0xC0) === 0x80) {
          validMultiByte++;
          i += 2;
        } else {
          invalidMultiByte++;
          i++;
        }
        continue;
      }

      // 3 字节序列（1110xxxx 10xxxxxx 10xxxxxx）
      if ((byte & 0xF0) === 0xE0) {
        if (i + 2 < data.length &&
            (data[i + 1] & 0xC0) === 0x80 &&
            (data[i + 2] & 0xC0) === 0x80) {
          validMultiByte++;
          i += 3;
        } else {
          invalidMultiByte++;
          i++;
        }
        continue;
      }

      // 4 字节序列（11110xxx 10xxxxxx 10xxxxxx 10xxxxxx）
      if ((byte & 0xF8) === 0xF0) {
        if (i + 3 < data.length &&
            (data[i + 1] & 0xC0) === 0x80 &&
            (data[i + 2] & 0xC0) === 0x80 &&
            (data[i + 3] & 0xC0) === 0x80) {
          validMultiByte++;
          i += 4;
        } else {
          invalidMultiByte++;
          i++;
        }
        continue;
      }

      // 无效的起始字节
      invalidMultiByte++;
      i++;
    }

    // 纯 ASCII 文件视为 UTF-8
    if (totalMultiByte === 0) return 0.95;

    // 计算得分
    if (invalidMultiByte === 0) return 0.95;
    return validMultiByte / (validMultiByte + invalidMultiByte);
  }

  /**
   * 计算 GBK 编码得分
   * GBK 双字节范围：首字节 0x81-0xFE，次字节 0x40-0xFE（排除 0x7F）
   */
  private scoreGBK(data: Uint8Array): number {
    let validPairs = 0;
    let invalidPairs = 0;
    let totalNonAscii = 0;
    let i = 0;

    while (i < data.length) {
      const byte = data[i];

      // ASCII 范围
      if (byte <= 0x7F) {
        i++;
        continue;
      }

      totalNonAscii++;

      // GBK 首字节范围：0x81-0xFE
      if (byte >= 0x81 && byte <= 0xFE && i + 1 < data.length) {
        const nextByte = data[i + 1];
        // GBK 次字节范围：0x40-0xFE（排除 0x7F）
        if (nextByte >= 0x40 && nextByte <= 0xFE && nextByte !== 0x7F) {
          validPairs++;
          i += 2;
          continue;
        }
      }

      invalidPairs++;
      i++;
    }

    if (totalNonAscii === 0) return 0;
    if (invalidPairs === 0 && validPairs > 0) return 0.85;
    return validPairs / (validPairs + invalidPairs) * 0.85;
  }

  /**
   * 计算 Shift-JIS 编码得分
   * Shift-JIS 双字节范围：
   * - 首字节：0x81-0x9F 或 0xE0-0xEF
   * - 次字节：0x40-0x7E 或 0x80-0xFC
   * 半角片假名：0xA1-0xDF（单字节）
   */
  private scoreShiftJIS(data: Uint8Array): number {
    let validPairs = 0;
    let halfWidthKana = 0;
    let invalidPairs = 0;
    let totalNonAscii = 0;
    let i = 0;

    while (i < data.length) {
      const byte = data[i];

      // ASCII 范围
      if (byte <= 0x7F) {
        i++;
        continue;
      }

      totalNonAscii++;

      // 半角片假名（0xA1-0xDF）
      if (byte >= 0xA1 && byte <= 0xDF) {
        halfWidthKana++;
        i++;
        continue;
      }

      // Shift-JIS 首字节范围
      const isFirstByte = (byte >= 0x81 && byte <= 0x9F) || (byte >= 0xE0 && byte <= 0xEF);
      if (isFirstByte && i + 1 < data.length) {
        const nextByte = data[i + 1];
        // Shift-JIS 次字节范围
        if ((nextByte >= 0x40 && nextByte <= 0x7E) || (nextByte >= 0x80 && nextByte <= 0xFC)) {
          validPairs++;
          i += 2;
          continue;
        }
      }

      invalidPairs++;
      i++;
    }

    if (totalNonAscii === 0) return 0;

    const validCount = validPairs + halfWidthKana;
    if (invalidPairs === 0 && validCount > 0) return 0.85;
    return validCount / (validCount + invalidPairs) * 0.85;
  }
}
