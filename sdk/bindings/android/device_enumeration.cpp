// device_enumeration.cpp — Android audio input device enumeration, done in C++.
//
// Two complementary sources are merged:
//   1. android.media.AudioManager.getDevices(GET_DEVICES_INPUTS) called via JNI
//      from C++ (the C++ side drives the JVM — no Kotlin/Java enumeration
//      code). This yields the Oboe-routable device id, framework name, type,
//      productName, supported sample rates + channel counts.
//   2. A pure-C++ parse of /proc/asound/cards + /proc/asound/cardN/id +
//      /proc/asound/cardN/usbid (and /sys/class/sound/cardN/device/...) for the
//      ALSA card short name + USB vendor/product ids, which the framework
//      often does not expose (productName is frequently null on USB mics).
//      Merged into the framework list by name match.
//
// The result is a JSON array string consumed by the TS bridge
// (app/lib/native-dsp-bridge.ts → Dsp.enumerateInputDevices()).

#include "device_enumeration.h"

#include <cstdio>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

namespace audioscope {
namespace bindings {
namespace {

// GET_DEVICES_INPUTS = 3 (android.media.AudioManager). Asking for inputs only.
constexpr int GET_DEVICES_INPUTS = 3;

// android.media.AudioDeviceInfo type constants → normalized labels.
struct TypeEntry {
    int type;
    const char* label;
};
const TypeEntry TYPE_MAP[] = {
    {0,  "builtin-mic"},          // TYPE_BUILTIN_MIC
    {1,  "builtin-speaker"},      // TYPE_BUILTIN_SPEAKER (not a source; skipped)
    {2,  "builtin-mic"},          // TYPE_BUILTIN_ECHO_REFERENCE
    {3,  "wired-headset"},        // TYPE_WIRED_HEADSET
    {4,  "wired-headphones"},     // TYPE_WIRED_HEADPHONES
    {5,  "builtin-mic"},          // TYPE_BUILTIN_ECHO_REFERENCE (legacy)
    {6,  "bluetooth-sco"},        // TYPE_BLUETOOTH_SCO
    {7,  "bluetooth-a2dp"},       // TYPE_BLUETOOTH_A2DP
    {8,  "usb-device"},           // TYPE_USB_DEVICE (USB class-compliant mic)
    {9,  "usb-headset"},          // TYPE_USB_HEADSET
    {10, "telephony"},            // TYPE_TELEPHONY
    {11, "dock"},                 // TYPE_DOCK
    {12, "fm"},                   // TYPE_FM
    {13, "hdmi"},                 // TYPE_HDMI
    {14, "builtin-mic"},          // TYPE_BUILTIN_MIC (legacy alias)
    {15, "unknown"},
};

const char* type_label(int type) {
    for (const auto& e : TYPE_MAP) {
        if (e.type == type) return e.label;
    }
    return "unknown";
}

// ---- Minimal JSON string escaping (the device names may contain quotes) ----
std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 4);
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b";  break;
            case '\f': out += "\\f";  break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", c);
                    out += buf;
                } else {
                    out += c;
                }
        }
    }
    return out;
}

// ---- /proc/asound USB / ALSA card info ----
struct AlsaCard {
    int card = -1;
    std::string id;          // /proc/asound/cardN/id (ALSA id, stable)
    std::string short_name;  // from /proc/asound/cards (the "shortname" column)
    int usb_vendor = 0;
    int usb_product = 0;
};

std::string read_file(const std::string& path) {
    std::ifstream f(path);
    if (!f) return {};
    std::stringstream ss;
    ss << f.rdbuf();
    std::string s = ss.str();
    while (!s.empty() && (s.back() == '\n' || s.back() == '\r' || s.back() == ' ')) {
        s.pop_back();
    }
    return s;
}

