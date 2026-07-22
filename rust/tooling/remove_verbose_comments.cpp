/**
 * Remove verbose doc comments from Rust source files.
 * 
 * This tool removes block doc comments (//! ...) that contain:
 * - List items (lines starting with -, *, =)
 * - All-caps headers
 * - Common verbose patterns (Routes:, Endpoints:, Features:, Implementation:)
 * 
 * Usage: ./remove_verbose_comments <directory> [extension]
 */

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <regex>
#include <filesystem>

namespace fs = std::filesystem;

bool is_verbose_doc_block(const std::vector<std::string>& block) {
    if (block.size() <= 1) {
        return false;
    }

    for (const auto& line : block) {
        std::string content = line.substr(3); // Remove //! 
        
        // Skip empty lines in doc block
        size_t first_nonspace = content.find_first_not_of(" \t");
        if (first_nonspace == std::string::npos) {
            continue;
        }
        content = content.substr(first_nonspace);

        // List items
        if (std::regex_match(content, std::regex(R"(^[-*=].*)"))) {
            return true;
        }
        
        // All-caps headers (like ROUTES, ENDPOINTS, etc.)
        if (content.size() > 3 && content.find(' ') == std::string::npos) {
            bool all_upper = true;
            for (char c : content) {
                if (std::isalpha(c) && !std::isupper(c)) {
                    all_upper = false;
                    break;
                }
            }
            if (all_upper && content.size() > 2) {
                return true;
            }
        }

        // Common verbose patterns
        std::vector<std::string> verbose_patterns = {
            "Routes:", "Endpoints:", "Features:", "Implementation:",
            "Usage:", "Example:", "Architecture:", "Components:",
            "This module", "This file", "This code"
        };
        
        for (const auto& pattern : verbose_patterns) {
            if (content.find(pattern) != std::string::npos) {
                return true;
            }
        }
    }

    return false;
}

bool process_file(const fs::path& filepath) {
    std::ifstream infile(filepath);
    if (!infile.is_open()) {
        std::cerr << "Cannot open: " << filepath << "\n";
        return false;
    }

    std::vector<std::string> lines;
    std::string line;
    while (std::getline(infile, line)) {
        lines.push_back(line);
    }
    infile.close();

    std::vector<std::string> output;
    size_t i = 0;
    
    while (i < lines.size()) {
        // Check if this is the start of a doc block
        if (lines[i].find("//!") == 0) {
            std::vector<std::string> doc_block;
            
            // Collect the entire doc block
            while (i < lines.size() && lines[i].find("//!") == 0) {
                doc_block.push_back(lines[i]);
                i++;
            }
            
            // If verbose, skip it; otherwise keep it
            if (!is_verbose_doc_block(doc_block)) {
                for (const auto& doc_line : doc_block) {
                    output.push_back(doc_line);
                }
            }
        } else {
            output.push_back(lines[i]);
            i++;
        }
    }

    std::ofstream outfile(filepath);
    if (!outfile.is_open()) {
        std::cerr << "Cannot write: " << filepath << "\n";
        return false;
    }

    for (const auto& out_line : output) {
        outfile << out_line << "\n";
    }
    outfile.close();
    return true;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <directory> [extension]\n";
        std::cerr << "Example: " << argv[0] << " src/ .rs\n";
        return 1;
    }

    std::string dir_path = argv[1];
    std::string extension = (argc > 2) ? argv[2] : ".rs";

    if (!fs::exists(dir_path)) {
        std::cerr << "Directory does not exist: " << dir_path << "\n";
        return 1;
    }

    int count = 0;
    int errors = 0;

    for (const auto& entry : fs::recursive_directory_iterator(dir_path)) {
        if (entry.is_regular_file() && entry.path().extension() == extension) {
            if (process_file(entry.path())) {
                count++;
                std::cout << "Processed: " << entry.path() << "\n";
            } else {
                errors++;
            }
        }
    }

    std::cout << "\nProcessed " << count << " files";
    if (errors > 0) {
        std::cout << " with " << errors << " errors";
    }
    std::cout << "\n";

    return errors > 0 ? 1 : 0;
}
