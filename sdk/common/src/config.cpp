#include "audioscope/common/config.hpp"

namespace audioscope {
namespace common {

// DspConfig is a plain aggregate; construction is default. This file is the
// future home of from_json/to_json loaders that map the settings GraphQL input
// shape to DspConfig, so the UI settings reach the C++ core with no translation
// layer (see ARCHITECTURE.md §DSP Configuration).

} // namespace common
} // namespace audioscope
