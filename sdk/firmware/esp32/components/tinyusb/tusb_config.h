#ifndef TUSB_CONFIG_H_
#define TUSB_CONFIG_H_

#include "sdkconfig.h"

#define CFG_TUD_MAX_SPEED      OPT_MODE_HIGH_SPEED
#define CFG_TUD_ENABLED        1
#define CFG_TUSB_OS            OPT_OS_FREERTOS

#define CFG_TUD_VENDOR        1
#define CFG_TUD_CDC           0
#define CFG_TUD_MSC           0
#define CFG_TUD_HID           0
#define CFG_TUD_AUDIO         0
#define CFG_TUD_MIDI          0

#define CFG_TUD_VENDOR_EPSIZE     512
#define CFG_TUD_VENDOR_RX_FIFO_SZ 512
#define CFG_TUD_VENDOR_TX_FIFO_SZ 512

#define CFG_TUSB_TASK_STACK_SIZE  4096
#define CFG_TUSB_DEBUG            0

#endif