// Parse /proc/asound/cards lines:
//   " 0 [ALSA      ] : HDA-Intel - HDA Intel"
//   " 1 [USBMic    ] : USB Audio - USB Mic"
// → card number, ALSA id (bracketed), short name (after " - ").
std::vector<AlsaCard> parse_proc_asound_cards() {
    std::vector<AlsaCard> out;
    std::ifstream f("/proc/asound/cards");
    if (!f) return out;
    std::string line;
    while (std::getline(f, line)) {
        // Source lines start with a digit; the alternate "control" lines are skipped.
        if (line.empty() || line[0] == ' ') continue;
        AlsaCard c;
        // card number
        int n = 0;
        if (std::sscanf(line.c_str(), "%d", &n) != 1) continue;
        c.card = n;
        // ALSA id inside [ ]
        auto lb = line.find('[');
        auto rb = line.find(']');
        if (lb != std::string::npos && rb != std::string::npos && rb > lb) {
            c.id = line.substr(lb + 1, rb - lb - 1);
        }
        // short name after " - "
        auto dash = line.find(" - ");
        if (dash != std::string::npos) {
            c.short_name = line.substr(dash + 3);
        }
        out.push_back(std::move(c));
    }
    return out;
}

// Try several /proc + /sys paths for the USB vendor:product of card N.
//   /proc/asound/cardN/usbid           → "0d8c 013c" (some kernels)
//   /sys/class/sound/cardN/device/id   → the ALSA id (confirms card presence)
//   /sys/class/sound/cardN/device/..   → no stable vendor/product path in sysfs
// The most reliable is /proc/asound/cardN/usbid when present; otherwise we
// leave vendor/product 0 and rely on the name for merging.
void fill_usb_info(AlsaCard& c) {
    char path[128];
    std::snprintf(path, sizeof(path), "/proc/asound/card%d/usbid", c.card);
    std::string usbid = read_file(path);
    if (!usbid.empty()) {
        unsigned v = 0, p = 0;
        if (std::sscanf(usbid.c_str(), "%x %x", &v, &p) == 2) {
            c.usb_vendor = static_cast<int>(v);
            c.usb_product = static_cast<int>(p);
        }
    }
    // Fallback: some devices expose the modalias under sysfs with sd:usb:vXXXXpXXXX...
    std::snprintf(path, sizeof(path), "/sys/class/sound/card%d/device/modalias", c.card);
    std::string modalias = read_file(path);
    if (c.usb_vendor == 0 && modalias.rfind("usb:", 0) == 0) {
        unsigned v = 0, p = 0;
        if (std::sscanf(modalias.c_str(), "usb:v%4xp%4x", &v, &p) == 2) {
            c.usb_vendor = static_cast<int>(v);
            c.usb_product = static_cast<int>(p);
        }
    }
    if (c.id.empty()) {
        std::snprintf(path, sizeof(path), "/proc/asound/card%d/id", c.card);
        c.id = read_file(path);
    }
}

std::vector<AlsaCard> read_alsa_usb_cards() {
    auto cards = parse_proc_asound_cards();
    for (auto& c : cards) {
        fill_usb_info(c);
    }
    return cards;
}

// Case-insensitive substring test for name merging.
bool contains_ci(const std::string& haystack, const std::string& needle) {
    if (needle.empty()) return false;
    auto it_h = haystack.begin();
    auto it_n = needle.begin();
    while (it_h != haystack.end()) {
        auto h = it_h;
        auto n = it_n;
        while (h != haystack.end() && n != needle.end() &&
               std::tolower(static_cast<unsigned char>(*h)) ==
               std::tolower(static_cast<unsigned char>(*n))) {
            ++h; ++n;
        }
        if (n == needle.end()) return true;
        ++it_h;
    }
    return false;
}

// ---- JNI helpers (local refs cleaned up via guards) ----

struct JniString {
    JNIEnv* env;
    jstring jstr;
    const char* cstr;
    JniString(JNIEnv* e, jstring s) : env(e), jstr(s), cstr(nullptr) {
        if (jstr) cstr = env->GetStringUTFChars(jstr, nullptr);
    }
    ~JniString() {
        if (jstr && cstr) env->ReleaseStringUTFChars(jstr, cstr);
    }
    std::string get() const { return cstr ? std::string(cstr) : std::string(); }
};

