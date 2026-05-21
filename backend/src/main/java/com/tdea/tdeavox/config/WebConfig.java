package com.tdea.tdeavox.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path rootPath = Paths.get(System.getProperty("user.dir"));
        if (rootPath.getFileName().toString().equals("backend")) {
            rootPath = rootPath.getParent();
        }
        Path uploadsDir = rootPath.resolve("uploads");
        
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(uploadsDir.toAbsolutePath().toUri().toString());
    }
}
