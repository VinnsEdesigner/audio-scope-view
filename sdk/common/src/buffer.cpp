// AudioRingBuffer and PoolAllocator are both header-only (template + inline).
// This file anchors the `audioscope_common` CMake target so it is non-empty
// even before any out-of-line common definitions are linked in.
#include "audioscope/common/buffer.hpp"

namespace audioscope {
namespace common {
// no out-of-line definitions yet
} // namespace common
} // namespace audioscope
