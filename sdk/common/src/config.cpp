#include "audioscope/common/config.hpp"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <sstream>

namespace audioscope {
namespace common {

namespace {

bool ieq(const std::string& a, const std::string& b) {
    if (a.size() != b.size()) return false;
    for (std::size_t i = 0; i < a.size(); ++i) {
        if (std::tolower(static_cast<unsigned char>(a[i])) !=
            std::tolower(static_cast<unsigned char>(b[i]))) {
            return false;
        }
    }
    return true;
}

int next_pow2(int v) {
    if (v <= 1) return 1;
    --v;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    return v + 1;
}

} // namespace

bool parse_window_type(const std::string& name, WindowType& out) {
    if (ieq(name, "rectangular")) { out = WindowType::Rectangular; return true; }
    if (ieq(name, "hann"))        { out = WindowType::Hann;        return true; }
    if (ieq(name, "hamming"))     { out = WindowType::Hamming;     return true; }
    if (ieq(name, "blackman"))    { out = WindowType::Blackman;    return true; }
    return false;
}

std::string window_type_name(WindowType type) {
    switch (type) {
        case WindowType::Rectangular: return "rectangular";
        case WindowType::Hann:         return "hann";
        case WindowType::Hamming:      return "hamming";
        case WindowType::Blackman:     return "blackman";
    }
    return "hann";
}

DspConfig DspConfig::normalized() const {
    DspConfig c = *this;
    if (c.sample_rate <= 0.0f) c.sample_rate = 44100.0f;
    if (c.block_size < 1) c.block_size = 1;
    c.fft_size = next_pow2(c.fft_size < 1 ? 1 : c.fft_size);
    if (c.overlap < 0.0f) c.overlap = 0.0f;
    if (c.overlap >= 1.0f) c.overlap = 0.99f;
    const float nyquist = c.sample_rate * 0.5f;
    if (c.spectrogram_min_freq < 0.0f) c.spectrogram_min_freq = 0.0f;
    if (c.spectrogram_max_freq < 0.0f) c.spectrogram_max_freq = nyquist;
    if (c.spectrogram_min_freq > nyquist) c.spectrogram_min_freq = nyquist;
    if (c.spectrogram_max_freq > nyquist) c.spectrogram_max_freq = nyquist;
    if (c.spectrogram_min_freq > c.spectrogram_max_freq) {
        std::swap(c.spectrogram_min_freq, c.spectrogram_max_freq);
    }
    return c;
}

// ---- Minimal JSON object parser -------------------------------------------
// Only the subset emitted by the settings GraphQL input is supported: a flat
// object of "key": <number|true|false|string>. No arrays, nesting, escapes
// beyond \" and \\, or whitespace sensitivity beyond skipping. This deliberately
// stays small so `common` has no JSON dependency (ARCHITECTURE.md Layer 1).

namespace {

struct Parser {
    const std::string& s;
    std::size_t i = 0;
    explicit Parser(const std::string& str) : s(str) {}

    bool eof() const { return i >= s.size(); }
    char peek() const { return s[i]; }
    char get() { return s[i++]; }

    void skip_ws() {
        while (!eof()) {
            char c = peek();
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                ++i;
            } else {
                break;
            }
        }
    }

    // Match a literal character, skipping leading whitespace. Returns false if
    // the next non-ws char doesn't match.
    bool match(char ch) {
        skip_ws();
        if (eof() || peek() != ch) return false;
        ++i;
        return true;
    }

    bool expect(char ch) { return match(ch); }

    bool parse_string(std::string& out) {
        skip_ws();
        if (eof() || peek() != '"') return false;
        ++i; // consume opening quote
        out.clear();
        while (!eof()) {
            char c = get();
            if (c == '"') return true;
            if (c == '\\') {
                if (eof()) return false;
                char e = get();
                switch (e) {
                    case '"':  out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/':  out.push_back('/'); break;
                    case 'n':  out.push_back('\n'); break;
                    case 't':  out.push_back('\t'); break;
                    default:   out.push_back(e); break;
                }
            } else {
                out.push_back(c);
            }
        }
        return false; // unterminated
    }

    bool parse_number(double& out) {
        skip_ws();
        std::size_t start = i;
        if (!eof() && (peek() == '-' || peek() == '+')) ++i;
        while (!eof()) {
            char c = peek();
            if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' ||
                c == '+' || c == '-') {
                ++i;
            } else {
                break;
            }
        }
        if (i == start) return false;
        try {
            out = std::stod(s.substr(start, i - start));
        } catch (...) {
            return false;
        }
        return true;
    }

    bool parse_bool(bool& out) {
        skip_ws();
        if (s.compare(i, 4, "true") == 0)  { i += 4; out = true;  return true; }
        if (s.compare(i, 5, "false") == 0) { i += 5; out = false; return true; }
        return false;
    }
};

} // namespace

bool from_json(const std::string& json, DspConfig& out) {
    Parser p(json);
    if (!p.expect('{')) return false;

    DspConfig c; // start from defaults; only override what's present
    bool first = true;

    while (true) {
        if (p.match('}')) { out = c; return true; } // closing brace (also handles empty)
        if (!first) {
            if (!p.expect(',')) return false;
        }
        first = false;

        std::string key;
        if (!p.parse_string(key)) return false;
        if (!p.expect(':')) return false;

        // Peek the value kind without consuming.
        p.skip_ws();
        if (p.eof()) return false;
        char next = p.peek();

        if (next == '"') {
            std::string val;
            if (!p.parse_string(val)) return false;
            if (ieq(key, "window_type")) {
                WindowType wt;
                if (parse_window_type(val, wt)) c.window_type = wt;
                // unknown names keep the default
            }
            // other string values are ignored
        } else if (next == 't' || next == 'f') {
            bool b;
            if (!p.parse_bool(b)) return false;
            (void)b; // no bool fields today; tolerated for forward-compat
        } else {
            double n;
            if (!p.parse_number(n)) return false;
            if (ieq(key, "sample_rate"))             c.sample_rate = static_cast<float>(n);
            else if (ieq(key, "block_size"))         c.block_size = static_cast<int>(n);
            else if (ieq(key, "fft_size"))          c.fft_size = static_cast<int>(n);
            else if (ieq(key, "overlap"))            c.overlap = static_cast<float>(n);
            else if (ieq(key, "spectrogram_min_freq")) c.spectrogram_min_freq = static_cast<float>(n);
            else if (ieq(key, "spectrogram_max_freq")) c.spectrogram_max_freq = static_cast<float>(n);
            // unknown numeric keys ignored
        }
    }
}

std::string to_json(const DspConfig& config) {
    std::ostringstream o;
    o << "{";
    o << "\"sample_rate\":" << config.sample_rate;
    o << ",\"block_size\":" << config.block_size;
    o << ",\"fft_size\":" << config.fft_size;
    o << ",\"window_type\":\"" << window_type_name(config.window_type) << "\"";
    o << ",\"overlap\":" << config.overlap;
    o << ",\"spectrogram_min_freq\":" << config.spectrogram_min_freq;
    o << ",\"spectrogram_max_freq\":" << config.spectrogram_max_freq;
    o << "}";
    return o.str();
}

} // namespace common
} // namespace audioscope
