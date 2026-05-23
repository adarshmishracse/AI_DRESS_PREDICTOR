package com.styleai.backend;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*") // Allow connection from anywhere
public class PredictionController {

    // WE ARE CHANGING THIS TO JUST "/upload"
    @PostMapping("/upload") 
    public Map<String, String> uploadImage(@RequestParam("image") MultipartFile file) {
        
        System.out.println("✅ BACKEND: Received image -> " + file.getOriginalFilename());

        Map<String, String> response = new HashMap<>();
        response.put("message", "Success! Java received your image.");
        return response;
    }
}
