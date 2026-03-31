package com.iceexcel.server.enterprise.config;

import com.iceexcel.server.enterprise.service.AuthenticationService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 数据初始化器
 * 应用启动时创建默认管理员账号
 */
@Component
public class DataInitializer implements CommandLineRunner {

    private final AuthenticationService authService;

    public DataInitializer(AuthenticationService authService) {
        this.authService = authService;
    }

    @Override
    public void run(String... args) {
        authService.ensureDefaultAdmin();
    }
}
