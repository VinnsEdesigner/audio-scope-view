#!/usr/bin/env python3
"""
Remove comments from TypeScript/JavaScript files.
Usage: python remove-comments.py [--dry-run] <directory>
"""

import os
import re
import sys
import argparse
from pathlib import Path


def remove_js_comments(content):
    """Remove comments from JS/TS content while preserving strings."""
    result = []
    i = 0
    n = len(content)
    
    while i < n:
        # Check for string start
        if content[i] in '"\'`':
            quote = content[i]
            result.append(quote)
            i += 1
            while i < n:
                if content[i] == '\\' and i + 1 < n:
                    result.append(content[i])
                    result.append(content[i + 1])
                    i += 2
                elif content[i] == quote:
                    result.append(quote)
                    i += 1
                    break
                else:
                    result.append(content[i])
                    i += 1
        
        # Check for single-line comment
        elif content[i:i+2] == '//':
            while i < n and content[i] != '\n':
                i += 1
        
        # Check for multi-line comment
        elif content[i:i+2] == '/*':
            i += 2
            while i < n - 1:
                if content[i:i+2] == '*/':
                    i += 2
                    break
                i += 1
            if result and result[-1].strip():
                result.append(' ')
        
        else:
            result.append(content[i])
            i += 1
    
    return ''.join(result)


def process_file(filepath, dry_run=True):
    """Process a single file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
    except Exception as e:
        return False, f"Error reading: {e}"
    
    cleaned = remove_js_comments(original)
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    
    if dry_run:
        if original != cleaned:
            return True, f"Would modify: {filepath}"
        return False, None
    
    if original != cleaned:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(cleaned)
        return True, f"Modified: {filepath}"
    return False, None


def find_frontend_files(directory, extensions=None):
    """Find all frontend files in directory."""
    if extensions is None:
        extensions = {'.ts', '.tsx', '.js', '.jsx'}
    
    files = []
    for root, dirs, filenames in os.walk(directory):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '.next', 'dist', 'build']]
        
        for filename in filenames:
            if any(filename.endswith(ext) for ext in ['.ts', '.tsx', '.js', '.jsx']):
                filepath = os.path.join(root, filename)
                files.append(filepath)
    
    return files


def main():
    parser = argparse.ArgumentParser(description='Remove comments from frontend files')
    parser.add_argument('directory', help='Directory to process')
    parser.add_argument('--dry-run', action='store_true', default=True,
                        help='Show what would be changed without modifying (default: True)')
    parser.add_argument('--execute', action='store_true',
                        help='Actually modify files (default: False)')
    args = parser.parse_args()
    
    directory = Path(args.directory).resolve()
    if not directory.exists():
        print(f"Error: Directory not found: {directory}")
        sys.exit(1)
    
    dry_run = not args.execute
    
    if dry_run:
        print("DRY RUN - No files will be modified\n")
    else:
        print("EXECUTE MODE - Files will be modified!\n")
    
    files = find_frontend_files(directory)
    print(f"Found {len(files)} frontend files\n")
    
    modified_count = 0
    for filepath in files:
        modified, message = process_file(filepath, dry_run)
        if modified:
            print(message)
            modified_count += 1
    
    print(f"\n{'Would modify' if dry_run else 'Modified'} {modified_count} files")
    
    if dry_run and modified_count > 0:
        print("\nRun with --execute to actually modify files.")


if __name__ == '__main__':
    main()