// Convert an int[] (getSampleRates / getChannelCounts) to a JSON array string.
std::string int_array_to_json(JNIEnv* env, jintArray arr) {
    if (!arr) return "[]";
    jsize len = env->GetArrayLength(arr);
    if (len == 0) return "[]";
    std::vector<jint> v(static_cast<size_t>(len));
    env->GetIntArrayRegion(arr, 0, len, v.data());
    if (env->ExceptionCheck()) { env->ExceptionClear(); return "[]"; }
    std::string out = "[";
    for (jsize i = 0; i < len; ++i) {
        if (i) out += ",";
        out += std::to_string(static_cast<int>(v[i]));
    }
    out += "]";
    return out;
}

} // namespace

std::string enumerate_input_devices(JNIEnv* env, jobject context) {
    if (!context || !env) return "[]";

    // getSystemService("audio") → android.media.AudioManager.
    jclass ctxClass = env->GetObjectClass(context);
    if (!ctxClass || env->ExceptionCheck()) { env->ExceptionClear(); return "[]"; }
    jmethodID getSystemService = env->GetMethodID(
        ctxClass, "getSystemService", "(Ljava/lang/String;)Ljava/lang/Object;");
    env->DeleteLocalRef(ctxClass);
    if (!getSystemService || env->ExceptionCheck()) { env->ExceptionClear(); return "[]"; }

    jstring audioSvc = env->NewStringUTF("audio");
    jobject audioManager = env->CallObjectMethod(context, getSystemService, audioSvc);
    env->DeleteLocalRef(audioSvc);
    if (env->ExceptionCheck()) { env->ExceptionClear(); return "[]"; }
    if (!audioManager) return "[]";

    // AudioManager.getDevices(int) → android.media.AudioDeviceInfo[]
    jclass amClass = env->GetObjectClass(audioManager);
    jmethodID getDevices = env->GetMethodID(
        amClass, "getDevices", "(I)[Landroid/media/AudioDeviceInfo;");
    env->DeleteLocalRef(amClass);
    if (!getDevices || env->ExceptionCheck()) { env->ExceptionClear(); return "[]"; }

    jobjectArray devices = static_cast<jobjectArray>(
        env->CallObjectMethod(audioManager, getDevices, static_cast<jint>(GET_DEVICES_INPUTS)));
    env->DeleteLocalRef(audioManager);
    if (env->ExceptionCheck()) { env->ExceptionClear(); return "[]"; }
    if (!devices) return "[]";

    // Cache AudioDeviceInfo method ids once.
    jclass adiClass = env->FindClass("android/media/AudioDeviceInfo");
    if (!adiClass || env->ExceptionCheck()) { env->ExceptionClear(); return "[]"; }
    jmethodID getId       = env->GetMethodID(adiClass, "getId", "()I");
    jmethodID getName     = env->GetMethodID(adiClass, "getName", "()Ljava/lang/String;");
    jmethodID getType     = env->GetMethodID(adiClass, "getType", "()I");
    jmethodID getProductName =
        env->GetMethodID(adiClass, "getProductName", "()Ljava/lang/String;");
    jmethodID isSource    = env->GetMethodID(adiClass, "isSource", "()Z");
    jmethodID getSampleRates =
        env->GetMethodID(adiClass, "getSampleRates", "()[I");
    jmethodID getChannelCounts =
        env->GetMethodID(adiClass, "getChannelCounts", "()[I");
    env->DeleteLocalRef(adiClass);
    if (!getId || !getName || !getType || !isSource) {
        if (env->ExceptionCheck()) env->ExceptionClear();
        return "[]";
    }

    // Pre-read the /proc/asound USB card list for merging.
    auto usb_cards = read_alsa_usb_cards();

    std::string json = "[";
    jsize count = env->GetArrayLength(devices);
    bool first = true;

    for (jsize i = 0; i < count; ++i) {
        jobject dev = env->GetObjectArrayElement(devices, i);
        if (!dev) continue;

        // Only source devices (inputs). isSource() exists on API 23+; on older
        // APIs we keep the device (the GET_DEVICES_INPUTS filter already did it).
        if (isSource && !env->CallBooleanMethod(dev, isSource)) {
            env->DeleteLocalRef(dev);
            continue;
        }
        if (env->ExceptionCheck()) env->ExceptionClear();

        jint id = env->CallIntMethod(dev, getId);
        if (env->ExceptionCheck()) env->ExceptionClear();

        jstring jname = static_cast<jstring>(env->CallObjectMethod(dev, getName));
        if (env->ExceptionCheck()) env->ExceptionClear();
        std::string name = JniString(env, jname).get();
        if (jname) env->DeleteLocalRef(jname);

        jint typeInt = env->CallIntMethod(dev, getType);
        if (env->ExceptionCheck()) env->ExceptionClear();
        std::string type = type_label(static_cast<int>(typeInt));

        jstring jprod = nullptr;
        std::string productName;
        if (getProductName) {
            jprod = static_cast<jstring>(env->CallObjectMethod(dev, getProductName));
            if (env->ExceptionCheck()) env->ExceptionClear();
            productName = JniString(env, jprod).get();
            if (jprod) env->DeleteLocalRef(jprod);
        }
        // Some ROMs return null productName for USB mics; fall back to name.
        if (productName.empty()) productName = name;

        jintArray jRates = nullptr;
        jintArray jChans = nullptr;
        std::string ratesJson = "[]";
        std::string chansJson = "[]";
        if (getSampleRates) {
            jRates = static_cast<jintArray>(env->CallObjectMethod(dev, getSampleRates));
            if (env->ExceptionCheck()) env->ExceptionClear();
            ratesJson = int_array_to_json(env, jRates);
            if (jRates) env->DeleteLocalRef(jRates);
        }
        if (getChannelCounts) {
            jChans = static_cast<jintArray>(env->CallObjectMethod(dev, getChannelCounts));
            if (env->ExceptionCheck()) env->ExceptionClear();
            chansJson = int_array_to_json(env, jChans);
            if (jChans) env->DeleteLocalRef(jChans);
        }

        // Merge USB info from /proc/asound by name match.
        int usbVendor = 0, usbProduct = 0, alsaCard = -1;
        for (const auto& c : usb_cards) {
            if (c.usb_vendor == 0 && c.usb_product == 0) continue;
            // Match on the ALSA short name or id appearing in the framework
            // name/productName (case-insensitive), OR the framework name
            // containing "usb"/the product name containing the card id.
            if (contains_ci(name, c.short_name) ||
                contains_ci(productName, c.short_name) ||
                (!c.id.empty() && contains_ci(productName, c.id))) {
                usbVendor = c.usb_vendor;
                usbProduct = c.usb_product;
                alsaCard = c.card;
                break;
            }
        }

        // The first device in the list is treated as the framework default.
        bool isDefault = first;

        if (!first) json += ",";
        first = false;

        json += "{\"id\":\"" + std::to_string(static_cast<int>(id)) + "\"";
        json += ",\"name\":\"" + json_escape(name) + "\"";
        json += ",\"type\":\"" + type + "\"";
        json += ",\"productName\":\"" + json_escape(productName) + "\"";
        json += ",\"isDefault\":" + std::string(isDefault ? "true" : "false");
        json += ",\"sampleRates\":" + ratesJson;
        json += ",\"channels\":" + chansJson;
        if (usbVendor != 0) {
            char buf[16];
            std::snprintf(buf, sizeof(buf), "%d", usbVendor);
            json += ",\"usbVendor\":";
            json += buf;
            std::snprintf(buf, sizeof(buf), "%d", usbProduct);
            json += ",\"usbProduct\":";
            json += buf;
            std::snprintf(buf, sizeof(buf), "%d", alsaCard);
            json += ",\"alsaCard\":";
            json += buf;
        }
        json += "}";

        env->DeleteLocalRef(dev);
    }

    env->DeleteLocalRef(devices);
    json += "]";
    return json;
}

} // namespace bindings
} // namespace audioscope
