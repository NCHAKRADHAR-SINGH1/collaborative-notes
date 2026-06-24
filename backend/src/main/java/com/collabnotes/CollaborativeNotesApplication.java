package com.collabnotes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import java.util.Arrays;

@SpringBootApplication
public class CollaborativeNotesApplication {
    public static void main(String[] args) {
        String active = System.getenv("SPRING_PROFILES_ACTIVE");
        if (active != null) {
            // if running with prod profile, require APP_JWT_SECRET to be set
            if (Arrays.stream(active.split(",")).anyMatch(s -> s.trim().equalsIgnoreCase("prod"))) {
                String secret = System.getenv("APP_JWT_SECRET");
                if (secret == null || secret.isBlank() || "change_this_secret_for_prod".equals(secret)) {
                    System.err.println("FATAL: APP_JWT_SECRET must be set to a secure value when running with the 'prod' profile.");
                    System.exit(1);
                }
            }
        }

        SpringApplication.run(CollaborativeNotesApplication.class, args);
    }
}
