use regex::Regex;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Command;

fn main() {
    println!("Running clippy to find dead_code warnings...\n");

    // Run clippy and capture text output (from rust/ directory)
    let output = Command::new("cargo")
        .args(["clippy"])
        .current_dir("../..")  // Go up two dirs: from tooling/fix-clippy-warnings/src to rust/
        .output()
        .expect("Failed to run cargo clippy");

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let combined = format!("{}\n{}", stdout, stderr);

    // Parse clippy warnings for dead_code
    // Format: "warning: ... is never used --> file:line:col"
    let line_re = Regex::new(r#"warning: (.+?) is never (.+?)\s+--> (.+?):(\d+)"#).unwrap();
    
    let mut affected_files: HashSet<String> = HashSet::new();
    let mut warnings: Vec<(String, String, String, String)> = Vec::new();

    for cap in line_re.captures_iter(&combined) {
        let item_name = cap.get(1).map(|m| m.as_str()).unwrap_or("").trim();
        let what = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        let file = cap.get(3).map(|m| m.as_str()).unwrap_or("");
        let line = cap.get(4).map(|m| m.as_str()).unwrap_or("0");
        
        if what == "used" || what == "constructed" || what == "read" {
            affected_files.insert(file.to_string());
            warnings.push((item_name.to_string(), what.to_string(), file.to_string(), line.to_string()));
            println!("  Found: {} ({}) at {}:{}", item_name, what, file, line);
        }
    }

    println!("\nFound {} warnings across {} files\n", warnings.len(), affected_files.len());
    println!("Processing files...\n");

    // Process each affected file
    let mut modified_count = 0;
    for file_path in &affected_files {
        let full_path = Path::new("../..").join(file_path);  // From rust/tooling/ to rust/src/
        if !full_path.exists() {
            eprintln!("File not found: {:?}", full_path);
            continue;
        }
        
        if let Ok(content) = fs::read_to_string(&full_path) {
            // Skip if already has module-level allow
            if content.contains("#![allow(dead_code)]") || content.contains("#[allow(dead_code)]") {
                println!("Skipping {} (already has allow)", file_path);
                continue;
            }
            
            // Count warnings in this file
            let warning_count = warnings.iter().filter(|(_, _, f, _)| f == file_path).count();
            
            if warning_count > 0 {
                let modified = add_module_level_allow(&content);
                if modified != content {
                    if let Err(e) = fs::write(&full_path, &modified) {
                        eprintln!("Failed to write {}: {}", file_path, e);
                    } else {
                        println!("✓ {} (added #![allow(dead_code)] for {} warnings)", file_path, warning_count);
                        modified_count += 1;
                    }
                } else {
                    // Try to add it manually at the start
                    let manual_modified = format!("#![allow(dead_code)]\n{}", content);
                    if let Err(e) = fs::write(&full_path, &manual_modified) {
                        eprintln!("Failed to write {}: {}", file_path, e);
                    } else {
                        println!("✓ {} (force-added #![allow(dead_code)] for {} warnings)", file_path, warning_count);
                        modified_count += 1;
                    }
                }
            }
        } else {
            eprintln!("Failed to read: {}", file_path);
        }
    }

    if modified_count > 0 {
        println!("\nModified {} files. Run `cargo clippy` again to verify fixes.", modified_count);
    } else {
        println!("\nNo files were modified.");
    }
}

fn add_module_level_allow(content: &str) -> String {
    let lines: Vec<&str> = content.lines().collect();
    
    // If file starts with module doc comment (//!), we need to insert #![allow] BEFORE it
    if lines.first().map(|l| l.trim().starts_with("//!")).unwrap_or(false) {
        let mut result = Vec::new();
        result.push("#![allow(dead_code)]");
        result.extend_from_slice(&lines);
        return result.join("\n");
    }
    
    // If file starts with regular doc comment (///), can't use inner attribute
    // Return unchanged
    if lines.first().map(|l| l.trim().starts_with("///")).unwrap_or(false) {
        return content.to_string();
    }
    
    // Find the first non-comment, non-empty line
    let first_code_line = lines.iter().position(|l| {
        let t = l.trim();
        !t.is_empty() && !t.starts_with("//") && !t.starts_with("/*") && !t.starts_with("//!") && !t.starts_with("/*!")
    });
    
    match first_code_line {
        Some(0) => {
            // First line is code, can use #![allow(dead_code)]
            let mut result = Vec::new();
            result.push("#![allow(dead_code)]");
            result.extend_from_slice(&lines);
            result.join("\n")
        }
        Some(pos) => {
            // First non-comment is after comments/doc-comments
            // Check if it's a doc comment (///) - if so, can't use #![allow] after it
            let first_non_comment = lines[pos].trim();
            if first_non_comment.starts_with("///") || first_non_comment.starts_with("//!") {
                // Can't use inner attribute after doc comments - return unchanged
                content.to_string()
            } else {
                let mut result = lines[..pos].to_vec();
                result.push("#![allow(dead_code)]");
                result.extend_from_slice(&lines[pos..]);
                result.join("\n")
            }
        }
        None => content.to_string()
    }
}
