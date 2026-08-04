/**
 * Remove ALL comments from source files.
 *
 * Removes:
 * - Single-line comments: //, //! ///
 * - Multi-line comments: slash-star ... star-slash
 *
 * Usage: ./remove_verbose_comments <directory> [extension]
 */

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <filesystem>

namespace fs = std::filesystem;

std::string process_content(const std::string& content) {
    std::string result;
    result.reserve(content.size());
    
    size_t i = 0;
    while (i < content.size()) {
        // Check for multi-line comment /*
        if (i < content.size() - 1 && content[i] == '/' && content[i+1] == '*') {
            size_t end = content.find("*/", i + 2);
            if (end == std::string::npos) {
                i = content.size();
            } else {
                i = end + 2;
            }
            continue;
        }
        
        // Check for single-line comment //
        if (i < content.size() - 1 && content[i] == '/' && content[i+1] == '/') {
            size_t end = content.find('\n', i);
            if (end == std::string::npos) {
                break;
            }
            i = end + 1;
            continue;
        }
        
        result += content[i];
        i++;
    }
    
    return result;
}

bool process_file(const fs::path& filepath) {
    std::ifstream infile(filepath);
    if (!infile.is_open()) {
        std::cerr << "Cannot open: " << filepath << "\n";
        return false;
    }
    
    std::stringstream buffer;
    buffer << infile.rdbuf();
    std::string content = buffer.str();
    infile.close();
    
    std::string processed = process_content(content);
    
    std::ofstream outfile(filepath);
    if (!outfile.is_open()) {
        std::cerr << "Cannot write: " << filepath << "\n";
        return false;
    }
    
    // Remove trailing whitespace on empty lines
    std::istringstream lines(processed);
    std::string line;
    bool first = true;
    while (std::getline(lines, line)) {
        size_t end = line.find_last_not_of(" \t");
        if (end == std::string::npos) {
            line = "";
        } else {
            line = line.substr(0, end + 1);
        }
        
        if (!first) outfile << "\n";
        if (!line.empty()) {
            outfile << line;
        }
        first = false;
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
