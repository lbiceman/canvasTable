package com.iceexcel.server.enterprise.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Spring Security 配置
 * WebSocket 和登录接口放行，其他 API 需要认证
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // WebSocket 端点放行
                .requestMatchers("/").permitAll()
                // 登录接口放行
                .requestMatchers("/api/auth/login").permitAll()
                .requestMatchers("/api/auth/refresh").permitAll()
                // OAuth2 回调放行
                .requestMatchers("/api/auth/oauth2/**").permitAll()
                .requestMatchers("/api/auth/saml/**").permitAll()
                // 其他 API 需要认证
                .requestMatchers("/api/**").authenticated()
                // 静态资源放行
                .anyRequest().permitAll()
            );
        return http.build();
    }
}
