use regex::Regex;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::process::Command;

fn main() {
    println!("Running clippy to find dead_code warnings...\n");

        let output = Command::new("cargo")
        .args(["clippy"])
        .current_dir("../..")          .output()
        .expect("Failed to run cargo clippy");

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let combined = format!("{}\n{}", stdout, stderr);

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

        let mut modified_count = 0;
    for file_path in &affected_files {
        let full_path = Path::new("../..").join(file_path);          if !full_path.exists() {
            eprintln!("File not found: {:?}", full_path);
            continue;
        }

        if let Ok(content) = fs::read_to_string(&full_path) {
                        if content.contains("#![allow(dead_code)]") || content.contains("#[allow(dead_code)]") {
                println!("Skipping {} (already has allow)", file_path);
                continue;
            }

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

        if lines.first().map(|l| l.trim().starts_with("        let mut result = Vec::new();
        result.push("#![allow(dead_code)]");
        result.extend_from_slice(&lines);
        return result.join("\n");
    }

            if lines.first().map(|l| l.trim().starts_with("        return content.to_string();
    }

        let first_code_line = lines.iter().position(|l| {
        let t = l.trim();
        !t.is_empty() && !t.starts_with("    });

    match first_code_line {
        Some(0) => {
                        let mut result = Vec::new();
            result.push("#![allow(dead_code)]");
            result.extend_from_slice(&lines);
            result.join("\n")
        }
        Some(pos) => {
                                    let first_non_comment = lines[pos].trim();
            if first_non_comment.starts_with("                                content.to_string()
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